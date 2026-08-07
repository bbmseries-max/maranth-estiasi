import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { RestaurantTable } from '../../core/models/restaurant-pos.models';

export type TableVisualStatus = 'FREE' | 'PENDING' | 'PREPARING' | 'READY_TO_SERVE' | 'BILL_PRINTED';

@Component({
  selector: 'app-floor-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      <!-- TOP CONTROL & ZONE FILTER BAR -->
      <header class="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shadow-lg sticky top-0 z-30">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shadow-md">
            🪑
          </div>
          <div>
            <h1 class="text-base font-black text-white m-0 leading-none">Πλάνο Τραπεζιών</h1>
            <span class="text-[10px] text-amber-400 font-bold block mt-1">
              {{ posService.currentEmployee()?.name || 'Χρήστης' }} ({{ posService.currentEmployee()?.role }})
            </span>
          </div>
        </div>

        <!-- ZONE FILTERS -->
        <div class="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          <button (click)="selectedZone.set('ALL')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="selectedZone() === 'ALL' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            🌐 Όλα
          </button>
          
          <button (click)="selectedZone.set('Σάλα')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="selectedZone() === 'Σάλα' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            🏠 Σάλα
          </button>

          <button (click)="selectedZone.set('Αυλή')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="selectedZone() === 'Αυλή' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            🌿 Αυλή
          </button>

          <button (click)="selectedZone.set('Bar')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="selectedZone() === 'Bar' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
            ☕ Bar
          </button>
        </div>

        <!-- SINGLE TAKEAWAY ACTION BUTTON -->
        <div class="flex items-center gap-3">
          <button (click)="openTakeaway()"
                  class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
            <span>🛍️</span>
            <span>Γρήγορο Πακέτο</span>
          </button>
        </div>
      </header>

      <!-- MAIN TABLE GRID -->
      <main class="flex-1 p-4 md:p-6 overflow-y-auto">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          
          @for (table of filteredTables(); track table.id) {
            <div (click)="onTableSelect(table)"
                 class="bg-slate-900 border-2 rounded-3xl p-4 flex flex-col justify-between min-h-[140px] cursor-pointer shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                 [ngClass]="getTableCardBorderClass(table)">
              
              <!-- CARD TOP HEADER: NUMBER & KITCHEN PREPARATION BADGE -->
              <div class="flex justify-between items-start">
                <div class="flex flex-col">
                  <span class="text-2xl font-black text-white group-hover:text-amber-400 transition-colors">
                    #{{ table.tableNumber || table.number }}
                  </span>
                  <span class="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                    📍 {{ table.zone || table.section || 'Σάλα' }}
                  </span>
                </div>

                <!-- 🎯 DYNAMIC VISUAL KITCHEN / ORDER STATUS BADGE -->
                @switch (getTableVisualStatus(table)) {
                  @case ('PREPARING') {
                    <span class="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-[10px] font-black flex items-center gap-1 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                      <span class="text-xs">👨‍🍳</span>
                      <span>Ετοιμάζεται</span>
                    </span>
                  }
                  @case ('READY_TO_SERVE') {
                    <span class="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[10px] font-black flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse">
                      <span class="text-xs">🔔</span>
                      <span>Έτοιμο</span>
                    </span>
                  }
                  @case ('BILL_PRINTED') {
                    <span class="px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/60 text-sky-300 text-[10px] font-black flex items-center gap-1">
                      <span class="text-xs">🧾</span>
                      <span>Λογαριασμός</span>
                    </span>
                  }
                  @case ('PENDING') {
                    <span class="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1">
                      <span class="text-xs">⌛</span>
                      <span>Εκκρεμεί</span>
                    </span>
                  }
                  @default {
                    <span class="px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-500 text-[10px] font-bold border border-slate-700/50">
                      🟢 Ελεύθερο
                    </span>
                  }
                }
              </div>

              <!-- CARD BODY: CAPACITY & WAITER -->
              <div class="my-2 flex flex-col gap-0.5">
                <span class="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  👥 {{ table.capacity || table.seats || 4 }} άτομα
                </span>
                
                @if (table.assignedWaiterName || table.waiterName; as waiter) {
                  <span class="text-[10px] font-bold text-amber-300/90 truncate">
                    👤 {{ waiter }}
                  </span>
                }
              </div>

              <!-- CARD FOOTER: GRAND TOTAL -->
              <div class="pt-2 border-t border-slate-800 flex justify-between items-end">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Σύνολο:</span>
                <span class="text-base font-black"
                      [ngClass]="(table.activeOrder?.grandTotal || table.currentTotal || 0) > 0 ? 'text-emerald-400' : 'text-slate-500'">
                  €{{ (table.activeOrder?.grandTotal || table.currentTotal || 0).toFixed(2) }}
                </span>
              </div>

            </div>
          } @empty {
            <div class="col-span-full py-24 text-center flex flex-col items-center justify-center text-slate-600">
              <span class="text-6xl mb-3">🪑</span>
              <span class="text-sm font-bold">Δεν βρέθηκαν τραπέζια στη συγκεκριμένη ζώνη.</span>
            </div>
          }

        </div>
      </main>

    </div>
  `
})
export class FloorPlanComponent {
  public posService = inject(RestaurantPosService);
  public router = inject(Router);

  public selectedZone = signal<string>('ALL');

  public filteredTables = computed(() => {
    // Exclude takeaway virtual table from table grid so Takeaway is only opened via top button
    const all = this.posService.tables().filter(t => t.id !== 'takeaway-counter' && t.zone !== 'Takeaway');
    const zone = this.selectedZone();

    if (zone === 'ALL') return all;
    return all.filter(t => (t.zone === zone || t.section === zone));
  });

  public onTableSelect(table: RestaurantTable): void {
    this.router.navigate(['/order', table.id]);
  }

  public openTakeaway(): void {
    let takeawayTable = this.posService.tables().find(t => t.id === 'takeaway-counter');
    if (!takeawayTable) {
      takeawayTable = {
        id: 'takeaway-counter',
        number: 99,
        tableNumber: 99,
        name: '🛍️ Takeaway / Πακέτο',
        seats: 1,
        capacity: 1,
        section: 'BAR',
        zone: 'Takeaway',
        status: 'FREE',
        currentTotal: 0
      };
    }
    this.router.navigate(['/order', takeawayTable.id]);
  }

  public isTableReady(table: RestaurantTable): boolean {
    const notifications = this.posService.unreadReadyNotifications();
    return notifications.some(n => n.tableId === table.id);
  }

  public getTableVisualStatus(table: RestaurantTable): TableVisualStatus {
    if (this.isTableReady(table)) {
      return 'READY_TO_SERVE';
    }
    if (!table.status || table.status === 'FREE' || !table.activeOrder) {
      return 'FREE';
    }
    if (table.status === 'BILL_PRINTED') {
      return 'BILL_PRINTED';
    }

    const items = (table.activeOrder.items || []).filter(i => i.status !== 'VOIDED');
    if (items.length === 0) return 'FREE';

    const statuses = items.map(i => i.status);

    if (statuses.includes('PREPARING') || statuses.includes('SENT_TO_KITCHEN')) {
      return 'PREPARING';
    }

    if (statuses.every(s => s === 'SERVED')) {
      return 'READY_TO_SERVE';
    }

    return 'PENDING';
  }

  public getTableCardBorderClass(table: RestaurantTable): string {
    const visualStatus = this.getTableVisualStatus(table);

    switch (visualStatus) {
      case 'READY_TO_SERVE':
        return 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-emerald-950/20';
      case 'PREPARING':
        return 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-amber-950/20';
      case 'BILL_PRINTED':
        return 'border-sky-400/80 hover:border-sky-400 bg-sky-950/20';
      case 'PENDING':
        return 'border-red-500/50 hover:border-red-500/90 bg-red-950/20';
      default:
        return 'border-slate-800 hover:border-emerald-500/50';
    }
  }
}