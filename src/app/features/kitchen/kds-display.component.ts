import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { RestaurantTable, TableOrderItem, ItemPreparationStatus } from '../../core/models/restaurant-pos.models';
import { doc, setDoc } from 'firebase/firestore';

interface KitchenTicket {
  tableNumber: number;
  zone: string;
  tableId: string;
  waiterName: string;
  openedAt: string;
  items: TableOrderItem[];
}

@Component({
  selector: 'app-kds-display',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      <!-- TOP KDS BAR -->
      <header class="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shadow-lg">
        <div class="flex items-center gap-4">
          <a routerLink="/floor-plan" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs no-underline flex items-center gap-1.5 transition-all">
            <span>⬅️</span>
            <span>Πλάνο</span>
          </a>
          <div>
            <h1 class="text-lg font-black text-white m-0 flex items-center gap-2">
              <span>🍳</span>
              <span>Οθόνη Κουζίνας & Bar (KDS)</span>
            </h1>
            <span class="text-[10px] text-emerald-400 font-bold">● Ζωντανή Σύνδεση</span>
          </div>
        </div>

        <!-- FILTER STATIONS -->
        <div class="flex items-center gap-2">
          <button (click)="stationFilter.set('ALL')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  [ngClass]="stationFilter() === 'ALL' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🌐 Όλα ({{ activeTickets().length }})
          </button>
          <button (click)="stationFilter.set('BAR')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  [ngClass]="stationFilter() === 'BAR' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            ☕ Bar / Καφέδες
          </button>
          <button (click)="stationFilter.set('KITCHEN')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  [ngClass]="stationFilter() === 'KITCHEN' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🍳 Κουζίνα / Φαγητό
          </button>
        </div>
      </header>

      <!-- TICKETS GRID -->
      <div class="flex-1 p-4 overflow-y-auto">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          @for (ticket of filteredTickets(); track ticket.tableId + ticket.openedAt) {
            <div class="bg-slate-900 border-2 rounded-2xl flex flex-col justify-between shadow-2xl overflow-hidden transition-all"
                 [ngClass]="getTicketBorderClass(ticket)">
              
              <!-- TICKET HEADER -->
              <div class="p-3 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xl font-black text-white">#{{ ticket.tableNumber }}</span>
                    <span class="text-[10px] bg-slate-700 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                      📍 {{ ticket.zone }}
                    </span>
                  </div>
                  <span class="text-[10px] text-slate-400 block mt-0.5">👤 {{ ticket.waiterName }}</span>
                </div>

                <div class="text-right">
                  <span class="text-xs font-black px-2 py-1 rounded-lg bg-slate-950 text-slate-200 border border-slate-700">
                    ⏱️ {{ getElapsedTime(ticket.openedAt) }}
                  </span>
                </div>
              </div>

              <!-- TICKET ITEMS LIST -->
              <div class="p-3 flex-1 flex flex-col gap-2 overflow-y-auto max-h-72">
                @for (item of ticket.items; track item.id) {
                  <div class="p-2.5 rounded-xl border flex flex-col gap-1 transition-all"
                       [ngClass]="getItemStatusClass(item.status)">
                    
                    <div class="flex justify-between items-center">
                      <span class="text-xs font-black text-white">{{ item.quantity }}x {{ item.productName }}</span>
                      
                      <!-- ITEM STATUS BUMP BUTTON -->
                      <button (click)="bumpItemStatus(ticket.tableId, item.id)"
                              class="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border transition-all active:scale-95"
                              [ngClass]="getItemButtonClass(item.status)">
                        {{ getItemStatusActionLabel(item.status) }}
                      </button>
                    </div>

                    <!-- MODIFIERS LIST -->
                    @if (item.modifiers && item.modifiers.length > 0) {
                      <div class="flex flex-wrap gap-1 mt-0.5">
                        @for (mod of item.modifiers; track mod.id) {
                          <span class="text-[10px] font-bold text-amber-300 bg-slate-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                            + {{ mod.name }}
                          </span>
                        }
                      </div>
                    }

                    <!-- ITEM NOTES -->
                    @if (item.itemNotes) {
                      <span class="text-[10px] font-bold text-red-400 bg-red-950/40 p-1 rounded border border-red-500/30 block">
                        📝 {{ item.itemNotes }}
                      </span>
                    }
                  </div>
                }
              </div>

              <!-- TICKET FOOTER ACTION -->
              <div class="p-3 bg-slate-800/50 border-t border-slate-800 flex justify-between items-center">
                <span class="text-[10px] text-slate-400 font-bold">{{ ticket.items.length }} είδη</span>
                <button (click)="completeEntireTicket(ticket.tableId)"
                        class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all active:scale-95">
                  ✓ Ολοκλήρωση Τραπεζιού
                </button>
              </div>

            </div>
          } @empty {
            <div class="col-span-full py-24 text-center flex flex-col items-center justify-center text-slate-600">
              <span class="text-6xl mb-3">👨‍🍳</span>
              <span class="text-sm font-bold">Δεν υπάρχουν εκκρεμείς παραγγελίες στην κουζίνα!</span>
            </div>
          }

        </div>
      </div>

    </div>
  `
})
export class KdsDisplayComponent implements OnInit, OnDestroy {
  public posService = inject(RestaurantPosService);
  public stationFilter = signal<'ALL' | 'BAR' | 'KITCHEN'>('ALL');
  public now = signal<number>(Date.now());

  private timerInterval: any;

  public activeTickets = computed<KitchenTicket[]>(() => {
    const list: KitchenTicket[] = [];

    for (const table of this.posService.occupiedTables()) {
      if (table.activeOrder && table.activeOrder.items?.length) {
        const pendingItems = table.activeOrder.items.filter(
          i => i.status === 'SENT_TO_KITCHEN' || i.status === 'PREPARING'
        );

        if (pendingItems.length > 0) {
          list.push({
            tableNumber: table.tableNumber,
            zone: table.zone,
            tableId: table.id,
            waiterName: table.assignedWaiterName || 'Σερβιτόρος',
            openedAt: table.activeOrder.openedAt,
            items: pendingItems
          });
        }
      }
    }

    return list.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
  });

  public filteredTickets = computed(() => {
    const filter = this.stationFilter();
    if (filter === 'ALL') return this.activeTickets();

    return this.activeTickets().map(ticket => {
      const filteredItems = ticket.items.filter(item => {
        const isCoffee = item.productId.startsWith('PRD-01') || item.productId.startsWith('PRD-02') || item.productId.startsWith('PRD-03');
        return filter === 'BAR' ? isCoffee : !isCoffee;
      });

      return { ...ticket, items: filteredItems };
    }).filter(ticket => ticket.items.length > 0);
  });

  ngOnInit(): void {
    this.timerInterval = setInterval(() => {
      this.now.set(Date.now());
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  public getElapsedTime(openedAt: string): string {
    const diffMs = this.now() - new Date(openedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    return `${mins} λ.`;
  }

  public getTicketBorderClass(ticket: KitchenTicket): string {
    const diffMs = this.now() - new Date(ticket.openedAt).getTime();
    const mins = Math.floor(diffMs / 60000);

    if (mins >= 15) return 'border-red-500/80 shadow-red-900/30';
    if (mins >= 8) return 'border-amber-400/80 shadow-amber-900/30';
    return 'border-emerald-500/60 shadow-emerald-900/20';
  }

  public getItemStatusClass(status: ItemPreparationStatus): string {
    switch (status) {
      case 'PREPARING': return 'bg-amber-950/30 border-amber-500/50';
      case 'SENT_TO_KITCHEN': return 'bg-slate-950 border-slate-800';
      default: return 'bg-slate-950 border-slate-800';
    }
  }

  public getItemButtonClass(status: ItemPreparationStatus): string {
    switch (status) {
      case 'SENT_TO_KITCHEN': return 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30';
      case 'PREPARING': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }

  public getItemStatusActionLabel(status: ItemPreparationStatus): string {
    switch (status) {
      case 'SENT_TO_KITCHEN': return '▶️ Έναρξη';
      case 'PREPARING': return '✓ Έτοιμο';
      default: return status;
    }
  }

  public bumpItemStatus(tableId: string, itemId: string): void {
    const table = this.posService.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const updatedItems = table.activeOrder.items.map(item => {
      if (item.id === itemId) {
        let nextStatus: ItemPreparationStatus = 'PREPARING';
        if (item.status === 'PREPARING') nextStatus = 'SERVED';
        return { ...item, status: nextStatus };
      }
      return item;
    });

    const updatedTable: RestaurantTable = {
      ...table,
      activeOrder: {
        ...table.activeOrder,
        items: updatedItems
      }
    };

    if (this.posService.db) {
      setDoc(doc(this.posService.db, 'tables', table.id), updatedTable);
    }
  }

  public completeEntireTicket(tableId: string): void {
    const table = this.posService.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const updatedItems = table.activeOrder.items.map(item => ({
      ...item,
      status: 'SERVED' as const
    }));

    const updatedTable: RestaurantTable = {
      ...table,
      activeOrder: {
        ...table.activeOrder,
        items: updatedItems
      }
    };

    if (this.posService.db) {
      setDoc(doc(this.posService.db, 'tables', table.id), updatedTable);
    }
  }
}