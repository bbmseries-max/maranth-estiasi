import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TenantContextService } from '../../core/services/tenant-context.service';
import { AuthShiftService } from '../../core/services/auth-shift.service'; 
import { AutoLogoutService } from '../../core/services/auto-logout.service';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { MenuSeederService } from '../../core/services/menu-seeder.service';
import { Employee } from '../../core/modals';

@Component({
  selector: 'app-waiter-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiter-login.component.html'
})
export class WaiterLoginComponent implements OnInit {
  public authShiftService = inject(AuthShiftService);
  private tenantContext = inject(TenantContextService);
  public posService = inject(RestaurantPosService);
  private autoLogoutService = inject(AutoLogoutService);
  private menuSeeder = inject(MenuSeederService);
  private router = inject(Router);

  public step = signal<'PIN_ENTRY' | 'SHIFT_SETUP'>('PIN_ENTRY');
  public enteredPin = signal<string>('');
  public errorMessage = signal<string>('');
  public startingFloat: number = 50;
  
  public supportsBiometrics = false;

  ngOnInit(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');
    this.supportsBiometrics = !!(window.PublicKeyCredential);

    // 1. If an employee is ALREADY logged in and active, navigate away safely
    const emp = this.posService.currentEmployee();
    if (emp && this.posService.getEmployeeActiveShift(emp.id)) {
      this.redirectByRole(emp.role);
    } else {
      this.step.set('PIN_ENTRY');
    }
  }

  public appendDigit(digit: string): void {
    if (this.enteredPin().length < 8) {
      this.enteredPin.update(pin => pin + digit);
      this.errorMessage.set('');
      
      // Auto-submit on 4 digits if simple PIN login
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
  // Extract entered PIN
  const pinValue = this.enteredPin(); 

  if (!pinValue) {
    this.errorMessage.set('Παρακαλώ εισάγετε PIN.');
    return;
  }

  this.errorMessage.set(''); // Reset error message

  try {
    // 🔒 Await the asynchronous Firestore lookup
    const result: any = await this.authShiftService.loginWithPin(pinValue);

    // Handle both return types: wrapper object OR direct Employee
    const employee = result?.employee || (result?.id ? result : null);

    if (employee && result?.success !== false) {
      // Save session so roleGuard persists across navigation
      localStorage.setItem('current_employee', JSON.stringify(employee));
      localStorage.setItem('maranth_pos_employee', JSON.stringify(employee));

      this.handleSuccessfulLogin(employee);
    } else {
      const msg = result?.message || 'Άκυρος κωδικός PIN. Παρακαλώ δοκιμάστε ξανά.';
      this.errorMessage.set(msg);
    }
  } catch (err) {
    console.error('Login submit error:', err);
    this.errorMessage.set('Σφάλμα κατά τη σύνδεση. Παρακαλώ δοκιμάστε ξανά.');
  }
}

  public async loginWithBiometrics(): Promise<void> {
    this.errorMessage.set('');

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      this.errorMessage.set('Τα βιομετρικά απαιτούν ασφαλή σύνδεση (HTTPS) ή localhost.');
      return;
    }

    try {
      const enrolledEmployees = this.posService.employees().filter(e => !!e.biometricPublicKey);

      if (enrolledEmployees.length === 0) {
        this.errorMessage.set('Δεν υπάρχει καταχωρημένο αποτύπωμα στο σύστημα.');
        return;
      }

      const allowCredentialsList: PublicKeyCredentialDescriptor[] = [];

      for (const e of enrolledEmployees) {
        if (!e.biometricPublicKey) continue;
        try {
          const base64 = e.biometricPublicKey.replace(/-/g, '+').replace(/_/g, '/');
          const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
          const binary = atob(base64 + pad);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          allowCredentialsList.push({
            id: bytes,
            type: 'public-key'
          });
        } catch {
          // Skip malformed public keys safely
        }
      }

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
        timeout: 60000,
        userVerification: 'preferred'
      };

      if (allowCredentialsList.length > 0) {
        publicKeyOptions.allowCredentials = allowCredentialsList;
      }

      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions
      }) as PublicKeyCredential;

      if (credential) {
        const matchedEmployee = enrolledEmployees.find(e => e.biometricPublicKey === credential.id);

        if (matchedEmployee) {
          this.posService.setLoggedInEmployee(matchedEmployee);
          this.handleSuccessfulLogin(matchedEmployee);
        } else {
          this.errorMessage.set('Το αποτύπωμα δεν αντιστοιχεί σε κάποιον υπάλληλο.');
        }
      }
    } catch (err: any) {
      console.error('Biometric Login Error:', err);
      if (err.name === 'NotAllowedError') {
        this.errorMessage.set('Ακυρώθηκε η επαλήθευση ή έληξε ο χρόνος.');
      } else {
        this.errorMessage.set(`Σφάλμα βιομετρικών: ${err.message || 'Αποτυχία'}`);
      }
    }
  }

  private isKitchenOnlyRole(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return false; // ['BARMAN', 'BARISTA', 'CHEF', 'KITCHEN'].includes(r);
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
  console.log(`🔀 Navigating user with role: ${r}`);

  // If you want Kitchen / Bar roles to go to kitchen view:
  if (['BAR', 'BARISTA', 'CHEF', 'KITCHEN'].includes(r)) {
    // 👈 Ensure '/kitchen' route exists in app.routes.ts, OR change to '/floor-plan'
    this.router.navigate(['/floor-plan']); // Or this.router.navigate(['/kitchen']);
  } else {
    this.router.navigate(['/floor-plan']);
  }
}
}