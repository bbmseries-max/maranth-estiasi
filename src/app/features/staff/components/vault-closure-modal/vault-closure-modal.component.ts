import { Component, inject, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RestaurantPosService } from '../../../../core/services/restaurant-pos.service';
import { WaiterVaultSession } from '../../../../core/modals/restaurant-pos.modals'; 

@Component({
  selector: 'app-vault-closure-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5">
        
        <!-- Header -->
        <div class="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-lg font-black text-white m-0">🔒 Κλείσιμο Ταμείου & Βάρδιας</h3>
            <span class="text-xs text-amber-400 font-bold">{{ vault.waiterName }}</span>
          </div>
          <button (click)="cancel.emit()" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
        </div>

        <!-- Shift Sales Summary Report -->
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Έναρξη Ταμείου:</span>
            <span class="text-xs font-black text-slate-300">€{{ (vault.startingCash || 0).toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Πωλήσεις Μετρητά:</span>
            <span class="font-bold text-emerald-400">+€{{ (vault.cashCollected || 0).toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Πωλήσεις Κάρτας:</span>
            <span class="font-bold text-sky-400">€{{ (vault.cardCollected || 0).toFixed(2) }}</span>
          </div>
          <div class="pt-2 border-t border-slate-800 flex justify-between text-sm">
            <span class="font-black text-slate-300">Αναμενόμενα Μετρητά Συρταριού:</span>
            <span class="font-black text-amber-400">€{{ expectedCash().toFixed(2) }}</span>
          </div>
        </div>

        <!-- Cash Count Input -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-black text-slate-300">💵 Καταμέτρηση Μετρητών Συρταριού (€)</label>
          <input type="number" step="0.01" 
                 [ngModel]="countedCash()" (ngModelChange)="countedCash.set($event)"
                 placeholder="Εισάγετε πραγματικό ποσό..."
                 class="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3.5 text-lg font-black text-emerald-400 focus:outline-none focus:border-amber-400 transition-all">
        </div>

        <!-- Discrepancy Report Badge -->
        @if (countedCash() !== null && countedCash() !== undefined) {
          <div class="p-3 rounded-2xl flex justify-between items-center text-xs font-bold"
               [ngClass]="discrepancy() === 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : discrepancy() < 0 ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'">
            <span>{{ discrepancy() === 0 ? '✅ Ταμείο Ισοσκελισμένο' : discrepancy() < 0 ? '❌ Έλλειμμα Ταμείου:' : '⚠️ Πλεόνασμα Ταμείου:' }}</span>
            <span class="font-black text-sm">€{{ discrepancy().toFixed(2) }}</span>
          </div>
        }

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2">
          <button (click)="cancel.emit()" 
                  class="flex-1 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer">
            Ακύρωση
          </button>
          <button (click)="closeShift()" 
                  [disabled]="countedCash() === null || countedCash() === undefined"
                  class="flex-1 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-xs shadow-lg transition-all cursor-pointer">
            Οριστικό Κλείσιμο
          </button>
        </div>

      </div>
    </div>
  `
})
export class VaultClosureModalComponent {
  @Input({ required: true }) vault!: WaiterVaultSession;
  @Output() cancel = new EventEmitter<void>();
  @Output() completeShiftClose = new EventEmitter<{ vaultId: string; countedCash: number; discrepancy: number }>();

  public countedCash = signal<number | null>(null);

  public expectedCash = computed(() => {
    if (!this.vault) return 0;
    return (this.vault.startingCash || 0) + (this.vault.cashCollected || 0);
  });

  public discrepancy = computed(() => {
    const counted = this.countedCash();
    if (counted === null || counted === undefined) return 0;
    return Number((counted - this.expectedCash()).toFixed(2));
  });

  public closeShift(): void {
    const counted = this.countedCash();
    if (counted === null || counted === undefined) return;

    this.completeShiftClose.emit({
      vaultId: this.vault.id,
      countedCash: counted,
      discrepancy: this.discrepancy()
    });
  }
}