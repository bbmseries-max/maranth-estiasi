import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { 
  AuditLog, 
  WorkShiftLog, 
  WaiterVaultSession 
} from '../../core/models/restaurant-pos.models';

@Component({
  selector: 'app-shift-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      <!-- TOP NAVIGATION BAR -->
      <header class="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shadow-lg">
        <div class="flex items-center gap-4">
          <a routerLink="/floor-plan" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs no-underline flex items-center gap-1.5 transition-all">
            <span>⬅️</span>
            <span>Πλάνο</span>
          </a>
          <div>
            <h1 class="text-lg font-black text-white m-0 flex items-center gap-2">
              <span>📊</span>
              <span>Αναφορές, Ταμεία & Z-Report</span>
            </h1>
            <span class="text-[10px] text-amber-400 font-bold">Ταμείο Σερβιτόρων & Ιστορικό Ασφαλείας</span>
          </div>
        </div>

        <!-- TAB SELECTOR BUTTONS -->
        <div class="flex items-center gap-2">
          <button (click)="activeTab.set('Z_REPORT')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  [class]="activeTab() === 'Z_REPORT' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🧾 Z-Report & Τζίρος
          </button>
          <button (click)="activeTab.set('VAULTS')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  [class]="activeTab() === 'VAULTS' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            👛 Ταμεία Σερβιτόρων
          </button>
          <button (click)="activeTab.set('AUDIT')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  [class]="activeTab() === 'AUDIT' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🛡️ Αρχείο Ασφαλείας
          </button>
        </div>
      </header>

      <div class="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        
        <!-- TAB 1: Z-REPORT & LIVE REVENUE METRICS -->
        @if (activeTab() === 'Z_REPORT') {
          <div class="flex flex-col gap-6">
            
            <!-- KEY METRICS TILES -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ζωντανός Τζίρος Σάλας</span>
                <div class="mt-3">
                  <span class="text-3xl font-black text-emerald-400">€{{ posService.totalLiveFloorRevenue().toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-400 block mt-1">Από {{ posService.occupiedTables().length }} ενεργά τραπέζια</span>
                </div>
              </div>

              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Εισπράξεις Μετρητών</span>
                <div class="mt-3">
                  <span class="text-3xl font-black text-amber-400">€{{ totalCashInVaults().toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-400 block mt-1">Στα πορτοφόλια σερβιτόρων</span>
                </div>
              </div>

              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Εισπράξεις Καρτών (POS)</span>
                <div class="mt-3">
                  <span class="text-3xl font-black text-sky-400">€{{ totalCardInVaults().toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-400 block mt-1">Ηλεκτρονικές συναλλαγές</span>
                </div>
              </div>

              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Εκτιμώμενος ΦΠΑ</span>
                <div class="mt-3">
                  <span class="text-3xl font-black text-purple-400">€{{ estimatedVatPool().toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-400 block mt-1">Συντελεστές 13% & 24%</span>
                </div>
              </div>

            </div>

            <!-- DETAILED FINANCIAL BREAKDOWN CARD -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
              <div class="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 class="text-base font-black text-white uppercase tracking-wider m-0">📊 Ημερήσια Οικονομική Ανακεφαλαίωση (Z-Report)</h2>
                  <span class="text-xs text-slate-400">Συνολική εικόνα ταμείου και υποχρεώσεων ΦΠΑ</span>
                </div>
                <button (click)="printZReport()"
                        class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95">
                  🖨️ Εκτύπωση Z-Report
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                
                <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                  <span class="font-bold text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-2">Ανάλυση Εισπράξεων</span>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>Αρχικά Ρέστα (Starting Floats):</span>
                    <span class="font-bold text-white">€{{ totalStartingFloats().toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>Eισπράξεις Μετρητών:</span>
                    <span class="font-bold text-emerald-400">€{{ totalCashInVaults().toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>Εισπράξεις Καρτών / POS:</span>
                    <span class="font-bold text-sky-400">€{{ totalCardInVaults().toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center pt-2 border-t border-slate-800 font-black text-sm text-white">
                    <span>Σύνολο Εισπράξεων:</span>
                    <span class="text-emerald-400">€{{ (totalCashInVaults() + totalCardInVaults()).toFixed(2) }}</span>
                  </div>
                </div>

                <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                  <span class="font-bold text-purple-400 uppercase tracking-wider border-b border-slate-800 pb-2">Ανάλυση ΦΠΑ & Καθαρά Έσοδα</span>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>Καθαρή Αξία (Net Revenue):</span>
                    <span class="font-bold text-white">€{{ (totalCashInVaults() + totalCardInVaults() - estimatedVatPool()).toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>ΦΠΑ 13% (Εστίαση & Καφές):</span>
                    <span class="font-bold text-purple-300">€{{ (estimatedVatPool() * 0.7).toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>ΦΠΑ 24% (Ποτά & Αλκοόλ):</span>
                    <span class="font-bold text-purple-300">€{{ (estimatedVatPool() * 0.3).toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center pt-2 border-t border-slate-800 font-black text-sm text-white">
                    <span>Συνολικός ΦΠΑ:</span>
                    <span class="text-purple-400">€{{ estimatedVatPool().toFixed(2) }}</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        }

        <!-- TAB 2: WAITER VAULTS & CASH POUCHES -->
        @if (activeTab() === 'VAULTS') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
            <div class="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">👛 Πορτοφόλια & Ταμεία Σερβιτόρων Βάρδιας</h2>
                <span class="text-xs text-slate-400">Έλεγχος υπολοίπων και κλείσιμο ταμείου ανά σερβιτόρο</span>
              </div>
            </div>

            <!-- ACTIVE VAULT SESSION CARD -->
            @if (posService.activeVaultSession(); as activeVault) {
              <div class="bg-slate-950 border-2 border-amber-500/60 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-base font-black text-white">👤 {{ activeVault.waiterName }}</span>
                    <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/40">
                      ● Ενεργό Ταμείο
                    </span>
                  </div>
                  <span class="text-xs text-slate-400 block mt-1">Έναρξη: {{ activeVault.openedAt | date:'shortTime' }}</span>
                </div>

                <div class="flex flex-wrap items-center gap-6 text-xs">
                  <div>
                    <span class="text-slate-400 block">Αρχικό Ταμείο</span>
                    <span class="font-black text-white text-sm">€{{ activeVault.startingFloat.toFixed(2) }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block">Μετρητά Σερβιτόρου</span>
                    <span class="font-black text-emerald-400 text-sm">€{{ activeVault.cashCollected.toFixed(2) }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block">Κάρτες POS</span>
                    <span class="font-black text-sky-400 text-sm">€{{ activeVault.cardCollected.toFixed(2) }}</span>
                  </div>
                  <div class="bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl">
                    <span class="text-slate-400 block">Σύνολο στο Πορτοφόλι</span>
                    <span class="font-black text-amber-400 text-base">€{{ (activeVault.startingFloat + activeVault.cashCollected).toFixed(2) }}</span>
                  </div>
                </div>

                <button (click)="openCloseVaultModal(activeVault)"
                        class="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-md transition-all active:scale-95">
                  🔒 Κλείσιμο Ταμείου Σερβιτόρου
                </button>
              </div>
            } @else {
              <div class="p-6 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-center text-slate-500 text-xs font-bold">
                Δεν υπάρχει ενεργή συνεδρία ταμείου για τον τρέχοντα χρήστη.
              </div>
            }

          </div>
        }

        <!-- TAB 3: IMMUTABLE SECURITY AUDIT TRAIL -->
        @if (activeTab() === 'AUDIT') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">🛡️ Αρχείο Συμβάντων Ασφαλείας (Audit Log)</h2>
                <span class="text-xs text-slate-400">Καταγραφή ακυρώσεων, μεταφορών τραπεζιών και πληρωμών</span>
              </div>
              <span class="text-xs font-bold text-amber-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                {{ posService.auditLogs().length }} Εγγραφές
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-2.5 px-3">Ώρα</th>
                    <th class="py-2.5 px-3">Υπάλληλος</th>
                    <th class="py-2.5 px-3">Ενέργεια</th>
                    <th class="py-2.5 px-3">Τραπέζι</th>
                    <th class="py-2.5 px-3">Λεπτομέρειες</th>
                  </tr>
                </thead>
                <tbody>
                  @for (log of posService.auditLogs(); track log.id) {
                    <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3 text-slate-400 font-mono">{{ log.timestamp | date:'mediumTime' }}</td>
                      <td class="py-3 px-3 font-bold text-white">{{ log.employeeName }}</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                              [class]="getActionBadgeClass(log.action)">
                          {{ log.action }}
                        </span>
                      </td>
                      <td class="py-3 px-3 font-bold text-amber-400">
                        {{ log.tableNumber ? '#' + log.tableNumber : '-' }}
                      </td>
                      <td class="py-3 px-3 text-slate-300 font-medium">{{ log.details }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="py-8 text-center text-slate-500 font-bold">
                        Δεν υπάρχουν καταχωρημένα συμβάντα ασφαλείας.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

      </div>

      <!-- MODAL: CLOSE VAULT BLIND BALANCING -->
      @if (closingVault(); as vault) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">🔒 Κλείσιμο Ταμείου: {{ vault.waiterName }}</h3>
              <button (click)="closingVault.set(null)" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
              <div class="flex justify-between text-xs text-slate-300">
                <span>Αρχικό Ταμείο:</span>
                <span class="font-bold text-white">€{{ vault.startingFloat.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-300">
                <span>Eισπράξεις Μετρητών:</span>
                <span class="font-bold text-emerald-400">€{{ vault.cashCollected.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-300">
                <span>Εισπράξεις Καρτών:</span>
                <span class="font-bold text-sky-400">€{{ vault.cardCollected.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-sm font-black text-amber-400 pt-2 border-t border-slate-800">
                <span>Αναμενόμενο Ποσό Μετρητών:</span>
                <span>€{{ (vault.startingFloat + vault.cashCollected).toFixed(2) }}</span>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-300 uppercase">Καταμέτρηση Μετρητών Πορτοφολιού (€)</label>
              <input type="number" step="0.5" [(ngModel)]="actualHandedCash"
                     class="bg-slate-900 border-2 border-slate-700 rounded-2xl px-4 py-3 text-2xl font-black text-emerald-400 focus:outline-none focus:border-amber-400" />
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="closingVault.set(null)" 
                      class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs">
                Ακύρωση
              </button>
              <button (click)="confirmVaultClose(vault.id)" 
                      class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md">
                ✓ Επιβεβαίωση & Παράδοση
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `
})
export class ShiftReportsComponent {
  public posService = inject(RestaurantPosService);
  public activeTab = signal<'Z_REPORT' | 'VAULTS' | 'AUDIT'>('Z_REPORT');

  public closingVault = signal<WaiterVaultSession | null>(null);
  public actualHandedCash: number = 0;

  public totalStartingFloats = computed(() => {
    const vault = this.posService.activeVaultSession();
    return vault ? vault.startingFloat : 50;
  });

  public totalCashInVaults = computed(() => {
    const vault = this.posService.activeVaultSession();
    return vault ? vault.cashCollected : 0;
  });

  public totalCardInVaults = computed(() => {
    const vault = this.posService.activeVaultSession();
    return vault ? vault.cardCollected : 0;
  });

  public estimatedVatPool = computed(() => {
    const totalSales = this.totalCashInVaults() + this.totalCardInVaults();
    return totalSales * 0.115; // Average weighted Greek VAT portion
  });

  public openCloseVaultModal(vault: WaiterVaultSession): void {
    this.closingVault.set(vault);
    this.actualHandedCash = vault.startingFloat + vault.cashCollected;
  }

  public confirmVaultClose(vaultId: string): void {
    const activeVault = this.posService.activeVaultSession();
    if (activeVault) {
      const expected = activeVault.startingFloat + activeVault.cashCollected;
      const variance = this.actualHandedCash - expected;

      this.posService.logAudit(
        'VAULT_CLOSED', 
        `Κλείσιμο ταμείου ${activeVault.waiterName}. Παραδόθηκαν: €${this.actualHandedCash.toFixed(2)} (Απόκλιση: €${variance.toFixed(2)})`
      );

      this.posService.activeVaultSession.set(null);
      this.closingVault.set(null);
    }
  }

  public printZReport(): void {
    window.print();
  }

  public getActionBadgeClass(action: string): string {
    switch (action) {
      case 'CLOCK_IN':
      case 'CLOCK_OUT': return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
      case 'ORDER_CREATED':
      case 'ITEM_ADDED': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'PAYMENT_RECEIVED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'ITEM_VOIDED':
      case 'VAULT_CLOSED': return 'bg-red-500/20 text-red-400 border-red-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }
}