import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { DailyZReportSnapshot } from '../../core/modals/restaurant-pos.modals';
import { ThermalPrinterService } from '../../core/services/thermal-printer.service';
import { 
  AuditLog, 
  WorkShiftLog, 
  WaiterVaultSession,
  Employee 
} from '../../core/modals/restaurant-pos.modals';

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
            <span class="text-[10px] text-amber-400 font-bold">Ταμεία Σερβιτόρων, Βάρδιες & Ιστορικό Ασφαλείας</span>
          </div>
        </div>

        <!-- TAB SELECTOR BUTTONS -->
        <div class="flex items-center gap-2">
          <button (click)="activeTab.set('Z_REPORT')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                  [ngClass]="activeTab() === 'Z_REPORT' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            🧾 Z-Report & Τζίρος
          </button>
          <button (click)="activeTab.set('VAULTS')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                  [ngClass]="activeTab() === 'VAULTS' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            👛 Ταμεία & Βάρδιες ({{ activeVaults().length }})
          </button>
          <button (click)="activeTab.set('AUDIT')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                  [ngClass]="activeTab() === 'AUDIT' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            🛡️ Αρχείο Ασφαλείας
          </button>
        </div>
      </header>

      <!-- MAIN CONTAINER -->
      <div class="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        
        <!-- ========================================== -->
        <!-- TAB 1: Z-REPORT & LIVE REVENUE METRICS     -->
        <!-- ========================================== -->
        @if (activeTab() === 'Z_REPORT') {
          <div class="flex flex-col gap-6">
            
            <!-- KEY METRICS TILES -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Ζωντανός Τζίρος Σάλας</span>
                <div class="mt-3">
                  <span class="text-3xl font-black text-emerald-400">€{{ liveFloorRevenue().toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-400 block mt-1">Από {{ occupiedTablesCount() }} ενεργά τραπέζια</span>
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
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Συνολικός ΦΠΑ (13% & 24%)</span>
                <div class="mt-3">
                  <span class="text-3xl font-black text-purple-400">€{{ vatData().totalVat.toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-400 block mt-1">Υποχρέωση ΦΠΑ σήμερα</span>
                </div>
              </div>

            </div>

            <!-- MAIN Z-REPORT BREAKDOWN PANEL -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
              <div class="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 class="text-base font-black text-white uppercase tracking-wider m-0">📊 Ημερήσια Οικονομική Ανακεφαλαίωση (Z-Report)</h2>
                  <span class="text-xs text-slate-400">Συνολική εικόνα ταμείου και ακριβής ανάλυση συντελεστών ΦΠΑ 13% & 24%</span>
                </div>

                <div class="flex items-center gap-2">
                  <button (click)="closeBusinessDay()"
                          class="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>Κλείσιμο Ημέρας & Έκδοση Z</span>
                  </button>

                  <button (click)="printCurrentZReport()"
                          class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5">
                    <span>🖨️</span>
                    <span>Εκτύπωση Z</span>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                
                <!-- CASH & CARD REVENUE BREAKDOWN -->
                <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                  <span class="font-bold text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-2">1. Ανάλυση Εισπράξεων & Ταμείου</span>
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
                    <span>Σύνολο Ακαθάριστων Εισπράξεων:</span>
                    <span class="text-emerald-400">€{{ totalGrossSales().toFixed(2) }}</span>
                  </div>
                </div>

                <!-- EXACT GREEK VAT BREAKDOWN -->
                @let vat = vatData();
                <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                  <span class="font-bold text-purple-400 uppercase tracking-wider border-b border-slate-800 pb-2">2. Ανάλυση Συντελεστών ΦΠΑ & Καθαρά Έσοδα</span>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>Καθαρά Έσοδα 13% (Εστίαση / Καφέδες):</span>
                    <span class="font-bold text-white">€{{ vat.net13.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>ΦΠΑ 13%:</span>
                    <span class="font-bold text-purple-300">€{{ vat.vat13.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-900">
                    <span>Καθαρά Έσοδα 24% (Ποτά / Αλκοόλ):</span>
                    <span class="font-bold text-white">€{{ vat.net24.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-slate-300">
                    <span>ΦΠΑ 24%:</span>
                    <span class="font-bold text-purple-300">€{{ vat.vat24.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between items-center pt-2 border-t border-slate-800 font-black text-sm text-white">
                    <span>Συνολική Καθαρή Αξία:</span>
                    <span class="text-purple-400">€{{ vat.totalNet.toFixed(2) }}</span>
                  </div>
                </div>

              </div>
            </div>

            <!-- HISTORICAL ARCHIVED Z-REPORTS -->
            @if (zReportsList().length > 0) {
              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
                <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider m-0">📜 Ιστορικό Αρχειοθετημένων Z-Reports</h3>
                
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                        <th class="py-2.5 px-3">Ημερομηνία</th>
                        <th class="py-2.5 px-3">Manager</th>
                        <th class="py-2.5 px-3">Μετρητά</th>
                        <th class="py-2.5 px-3">Κάρτες</th>
                        <th class="py-2.5 px-3">Καθαρά Έσοδα</th>
                        <th class="py-2.5 px-3">ΦΠΑ</th>
                        <th class="py-2.5 px-3">Σύνολο Τζίρου</th>
                        <th class="py-2.5 px-3 text-right">Ενέργεια</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (z of zReportsList(); track z.id) {
                        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                          <td class="py-3 px-3 font-bold text-white">{{ z.dateStr }} ({{ z.timestamp | date:'shortTime' }})</td>
                          <td class="py-3 px-3 text-slate-300">{{ z.closedByEmployeeName }}</td>
                          <td class="py-3 px-3 font-bold text-emerald-400">€{{ z.totalCash.toFixed(2) }}</td>
                          <td class="py-3 px-3 font-bold text-sky-400">€{{ z.totalCard.toFixed(2) }}</td>
                          <td class="py-3 px-3 text-slate-300">€{{ z.totalNetRevenue.toFixed(2) }}</td>
                          <td class="py-3 px-3 font-bold text-purple-400">€{{ z.totalVatLiability.toFixed(2) }}</td>
                          <td class="py-3 px-3 font-black text-amber-400">€{{ z.totalGrossRevenue.toFixed(2) }}</td>
                          <td class="py-3 px-3 text-right">
                            <button (click)="printSnapshotZReport(z)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-[10px] cursor-pointer">
                              🖨️ Εκτύπωση
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }

          </div>
        }

        <!-- ========================================== -->
        <!-- TAB 2: WAITER VAULTS & SHIFT MANAGEMENT    -->
        <!-- ========================================== -->
        @if (activeTab() === 'VAULTS') {
          <div class="flex flex-col gap-6">
            
            <!-- MULTI-WAITER ACTIVE VAULT CARDS -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
              <div class="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 class="text-base font-black text-white uppercase tracking-wider m-0">👛 Ενεργά Ταμεία Σερβιτόρων ({{ activeVaults().length }})</h2>
                  <span class="text-xs text-slate-400">Έλεγχος υπολοίπων σε πραγματικό χρόνο, τροποποίηση αρχικού ταμείου & παράδοση</span>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (vault of activeVaults(); track vault.id) {
                  <div class="bg-slate-950 border-2 border-amber-500/60 rounded-2xl p-5 flex flex-col justify-between gap-4">
                    <div class="flex justify-between items-start border-b border-slate-800 pb-3">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-base font-black text-white">👤 {{ vault.waiterName }}</span>
                          <span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/40">
                            ● Ενεργό
                          </span>
                        </div>
                        <span class="text-[11px] text-slate-400 block mt-1">Έναρξη: {{ vault.openedAt | date:'shortTime' }}</span>
                      </div>

                      <div class="text-right bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                        <span class="text-[10px] text-slate-400 block">Σύνολο Πορτοφολιού</span>
                        <span class="font-black text-amber-400 text-base">€{{ (vault.startingFloat + vault.cashCollected).toFixed(2) }}</span>
                      </div>
                    </div>

                    <div class="grid grid-cols-3 gap-2 text-center text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <div class="flex flex-col items-center">
                        <span class="text-slate-400 text-[10px]">Αρχικά Ρέστα</span>
                        <div class="flex items-center gap-1 mt-0.5">
                          <span class="font-black text-white">€{{ vault.startingFloat.toFixed(2) }}</span>
                          <button (click)="promptEditStartingFloat(vault)" 
                                  class="text-[10px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer" title="Τροποποίηση Αρχικού Ταμείου">
                            ✏️
                          </button>
                        </div>
                      </div>
                      <div>
                        <span class="text-slate-400 block text-[10px]">Μετρητά</span>
                        <span class="font-black text-emerald-400 mt-0.5 block">€{{ vault.cashCollected.toFixed(2) }}</span>
                      </div>
                      <div>
                        <span class="text-slate-400 block text-[10px]">Κάρτες POS</span>
                        <span class="font-black text-sky-400 mt-0.5 block">€{{ vault.cardCollected.toFixed(2) }}</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                      <button (click)="printVaultReceipt(vault)"
                              class="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5">
                        <span>🖨️</span>
                        <span>Εκτύπωση</span>
                      </button>

                      <button (click)="openCloseVaultModal(vault)"
                              class="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5">
                        <span>🔒</span>
                        <span>Κλείσιμο</span>
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full p-8 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-center text-slate-500 text-xs font-bold">
                    Δεν υπάρχουν ενεργά ταμεία σερβιτόρων αυτή τη στιγμή.
                  </div>
                }
              </div>
            </div>

            <!-- LIVE SHIFT PAYROLL & HOURS SUMMARY TABLE -->
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
              <div class="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h2 class="text-base font-black text-white uppercase tracking-wider m-0">👥 Βάρδιες & Live Ωρομίσθια Προσωπικού</h2>                  
                  <span class="text-xs text-slate-400 block mt-0.5">Υπολογισμός πραγματικών ωρών εργασίας και εκτιμώμενου κόστους μισθοδοσίας</span>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-2.5 px-3">Υπάλληλος</th>
                      <th class="py-2.5 px-3">Ρόλος</th>
                      <th class="py-2.5 px-3">Clock-In</th>
                      <th class="py-2.5 px-3">Ώρες Βάρδιας</th>
                      <th class="py-2.5 px-3">Ωρομίσθιο (€/h)</th>
                      <th class="py-2.5 px-3">Εκτιμώμενη Αμοιβή</th>
                      <th class="py-2.5 px-3">Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (emp of employeesList(); track emp.id) {
                      @let activeShift = getShiftForEmployee(emp.id);
                      @let hours = calculateShiftHours(activeShift);
                      @let wage = hours * (emp.hourlyRate || 0);
                      
                      <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        <td class="py-3 px-3 font-bold text-white flex items-center gap-2">
                          <span class="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-[10px]">
                            {{ emp.name.charAt(0) }}
                          </span>
                          <span>{{ emp.name }}</span>
                        </td>
                        <td class="py-3 px-3 text-slate-400 font-medium">{{ posService.getRoleLabel(emp.role) }}</td>
                        <td class="py-3 px-3 text-amber-400 font-mono">
                          {{ activeShift ? (activeShift.clockInTime | date:'shortTime') : '-' }}
                        </td>
                        <td class="py-3 px-3 font-bold text-sky-400">
                          {{ activeShift ? (hours.toFixed(2) + 'h') : '-' }}
                        </td>
                        <td class="py-3 px-3 font-bold text-slate-300">€{{ (emp.hourlyRate || 0).toFixed(2) }}</td>
                        <td class="py-3 px-3 font-black text-emerald-400">
                          {{ activeShift ? ('€' + wage.toFixed(2)) : '-' }}
                        </td>
                        <td class="py-3 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                                [ngClass]="activeShift ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse' : 'bg-red-500/20 text-red-400 border-red-500/40'">
                            {{ activeShift ? '🟢 Στη Βάρδια' : '🔴 Εκτός' }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        }

        <!-- ========================================== -->
        <!-- TAB 3: IMMUTABLE SECURITY AUDIT TRAIL      -->
        <!-- ========================================== -->
        @if (activeTab() === 'AUDIT') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">🛡️ Αρχείο Συμβάντων Ασφαλείας (Audit Log)</h2>
                <span class="text-xs text-slate-400">Καταγραφή ακυρώσεων, μεταφορών τραπεζιών, κλεισιμάτων και πληρωμών</span>
              </div>
              <span class="text-xs font-bold text-amber-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                {{ auditLogsList().length }} Εγγραφές
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
                  @for (log of auditLogsList(); track log.id) {
                    <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3 text-slate-400 font-mono">{{ log.timestamp | date:'mediumTime' }}</td>
                      <td class="py-3 px-3 font-bold text-white">{{ log.employeeName }}</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                              [ngClass]="getActionBadgeClass(log.action)">
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

      <!-- MODAL: CLOSE VAULT BLIND BALANCING & PRINT -->
      @if (closingVault(); as vault) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">🔒 Κλείσιμο & Εκτύπωση Ταμείου</h3>
              <button (click)="closingVault.set(null)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
              <div class="flex justify-between text-xs text-slate-300">
                <span>Σερβιτόρος:</span>
                <span class="font-bold text-white">{{ vault.waiterName }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-300">
                <span>Αρχικό Ταμείο (Ρέστα):</span>
                <span class="font-bold text-white">€{{ vault.startingFloat.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-300">
                <span>Eισπράξεις Μετρητών:</span>
                <span class="font-bold text-emerald-400">€{{ vault.cashCollected.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-xs text-slate-300">
                <span>Εισπράξεις Καρτών (POS):</span>
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
                      class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="confirmVaultClose(vault)" 
                      class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5">
                <span>🖨️</span>
                <span>Παράδοση & Εκτύπωση</span>
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `
})
export class ShiftReportsComponent implements OnInit, OnDestroy {
  public posService = inject(RestaurantPosService);
  private printerService = inject(ThermalPrinterService);
  private cdr = inject(ChangeDetectorRef);

  public activeTab = signal<'Z_REPORT' | 'VAULTS' | 'AUDIT'>('Z_REPORT');
  public closingVault = signal<WaiterVaultSession | null>(null);
  public actualHandedCash: number = 0;
  public now = signal<number>(Date.now());

  // 🔒 Direct computed signals to guarantee OnPush view reactivity
  public activeVaults = computed(() => this.posService.activeVaultSessions());
  public employeesList = computed(() => this.posService.employees());
  public workShiftsList = computed(() => this.posService.workShifts());
  public zReportsList = computed(() => this.posService.zReports());
  public auditLogsList = computed(() => this.posService.auditLogs());
  public vatData = computed(() => this.posService.vatBreakdown());
  public liveFloorRevenue = computed(() => this.posService.totalLiveFloorRevenue());
  public occupiedTablesCount = computed(() => this.posService.occupiedTables().length);
  public totalCashInVaults = computed(() => this.posService.totalDailyCashInVaults());
  public totalCardInVaults = computed(() => this.posService.totalDailyCardInVaults());
  public totalStartingFloats = computed(() => this.posService.totalDailyStartingFloats());
  public totalGrossSales = computed(() => this.posService.totalDailyGrossSales());

  private timerInterval: any;

  ngOnInit(): void {
    const currentEmp = this.posService.currentEmployee();
    if (currentEmp) {
      // Re-trigger live store sync to attach listeners for Tirane kafe 1974
      this.posService.reconnectActiveStoreSync(currentEmp);
    }

    this.timerInterval = setInterval(() => {
      this.now.set(Date.now());
      this.cdr.markForCheck();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  public getShiftForEmployee(empId: string): WorkShiftLog | undefined {
    return this.posService.getEmployeeActiveShift(empId);
  }

  public calculateShiftHours(activeShift: WorkShiftLog | undefined | null): number {
    if (!activeShift || !activeShift.clockInTime) {
      return 0;
    }

    const startMs = new Date(activeShift.clockInTime).getTime();
    const endMs = activeShift.clockOutTime 
      ? new Date(activeShift.clockOutTime).getTime() 
      : Date.now();

    const diffMs = endMs - startMs;
    if (diffMs <= 0) return 0;

    return diffMs / (1000 * 60 * 60);
  }

  public promptEditStartingFloat(vault: WaiterVaultSession): void {
    const input = prompt(`Αλλαγή Αρχικού Ταμείου / Ρέστα για ${vault.waiterName} (€):`, vault.startingFloat.toString());
    if (input !== null) {
      const parsed = parseFloat(input);
      if (!isNaN(parsed) && parsed >= 0) {
        this.posService.updateWaiterVaultFloat(vault.id, parsed);
        this.cdr.markForCheck();
      }
    }
  }

  public openCloseVaultModal(vault: WaiterVaultSession): void {
    this.closingVault.set(vault);
    this.actualHandedCash = Number((vault.startingFloat + vault.cashCollected).toFixed(2));
    this.cdr.markForCheck();
  }

  public confirmVaultClose(vault: WaiterVaultSession): void {
    const expected = Number((vault.startingFloat + vault.cashCollected).toFixed(2));
    const count = Number(this.actualHandedCash) || 0;
    const variance = Number((count - expected).toFixed(2));

    // 1. Print Receipt
    this.printVaultReceipt(vault, count);

    // 2. Delegate Vault Close & Employee Clock-Out to POS Service
    const closedVault: WaiterVaultSession = {
      ...vault,
      closedAt: new Date().toISOString(),
      expectedCash: expected,
      cashHandedOver: count,
      cashVariance: variance,
      status: 'CLOSED'
    };

    this.posService.closeWaiterVaultSession(closedVault);

    // 3. Close Modal & force view update
    this.closingVault.set(null);
    this.cdr.markForCheck();
  }

  public closeBusinessDay(): void {
    if (confirm('Είστε βέβαιοι για το Κλείσιμο Ημέρας; Θα δημιουργηθεί μόνιμο snapshot Z-Report.')) {
      const snapshot = this.posService.closeDayAndGenerateZReport();
      this.printSnapshotZReport(snapshot);
      this.cdr.markForCheck();
    }
  }

  public printCurrentZReport(): void {
    const vat = this.posService.vatBreakdown();
    const snapshot: DailyZReportSnapshot = {
      id: `Z-LIVE-${Date.now()}`,
      dateStr: new Date().toLocaleDateString('el-GR'),
      timestamp: new Date().toISOString(),
      closedByEmployeeId: this.posService.currentEmployee()?.id || 'MANAGER',
      closedByEmployeeName: this.posService.currentEmployee()?.name || 'Manager',
      totalCash: this.posService.totalDailyCashInVaults(),
      totalCard: this.posService.totalDailyCardInVaults(),
      totalGrossRevenue: vat.totalGross,
      net13: vat.net13,
      vat13: vat.vat13,
      net24: vat.net24,
      vat24: vat.vat24,
      totalNetRevenue: vat.totalNet,
      totalVatLiability: vat.totalVat
    };
    this.printSnapshotZReport(snapshot);
  }

  public printSnapshotZReport(z: DailyZReportSnapshot): void {
    this.printerService.printZReport(z);
  }

  public printVaultReceipt(vault: WaiterVaultSession, handedCash?: number): void {
    this.printerService.printVaultReceipt(vault, handedCash);
  }

  public getActionBadgeClass(action: string): string {
    switch (action) {
      case 'CLOCK_IN':
      case 'CLOCK_OUT': return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
      case 'ORDER_CREATED':
      case 'ITEM_ADDED': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'PAYMENT_RECEIVED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'ITEM_VOIDED':
      case 'VAULT_CLOSED':
      case 'Z_REPORT_CLOSED': return 'bg-red-500/20 text-red-400 border-red-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }
}