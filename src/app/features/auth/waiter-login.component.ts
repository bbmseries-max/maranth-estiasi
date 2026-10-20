// src/app/features/auth/waiter-login.component.ts

import { Component, inject, signal, OnInit, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { AuthShiftService } from '../../core/services/auth-shift.service'; 
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { AutoLogoutService } from '../../core/services/auto-logout.service';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { Employee } from '../../core/modals';

@Component({
  selector: 'app-waiter-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiter-login.component.html'
})
export class WaiterLoginComponent implements OnInit {
  public authShiftService = inject(AuthShiftService);
  public posService = inject(RestaurantPosService);
  public tenantContext = inject(TenantContextService);
  private autoLogoutService = inject(AutoLogoutService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);

  public step = signal<'PIN_ENTRY' | 'SHIFT_SETUP'>('PIN_ENTRY');
  public pendingEmployee = signal<Employee | null>(null);

  public enteredPin = signal<string>('');
  public errorMessage = signal<string>('');
  public startingFloat: number = 50;

  // Active store details pulled directly from your registeredStores registry
  public activeShop = computed(() => this.tenantContext.activeStore());

  ngOnInit(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');

    // Ensure tenant context matches the authoritative route slug
    const routeSlug = this.route.snapshot.paramMap.get('tenantSlug') || 
                      this.route.parent?.snapshot.paramMap.get('tenantSlug');

    if (routeSlug && routeSlug !== this.tenantContext.currentTenantId()) {
      const store = this.tenantContext.registeredStores.find(s => s.tenantId === routeSlug);
      if (store) {
        this.tenantContext.setTenantAndStore(store.tenantId, store.storeId);
      }
    }

    this.step.set('PIN_ENTRY');
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
    const targetTenant = this.tenantContext.currentTenantId();

    try {
      const employees = this.posService.employees();
      const employee = employees.find(e => 
        (e.pinCode === pinValue || e.pin === pinValue) && 
        (e.isActive ?? e.active ?? true) &&
        (!e.tenantId || e.tenantId === targetTenant)
      );

      if (employee) {
        employee.tenantId = targetTenant;
        this.handleSuccessfulAuth(employee);
      } else {
        this.errorMessage.set(`Άκυρος κωδικός PIN για το κατάστημα ${this.activeShop()?.name || ''}.`);
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
    if (this.isKitchenOrBarRole(employee.role)) {
      this.posService.setLoggedInEmployee(employee, 0);
      this.redirectByRole(employee.role);
      return;
    }

    const activeVaults = this.posService.activeVaultSessions() || [];
    const existingVault = activeVaults.find(
      v => v.status === 'OPEN' && v.waiterId === employee.id
    );

    if (existingVault) {
      this.posService.setLoggedInEmployee(employee, existingVault.startingFloat);
      this.redirectByRole(employee.role);
    } else {
      this.pendingEmployee.set(employee);
      this.startingFloat = 50;
      this.step.set('SHIFT_SETUP');
    }
  }

  private redirectByRole(role?: string): void {
    const slug = this.tenantContext.currentTenantId() || 'coffee-shop-demo';
    const targetArea = this.isKitchenOrBarRole(role) ? 'kitchen' : 'floor-plan';

    this.ngZone.run(() => {
      this.router.navigate(['/t', slug, targetArea], { replaceUrl: true });
    });
  }

  public async startShiftAndVault(): Promise<void> {
    const emp = this.pendingEmployee() || this.posService.currentEmployee();

    if (!emp) {
      this.step.set('PIN_ENTRY');
      return;
    }

    const floatAmount = Number(this.startingFloat) >= 0 ? Number(this.startingFloat) : 0;

    try {
      this.posService.setLoggedInEmployee(emp, floatAmount);
      this.autoLogoutService.startMonitoring();
      this.redirectByRole(emp.role);
    } catch (err) {
      console.error('Error starting shift and vault:', err);
      this.errorMessage.set('Σφάλμα κατά την έναρξη του ταμείου.');
    }
  }

  public cancelShiftSetup(): void {
    this.pendingEmployee.set(null);
    this.enteredPin.set('');
    this.errorMessage.set('');
    this.step.set('PIN_ENTRY');
  }
}