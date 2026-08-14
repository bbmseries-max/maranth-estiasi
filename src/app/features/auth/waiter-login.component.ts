// src/app/features/waiter-login/waiter-login.component.ts

import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DevicePairingService } from '../../core/services/device-pairing.service';
import { AuthShiftService } from '../../core/services/auth-shift.service'; 
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
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
  private router = inject(Router);

  // States: DEVICE_SETUP -> PIN_ENTRY -> SHIFT_SETUP
  public step = signal<'DEVICE_SETUP' | 'PIN_ENTRY' | 'SHIFT_SETUP'>('PIN_ENTRY');
  
  // Device Pairing Signals
  public licenseInput = signal<string>('');
  public isActivating = signal<boolean>(false);

  // Waiter Auth Signals
  public enteredPin = signal<string>('');
  public errorMessage = signal<string>('');
  public startingFloat: number = 50;
  public supportsBiometrics = false;

  // Active Store Info computed from License
  public activeShop = computed(() => this.deviceService.currentLicense());

  ngOnInit(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');
    this.supportsBiometrics = !!(window.PublicKeyCredential);

    // 1. Check if device is paired
    if (!this.deviceService.isDevicePaired()) {
      this.step.set('DEVICE_SETUP');
      return;
    }

    // 2. If paired and employee already in active shift, redirect
    const emp = this.posService.currentEmployee();
    if (emp && this.posService.getEmployeeActiveShift(emp.id)) {
      this.redirectByRole(emp.role);
    } else {
      this.step.set('PIN_ENTRY');
    }
  }

  // --- 🔑 DEVICE PAIRING ACTIONS ---

  public async submitActivationKey(): Promise<void> {
    const key = this.licenseInput().trim();
    if (!key) {
      this.errorMessage.set('Παρακαλώ εισάγετε κλειδί άδειας.');
      return;
    }

    this.isActivating.set(true);
    this.errorMessage.set('');

    const res = await this.deviceService.activateDeviceWithKey(key);
    this.isActivating.set(false);

    if (res.success) {
      this.errorMessage.set('');
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
    const code = prompt('Εισάγετε Master PIN για αποσύνδεση τερματικού:');
    if (code === '9999' || code === '0000') {
      this.deviceService.unpairDevice();
      this.step.set('DEVICE_SETUP');
      this.enteredPin.set('');
      this.errorMessage.set('');
    } else if (code) {
      alert('⚠️ Λάθος κωδικός εξουσιοδότησης.');
    }
  }

  // --- ⚡ STAFF PIN PAD ACTIONS ---

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
    const pinValue = this.enteredPin();
    if (!pinValue) return;

    this.errorMessage.set('');

    try {
      const result: any = await this.authShiftService.loginWithPin(pinValue);
      const employee: Employee | null = result?.employee || (result?.id ? result : null);

      if (employee && result?.success !== false) {
        localStorage.setItem('current_employee', JSON.stringify(employee));
        localStorage.setItem('maranth_pos_employee', JSON.stringify(employee));
        this.handleSuccessfulLogin(employee);
      } else {
        this.errorMessage.set(result?.message || 'Άκυρος κωδικός PIN.');
        this.enteredPin.set('');
      }
    } catch (err) {
      console.error('Login error:', err);
      this.errorMessage.set('Σφάλμα κατά τη σύνδεση.');
      this.enteredPin.set('');
    }
  }

  private handleSuccessfulLogin(employee: Employee): void {
    const role = (employee.role || '').toUpperCase();
    if (role === 'KITCHEN') {
      this.router.navigate(['/kitchen']);
    } else {
      this.router.navigate(['/floor-plan']);
    }
  }

  public cancelShiftSetup(): void {
    this.posService.logoutEmployee();
    this.enteredPin.set('');
    this.step.set('PIN_ENTRY');
  }

  public startShiftAndVault(): void {
    const floatAmount = Number(this.startingFloat) >= 0 ? Number(this.startingFloat) : 50;
    this.posService.clockInShift('Έναρξη βάρδιας μέσω τερματικού');
    this.posService.openWaiterVault(floatAmount);
    
    const emp = this.posService.currentEmployee();
    if (emp) {
      this.redirectByRole(emp.role);
    } else {
      this.router.navigate(['/floor-plan']);
    }
  }

  private redirectByRole(role?: string): void {
    const r = role?.toUpperCase() || '';
    if (['BAR', 'BARISTA', 'CHEF', 'KITCHEN'].includes(r)) {
      this.router.navigate(['/floor-plan']);
    } else {
      this.router.navigate(['/floor-plan']);
    }
  }
}