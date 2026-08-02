import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
          <p class="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Σύστημα Εισόδου Σερβιτόρων</p>
        </div>

        @if (step() === 'PIN_ENTRY') {
          <!-- PIN DISPLAY DOTS -->
          <div class="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 mb-6 flex flex-col items-center">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Εισάγετε 4-ψήφιο PIN</span>
            <div class="flex gap-3 h-8 items-center">
              @for (dot of [1, 2, 3, 4]; track $index) {
                <div class="w-5 h-5 rounded-full transition-all duration-200 border-2"
                     [ngClass]="enteredPin().length >= $index + 1 ? 'bg-amber-400 border-amber-400 scale-110 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'border-slate-600 bg-slate-800'">
                </div>
              }
            </div>
          </div>

          <!-- TOUCH KEYPAD GRID -->
          <div class="grid grid-cols-3 gap-3 w-full mb-4">
            @for (num of [1, 2, 3, 4, 5, 6, 7, 8, 9]; track num) {
              <button (click)="appendDigit(num.toString())"
                      class="h-16 rounded-2xl bg-slate-700/60 hover:bg-slate-700 active:scale-95 text-white font-bold text-2xl transition-all border border-slate-600/50 shadow-md flex items-center justify-center">
                {{ num }}
              </button>
            }
            <button (click)="clearPin()" 
                    class="h-16 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-sm transition-all border border-red-500/30 flex items-center justify-center">
              Clear
            </button>
            <button (click)="appendDigit('0')"
                    class="h-16 rounded-2xl bg-slate-700/60 hover:bg-slate-700 active:scale-95 text-white font-bold text-2xl transition-all border border-slate-600/50 shadow-md flex items-center justify-center">
              0
            </button>
            <button (click)="submitPin()"
                    [disabled]="enteredPin().length < 4"
                    class="h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-xl transition-all border border-emerald-500 shadow-md flex items-center justify-center">
              ✓
            </button>
          </div>
        }

        @if (step() === 'SHIFT_SETUP') {
          <!-- SHIFT START & VAULT FLOAT SETUP -->
          <div class="w-full flex flex-col gap-4">
            <div class="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-3">
              <span class="text-2xl">👤</span>
              <div>
                <div class="font-bold text-white text-base">{{ posService.currentEmployee()?.name }}</div>
                <div class="text-xs text-amber-400 font-medium">Ρόλος: {{ posService.currentEmployee()?.role }}</div>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-300 uppercase tracking-wider">Αρχικό Ταμείο / Ρέστα (€)</label>
              <input type="number" step="5" [(ngModel)]="startingFloat"
                     class="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl px-4 py-3 text-2xl font-black text-emerald-400 focus:outline-none focus:border-amber-400" />
              <span class="text-[11px] text-slate-400">Εισάγετε το ποσό μετρητών στο πορτοφόλι σας για ρέστα.</span>
            </div>

            <button (click)="startShiftAndVault()"
                    class="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-lg transition-all shadow-lg active:scale-95 mt-2">
              🚀 Έναρξη Βάρδιας & Είσοδος
            </button>
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

  ngOnInit(): void {
    this.enteredPin.set('');
    this.errorMessage.set('');
    if (!this.posService.currentEmployee()) {
      this.step.set('PIN_ENTRY');
    } else if (!this.posService.activeWorkShift()) {
      this.step.set('SHIFT_SETUP');
    } else {
      this.router.navigate(['/floor-plan']);
    }
  }

  public appendDigit(digit: string): void {
    if (this.enteredPin().length < 4) {
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

  public submitPin(): void {
    const result = this.posService.loginWithPin(this.enteredPin());
    if (result.success) {
      if (!this.posService.activeWorkShift()) {
        this.step.set('SHIFT_SETUP');
      } else {
        this.router.navigate(['/floor-plan']);
      }
    } else {
      this.errorMessage.set(result.message);
      this.clearPin();
    }
  }

  public startShiftAndVault(): void {
    this.posService.clockInShift('Έναρξη βάρδιας μέσω τερματικού');
    this.posService.openWaiterVault(this.startingFloat);
    this.router.navigate(['/floor-plan']);
  }
}