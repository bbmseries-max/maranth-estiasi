import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Employee } from '../../core/models/restaurant-pos.models';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';

@Component({
  selector: 'app-waiter-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100 select-none">
      
      <!-- MAIN AUTH CARD -->
      <div class="bg-slate-800 border border-slate-700 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center">
        
        <!-- BRAND HEADER -->
        <div class="flex flex-col items-center mb-6 text-center">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-3xl shadow-lg mb-3">
            ☕
          </div>
          <h1 class="text-2xl font-black tracking-tight text-white m-0">MARANTH ESTIASI</h1>
          <p class="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Σύστημα Εισόδου Προσωπικού</p>
        </div>

        @if (step() === 'PIN_ENTRY') {
          <!-- PIN DISPLAY DOTS -->
          <div class="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 mb-6 flex flex-col items-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Εισάγετε PIN (4 έως 8 ψηφία)
            </span>
            
            <div class="flex gap-2.5 h-8 items-center justify-center">
              @if (enteredPin().length === 0) {
                <span class="text-xs font-mono text-slate-600 italic">••••</span>
              } @else {
                @for (char of enteredPin().split(''); track $index) {
                  <div class="w-4 h-4 rounded-full bg-amber-400 border-2 border-amber-400 scale-110 shadow-[0_0_10px_rgba(251,191,36,0.5)] transition-all">
                  </div>
                }
              }
            </div>
          </div>

          <!-- TOUCH KEYPAD GRID -->
          <div class="grid grid-cols-3 gap-3 w-full mb-4">
            @for (num of [1, 2, 3, 4, 5, 6, 7, 8, 9]; track num) {
              <button (click)="appendDigit(num.toString())"
                      class="h-16 rounded-2xl bg-slate-700/60 hover:bg-slate-700 active:scale-95 text-white font-bold text-2xl transition-all border border-slate-600/50 shadow-md flex items-center justify-center cursor-pointer">
                {{ num }}
              </button>
            }
            <button (click)="clearPin()" 
                    class="h-16 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-sm transition-all border border-red-500/30 flex items-center justify-center cursor-pointer">
              Clear
            </button>
            <button (click)="appendDigit('0')"
                    class="h-16 rounded-2xl bg-slate-700/60 hover:bg-slate-700 active:scale-95 text-white font-bold text-2xl transition-all border border-slate-600/50 shadow-md flex items-center justify-center cursor-pointer">
              0
            </button>
            <button (click)="submitPin()"
                    [disabled]="enteredPin().length < 4"
                    class="h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xl transition-all border border-emerald-500 shadow-md flex items-center justify-center cursor-pointer">
              ✓
            </button>
          </div>

          <!-- BIOMETRIC FINGERPRINT LOGIN BUTTON -->
          @if (supportsBiometrics) {
            <button type="button"
                    (click)="loginWithBiometrics()"
                    class="w-full py-3.5 px-4 rounded-2xl bg-slate-700 hover:bg-slate-600 border border-amber-500/40 text-amber-400 font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 mt-2">
              <span class="text-xl">👆</span>
              <span>Είσοδος με Αποτύπωμα</span>
            </button>
          }
        }

        @if (step() === 'SHIFT_SETUP') {
          <!-- SHIFT START & EDITABLE VAULT FLOAT SETUP -->
          <div class="w-full flex flex-col gap-4 animate-fade-in">
            <div class="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3">
              <span class="text-3xl">👤</span>
              <div>
                <div class="font-black text-white text-base">{{ posService.currentEmployee()?.name }}</div>
                <div class="text-xs text-amber-400 font-bold">Ρόλος: {{ posService.getRoleLabel(posService.currentEmployee()?.role || 'WAITER') }}</div>
              </div>
            </div>

            <div class="flex flex-col gap-2 bg-slate-900 border border-slate-700 p-4 rounded-2xl">
              <label class="text-xs font-black text-slate-300 uppercase tracking-wider flex justify-between items-center">
                <span>💰 Αρχικό Ταμείο / Ρέστα (€)</span>
                <span class="text-[10px] text-emerald-400 font-bold">Επεξεργάσιμο</span>
              </label>
              
              <div class="relative">
                <input type="number" step="5" min="0" [(ngModel)]="startingFloat"
                       class="w-full bg-slate-950 border-2 border-emerald-500/80 rounded-xl px-4 py-3 text-3xl font-black text-emerald-400 text-center focus:outline-none focus:border-amber-400 shadow-inner" />
              </div>

              <!-- QUICK FLOAT PRESET BUTTONS -->
              <div class="grid grid-cols-4 gap-2 mt-1">
                <button (click)="startingFloat = 0" class="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer">€0</button>
                <button (click)="startingFloat = 20" class="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer">€20</button>
                <button (click)="startingFloat = 50" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/40 cursor-pointer">€50</button>
                <button (click)="startingFloat = 100" class="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer">€100</button>
              </div>

              <span class="text-[11px] text-slate-400 block mt-1 text-center">
                Εισάγετε ή τροποποιήστε το αρχικό ποσό μετρητών στο πορτοφόλι σας.
              </span>
            </div>

            <div class="flex gap-2">
              <button (click)="cancelShiftSetup()" 
                      class="py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-300 text-xs cursor-pointer">
                ⬅️ Ακύρωση
              </button>
              <button (click)="startShiftAndVault()"
                      class="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base transition-all shadow-lg active:scale-95 cursor-pointer">
                🚀 Έναρξη & Είσοδος (€{{ startingFloat }})
              </button>
            </div>
          </div>
        }

        <!-- ERROR ALERT -->
        @if (errorMessage()) {
          <div class="w-full mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold text-center">
            {{ errorMessage() }}
          </div>
        }

      </div>
    </div>
  `
})
export class WaiterLoginComponent implements OnInit {
  public posService = inject(RestaurantPosService);
  public router = inject(Router);

  public step = signal<'PIN_ENTRY' | 'SHIFT_SETUP'>('PIN_ENTRY');
  public enteredPin = signal<string>('');
  public errorMessage = signal<string>('');
  public startingFloat: number = 50;
  public supportsBiometrics = false;

  ngOnInit(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');
    this.supportsBiometrics = !!(window.PublicKeyCredential);
    
    const emp = this.posService.currentEmployee();
    if (emp) {
      const activeShift = this.posService.getEmployeeActiveShift(emp.id);
      if (activeShift) {
        this.redirectByRole(emp.role);
      } else {
        this.step.set('SHIFT_SETUP');
      }
    } else {
      this.step.set('PIN_ENTRY');
    }
  }

  public appendDigit(digit: string): void {
    if (this.enteredPin().length < 8) {
      this.enteredPin.update(pin => pin + digit);
      this.errorMessage.set('');
    }
  }

  public clearPin(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');
  }

  public submitPin(): void {
    if (this.enteredPin().length < 4) return;

    const result = this.posService.loginWithPin(this.enteredPin());
    if (result.success && result.employee) {
      this.handleSuccessfulLogin(result.employee);
    } else {
      this.errorMessage.set(result.message);
      this.clearPin();
    }
  }

public async loginWithBiometrics(): Promise<void> {
  this.errorMessage.set('');

  // 1. Security Context Check
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

    // 2. Explicitly type as PublicKeyCredentialDescriptor[]
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

    // 3. Build options object cleanly
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
      timeout: 60000,
      userVerification: 'preferred'
    };

    if (allowCredentialsList.length > 0) {
      publicKeyOptions.allowCredentials = allowCredentialsList;
    }

    // 4. Trigger WebAuthn Prompt
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

  private handleSuccessfulLogin(emp: Employee): void {
    const activeShift = this.posService.getEmployeeActiveShift(emp.id);
    if (!activeShift) {
      this.startingFloat = 50;
      this.step.set('SHIFT_SETUP');
    } else {
      this.redirectByRole(emp.role);
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
    const r = (role || '').toUpperCase();
    if (r === 'KITCHEN' || r === 'BARISTA') {
      this.router.navigate(['/kitchen']);
    } else {
      this.router.navigate(['/floor-plan']);
    }
  }
}