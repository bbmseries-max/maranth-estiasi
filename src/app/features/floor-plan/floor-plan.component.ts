import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { RestaurantTable, PaymentMethod } from '../../core/models/restaurant-pos.models';

@Component({
  selector: 'app-floor-plan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 font-sans select-none flex flex-col gap-6">
      
      <!-- TOP METRICS & QUICK SHIFT STATS BAR -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-md">
          <div class="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Ενεργά Τραπέζια</span>
            <span class="text-lg">🪑</span>
          </div>
          <div class="flex items-baseline gap-2 mt-2">
            <span class="text-2xl sm:text-3xl font-black text-white">
              {{ posService.occupiedTables().length }}
            </span>
            <span class="text-xs text-slate-400 font-bold">/ {{ posService.tables().length }} τραπέζια</span>
          </div>
        </div>

        <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-md">
          <div class="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Ζωντανός Τζίρος Σάλας</span>
            <span class="text-lg">💶</span>
          </div>
          <div class="mt-2">
            <span class="text-2xl sm:text-3xl font-black text-emerald-400">
              €{{ posService.totalLiveFloorRevenue().toFixed(2) }}
            </span>
          </div>
        </div>

        <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-md">
          <div class="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Ταμείο Σερβιτόρου</span>
            <span class="text-lg">👛</span>
          </div>
          <div class="mt-2 flex flex-col">
            <span class="text-xl font-black text-amber-400">
              €{{ (posService.activeVaultSession()?.startingFloat || 0) + (posService.activeVaultSession()?.cashCollected || 0) | number:'1.2-2' }}
            </span>
            <span class="text-[10px] text-slate-400">Μετρητά στο πορτοφόλι</span>
          </div>
        </div>

        <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-md">
          <div class="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Σερβιτόρος Βάρδιας</span>
            <span class="text-lg">👤</span>
          </div>
          <div class="mt-2 flex flex-col">
            <span class="text-sm font-black text-white truncate">
              {{ posService.currentEmployee()?.name || 'Μη συνδεδεμένος' }}
            </span>
            <span class="text-[10px] text-emerald-400 font-bold">● Ενεργός</span>
          </div>
        </div>

      </div>

      <!-- ZONE FILTER TABS & QUICK ACTIONS -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-2.5 rounded-2xl border border-slate-700/60">
        
        <!-- ZONE TABS -->
        <div class="flex flex-wrap gap-2 w-full sm:w-auto">
          <button (click)="selectedZone.set('ALL')"
                  class="px-4 py-2 rounded-xl text-xs font-bold transition-all border"
                  [ngClass]="selectedZone() === 'ALL' 
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105' 
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            🌐 Όλες οι Ζώνες ({{ posService.tables().length }})
          </button>

          @for (zone of availableZones(); track zone) {
            <button (click)="selectedZone.set(zone)"
                    class="px-4 py-2 rounded-xl text-xs font-bold transition-all border"
                    [ngClass]="selectedZone() === zone 
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
              📍 {{ zone }}
            </button>
          }
        </div>

        <!-- LEGEND STATUS BADGES -->
        <div class="hidden lg:flex items-center gap-4 text-xs font-bold text-slate-400 px-2">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            <span>Ελεύθερο</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-red-500 inline-block animate-pulse"></span>
            <span>Κατειλημμένο</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
            <span>Λογαριασμός</span>
          </div>
        </div>

      </div>

      <!-- TABLE GRID CARDS -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 flex-1">
        
        @for (table of filteredTables(); track table.id) {
          
          <div class="relative bg-slate-800 rounded-3xl border-2 p-4 flex flex-col justify-between shadow-xl transition-all duration-200 hover:-translate-y-1 cursor-pointer group min-h-[170px]"
               [ngClass]="{
                 'border-emerald-500/60 bg-emerald-950/10 hover:border-emerald-400': table.status === 'AVAILABLE',
                 'border-red-500/80 bg-red-950/20 hover:border-red-400 shadow-red-900/20': table.status === 'OCCUPIED',
                 'border-amber-400/80 bg-amber-950/20 hover:border-amber-300': table.status === 'BILL_PRINTED',
                 'border-blue-500/80 bg-blue-950/20': table.status === 'RESERVED'
               }"
               (click)="navigateToOrder(table)">
            
            <!-- TABLE HEADER (Number & Capacity) -->
            <div class="flex justify-between items-start">
              <div>
                <span class="text-xs font-black uppercase tracking-wider text-slate-400 block">Τραπέζι</span>
                <span class="text-3xl font-black text-white leading-none">#{{ table.tableNumber }}</span>
              </div>

              <!-- STATUS BADGE -->
              <span class="text-[10px] font-black uppercase px-2 py-1 rounded-full border shadow-sm"
                    [ngClass]="{
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/40': table.status === 'AVAILABLE',
                      'bg-red-500/20 text-red-400 border-red-500/40': table.status === 'OCCUPIED',
                      'bg-amber-500/20 text-amber-400 border-amber-500/40': table.status === 'BILL_PRINTED',
                      'bg-blue-500/20 text-blue-400 border-blue-500/40': table.status === 'RESERVED'
                    }">
                {{ getStatusLabel(table.status) }}
              </span>
            </div>

            <!-- TABLE CONTENT (Active Order Info or Empty State) -->
            <div class="my-2">
              @if (table.activeOrder; as order) {
                <div class="flex flex-col">
                  <span class="text-xs text-slate-300 font-bold truncate">👤 {{ table.assignedWaiterName || 'Σερβιτόρος' }}</span>
                  <span class="text-xl font-black text-amber-400 mt-1">€{{ order.grandTotal.toFixed(2) }}</span>
                  <span class="text-[10px] text-slate-400 font-medium">📦 {{ order.items.length }} είδη</span>
                </div>
              } @else {
                <div class="flex flex-col items-center justify-center text-slate-500 py-2">
                  <span class="text-2xl">👥</span>
                  <span class="text-[10px] font-bold mt-1">{{ table.capacity }} άτομα</span>
                </div>
              }
            </div>

            <!-- TABLE FOOTER ACTIONS -->
            <div class="pt-2 border-t border-slate-700/60 flex justify-between items-center text-xs font-bold">
              <span class="text-[11px] text-slate-400">📍 {{ table.zone }}</span>

              @if (table.status === 'OCCUPIED' || table.status === 'BILL_PRINTED') {
                <div class="flex items-center gap-1">
                  <!-- TRANSFER TABLE BUTTON -->
                  <button (click)="openTransferModal(table, $event)" 
                          class="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                          title="Μεταφορά Τραπεζιού">
                    ➡️
                  </button>
                  <!-- QUICK PAY SETTLE BUTTON -->
                  <button (click)="openQuickPayModal(table, $event)" 
                          class="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          title="Εξόφληση">
                    💳
                  </button>
                </div>
              } @else {
                <span class="text-emerald-400 group-hover:translate-x-1 transition-transform">Νέα Παραγγελία ➔</span>
              }
            </div>

          </div>

        } @empty {
          <div class="col-span-full py-16 text-center text-slate-400 font-bold bg-slate-800/40 rounded-3xl border border-dashed border-slate-700">
            Δεν βρέθηκαν τραπέζια σε αυτή τη ζώνη.
          </div>
        }

      </div>

      <!-- MODAL: TRANSFER TABLE -->
      @if (activeTransferTable(); as sourceTable) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">➡️ Μεταφορά Παραγγελίας</h3>
              <button (click)="activeTransferTable.set(null)" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <p class="text-xs text-slate-300 font-medium m-0">
              Μεταφορά λογαριασμού <strong class="text-amber-400">€{{ sourceTable.activeOrder?.grandTotal?.toFixed(2) }}</strong> από το <strong>Τραπέζι #{{ sourceTable.tableNumber }}</strong>.
            </p>

            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Επιλέξτε Ελεύθερο Τραπέζι Υποδοχής</label>
              
              <div class="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                @for (targetTable of posService.availableTables(); track targetTable.id) {
                  <button (click)="selectedTargetTableId.set(targetTable.id)"
                          class="p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center"
                          [ngClass]="selectedTargetTableId() === targetTable.id 
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black scale-105 shadow-md' 
                            : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'">
                    <span class="text-base font-bold">#{{ targetTable.tableNumber }}</span>
                    <span class="text-[10px] text-slate-400">{{ targetTable.zone }}</span>
                  </button>
                } @empty {
                  <div class="col-span-3 text-xs text-red-400 font-bold text-center py-4">
                    Δεν υπάρχουν ελεύθερα τραπέζια αυτή τη στιγμή!
                  </div>
                }
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="activeTransferTable.set(null)" 
                      class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs">
                Ακύρωση
              </button>
              <button (click)="confirmTransfer(sourceTable.id)" 
                      [disabled]="!selectedTargetTableId()"
                      class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md">
                Επιβεβαίωση Μεταφοράς
              </button>
            </div>

          </div>
        </div>
      }

      <!-- MODAL: QUICK SETTLEMENT PAYMENT -->
      @if (activePayTable(); as payTable) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 class="text-lg font-black text-white m-0">💳 Εξόφληση Τραπεζιού #{{ payTable.tableNumber }}</h3>
                <span class="text-xs text-slate-400">Σερβιτόρος: {{ payTable.assignedWaiterName }}</span>
              </div>
              <button (click)="activePayTable.set(null)" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Τελικό Πληρωτέο Ποσό</span>
              <span class="text-4xl font-black text-emerald-400">€{{ payTable.activeOrder?.grandTotal?.toFixed(2) }}</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <button (click)="confirmSettlement(payTable.id, 'CASH')"
                      class="p-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-bold text-base flex flex-col items-center gap-2 transition-all active:scale-95">
                <span class="text-3xl">💵</span>
                <span>Μετρητά</span>
              </button>

              <button (click)="confirmSettlement(payTable.id, 'CARD')"
                      class="p-4 rounded-2xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/40 font-bold text-base flex flex-col items-center gap-2 transition-all active:scale-95">
                <span class="text-3xl">💳</span>
                <span>Κάρτα / POS</span>
              </button>
            </div>

            <button (click)="activePayTable.set(null)" 
                    class="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-300 text-xs">
              Ακύρωση
            </button>

          </div>
        </div>
      }

    </div>
  `
})
export class FloorPlanComponent {
  public posService = inject(RestaurantPosService);
  public router = inject(Router);

  public selectedZone = signal<string>('ALL');
  public activeTransferTable = signal<RestaurantTable | null>(null);
  public selectedTargetTableId = signal<string | null>(null);
  public activePayTable = signal<RestaurantTable | null>(null);

  public availableZones = computed(() => {
    const zones = this.posService.tables().map(t => t.zone);
    return Array.from(new Set(zones));
  });

  public filteredTables = computed(() => {
    const zone = this.selectedZone();
    if (zone === 'ALL') return this.posService.tables();
    return this.posService.tables().filter(t => t.zone === zone);
  });

  public getStatusLabel(status: string): string {
    switch (status) {
      case 'AVAILABLE': return 'Ελεύθερο';
      case 'OCCUPIED': return 'Κατειλημμένο';
      case 'BILL_PRINTED': return 'Λογαριασμός';
      case 'RESERVED': return 'Κεκλεισμένο';
      default: return status;
    }
  }

  public navigateToOrder(table: RestaurantTable): void {
    this.router.navigate(['/order', table.id]);
  }

  public openTransferModal(table: RestaurantTable, event: Event): void {
    event.stopPropagation();
    this.activeTransferTable.set(table);
    this.selectedTargetTableId.set(null);
  }

  public confirmTransfer(fromTableId: string): void {
    const targetId = this.selectedTargetTableId();
    if (targetId) {
      this.posService.transferTable(fromTableId, targetId);
      this.activeTransferTable.set(null);
    }
  }

  public openQuickPayModal(table: RestaurantTable, event: Event): void {
    event.stopPropagation();
    this.activePayTable.set(table);
  }

  public confirmSettlement(tableId: string, method: PaymentMethod): void {
    this.posService.settleTablePayment(tableId, method);
    this.activePayTable.set(null);
  }
}