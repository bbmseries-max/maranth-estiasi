// src/app/features/waiter-login/waiter-login.component.ts

import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DevicePairingService } from '../../core/services/device-pairing.service';
import { AuthShiftService } from '../../core/services/auth-shift.service'; 
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { AutoLogoutService } from '../../core/services/auto-logout.service';
import { Employee } from '../../core/modals';

@Component({
  selector: 'app-waiter-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiter-login.component.html'
})
export class WaiterLoginComponent implements OnInit {
  public deviceService = inject(DevicePairingService);
  public authShiftService = inject(AuthShiftService);
  public posService = inject(RestaurantPosService);
  private autoLogoutService = inject(AutoLogoutService);
  private router = inject(Router);

  public step = signal<'DEVICE_SETUP' | 'PIN_ENTRY' | 'SHIFT_SETUP'>('PIN_ENTRY');
  public pendingEmployee = signal<Employee | null>(null); // 👈 Holds employee while picking float
  
  public licenseInput = signal<string>('');
  public isActivating = signal<boolean>(false);

  public enteredPin = signal<string>('');
  public errorMessage = signal<string>('');
  public startingFloat: number = 50; // Default preset
  public supportsBiometrics = false;

  public activeShop = computed(() => this.deviceService.currentLicense());

  ngOnInit(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');
    this.supportsBiometrics = !!(window.PublicKeyCredential);

    if (!this.deviceService.isDevicePaired()) {
      this.step.set('DEVICE_SETUP');
    } else {
      this.step.set('PIN_ENTRY');
    }
  }

  public appendDigit(digit: string): void {
    if (this.enteredPin().length < 8) {
      this.enteredPin.update(pin => pin + digit);
      this.errorMessage.set('');
      
      if (this.enteredPin().length === 4) {
        this.submitPin();
      }
    }
  }

  public clearPin(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');
  }

  public async submitPin(): Promise<void> {
    const pinValue = this.enteredPin().trim();
    if (!pinValue) return;

    this.errorMessage.set('');

    try {
      // Find employee by PIN from the loaded employees list
      const employees = this.posService.employees();
      const employee = employees.find(e => 
        (e.pinCode === pinValue || e.pin === pinValue) && (e.isActive ?? e.active ?? true)
      );

      if (employee) {
        this.handleSuccessfulAuth(employee);
      } else {
        this.errorMessage.set('Άκυρος κωδικός PIN. Παρακαλώ δοκιμάστε ξανά.');
        this.enteredPin.set('');
      }
    } catch (err) {
      console.error('Login error:', err);
      this.errorMessage.set('Σφάλμα κατά τη σύνδεση.');
      this.enteredPin.set('');
    }
  }
      private isKitchenOrBarRole(role?: string): boolean {
  const r = (role || '').toUpperCase();
  return r === 'KITCHEN' || r === 'CHEF' || r === 'BAR' || r === 'BARISTA' || r === 'BARMAN';
}

 private handleSuccessfulAuth(employee: Employee): void {
  // 1. Kitchen & Bar Staff -> Skip float setup completely, go straight to KDS
  if (this.isKitchenOrBarRole(employee.role)) {
    this.posService.setLoggedInEmployee(employee, 0);
    this.redirectByRole(employee.role);
    return;
  }

  // 2. Check if Waiter / Floor staff already has an OPEN vault
  const activeVaults = this.posService.activeVaultSessions() || [];
  const cleanPin = (employee.pinCode || employee.pin || '').trim();

  const existingVault = activeVaults.find(
    v => v.status === 'OPEN' && (v.waiterId === employee.id || v.waiterId === cleanPin || v.waiterName === employee.name)
  );

  if (existingVault) {
    // Already has an active open vault: Log in directly without re-prompting float
    this.posService.setLoggedInEmployee(employee, existingVault.startingFloat);
    this.redirectByRole(employee.role);
  } else {
    // Waiter starting a fresh shift -> Show float selection modal (€20, €30, €50)
    this.pendingEmployee.set(employee);
    this.startingFloat = 50;
    this.step.set('SHIFT_SETUP');
  }
}

private redirectByRole(role?: string): void {
  if (this.isKitchenOrBarRole(role)) {
    this.router.navigate(['/kitchen'], { replaceUrl: true });
  } else {
    this.router.navigate(['/floor-plan'], { replaceUrl: true });
  }
}

  public async startShiftAndVault(): Promise<void> {
    const emp = this.pendingEmployee() || this.posService.currentEmployee();

    if (!emp) {
      this.step.set('PIN_ENTRY');
      return;
    }

    const floatAmount = Number(this.startingFloat) >= 0 ? Number(this.startingFloat) : 0;

    // Set employee AND create vault with the chosen float amount
    await this.posService.setLoggedInEmployee(emp, floatAmount);
    this.autoLogoutService.startMonitoring();
    this.redirectByRole(emp.role);
  }

  public cancelShiftSetup(): void {
    this.pendingEmployee.set(null);
    this.enteredPin.set('');
    this.errorMessage.set('');
    this.step.set('PIN_ENTRY');
  }

  public async submitActivationKey(): Promise<void> {
    const key = this.licenseInput().trim();
    if (!key) return;
    this.isActivating.set(true);
    const res = await this.deviceService.activateDeviceWithKey(key);
    this.isActivating.set(false);
    if (res.success) {
      this.step.set('PIN_ENTRY');
    } else {
      this.errorMessage.set(res.message);
    }
  }

  public quickSetKey(key: string): void {
    this.licenseInput.set(key);
    this.submitActivationKey();
  }

  public promptUnpairDevice(): void {
    const code = prompt('Εισάγετε Master PIN:');
    if (code === '9999' || code === '0000') {
      this.deviceService.unpairDevice();
      this.step.set('DEVICE_SETUP');
    }
  }
}