// src/app/features/kds/kds-display.component.ts

import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';

import { TableOrderItem, ItemPreparationStatus, OrderStatus } from '../../core/modals';

interface KitchenTicket {
  tableNumber: string | number;
  zone: string;
  tableId: string;
  orderId: string;
  waiterName: string;
  openedAt: string;
  status: OrderStatus;
  notes?: string;
  items: TableOrderItem[];
}

export interface VoidNotificationItem {
  id: string;
  tableNumber: number | string;
  itemName: string;
  reason: string;
}

@Component({
  selector: 'app-kds-display',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-950 p-4 text-slate-100 font-sans select-none relative">
      

    <!-- FLOATING VOID NOTIFICATION BANNERS -->
@if (voidNotifications().length > 0) {
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
    @for (alert of voidNotifications(); track alert.id) {
      <div class="p-4 rounded-2xl bg-rose-950/95 border-2 border-rose-500 text-white shadow-2xl flex items-center justify-between gap-3 animate-bounce">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🚨</span>
          <div>
            <span class="font-black text-xs text-rose-300 block">ΑΚΥΡΩΣΗ - Τραπέζι #{{ alert.tableNumber }}</span>
            <span class="font-bold text-sm block">{{ alert.itemName }}</span>
            <span class="text-[11px] text-slate-300">{{ alert.reason }}</span>
          </div>
        </div>
        <button (click)="dismissVoidNotification(alert.id)" class="text-slate-400 hover:text-white text-lg p-1">✕</button>
      </div>
    }
  </div>
}
      <!-- VOID ALERTS OVERLAY -->
      @if (activeVoidAlerts().length > 0) {
        <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-lg px-4">
          @for (alert of activeVoidAlerts(); track alert.id) {
            <div class="bg-red-600 text-white p-4 rounded-2xl shadow-2xl border-2 border-red-400 animate-pulse flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-2xl">🚫</span>
                <div>
                  <h4 class="font-black text-sm uppercase m-0">ΑΚΥΡΩΣΗ - Τραπέζι #{{ alert.tableNumber }}</h4>
                  <p class="text-xs font-bold text-red-100 m-0">{{ alert.itemName }} {{ alert.reason ? '(' + alert.reason + ')' : '' }}</p>
                </div>
              </div>
              <button (click)="acknowledgeVoid(alert.id)" 
                      class="px-3 py-1.5 bg-white text-red-700 font-black text-xs rounded-xl hover:bg-red-50 transition-all cursor-pointer">
                OK / Ελήφθη
              </button>
            </div>
          }
        </div>
      }

      <!-- KDS BAR/KITCHEN HEADER & FILTERS -->
      <div class="flex flex-col sm:flex-row justify-between items-center bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 gap-3 shadow-lg">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl font-black">
            {{ stationFilter() === 'BAR' ? '☕' : stationFilter() === 'KITCHEN' ? '🍳' : '👨‍🍳' }}
          </div>
          <div>
            <h1 class="text-xl font-black text-white m-0 tracking-tight">
              {{ stationFilter() === 'BAR' ? 'ΟΘΟΝΗ BAR / ΚΑΦΕΔΕΣ' : stationFilter() === 'KITCHEN' ? 'ΟΘΟΝΗ ΚΟΥΖΙΝΑΣ' : 'KITCHEN & BAR DISPLAY' }}
            </h1>
            <p class="text-xs text-slate-400 font-medium m-0">Ενεργές Παραγγελίες ({{ filteredTickets().length }})</p>
          </div>
        </div>

        <div class="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          <button (click)="stationFilter.set('ALL')"
                  [class]="stationFilter() === 'ALL' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white font-bold'"
                  class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer">
            Όλα
          </button>
          <button (click)="stationFilter.set('KITCHEN')"
                  [class]="stationFilter() === 'KITCHEN' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white font-bold'"
                  class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer">
            🍳 Κουζίνα
          </button>
          <button (click)="stationFilter.set('BAR')"
                  [class]="stationFilter() === 'BAR' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white font-bold'"
                  class="px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer">
            ☕ Bar / Καφέδες
          </button>
        </div>
      </div>

      <!-- KDS TICKETS GRID -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
        @for (ticket of filteredTickets(); track ticket.orderId + stationFilter()) {
          <div [class]="getTicketBorderClass(ticket)"
               class="bg-slate-900 border-2 rounded-2xl p-4 shadow-xl flex flex-col justify-between min-h-[220px] transition-all">
            
            <div class="flex flex-col gap-3">
              <!-- Ticket Header -->
              <div class="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-2xl font-black text-white m-0">Τραπέζι #{{ ticket.tableNumber }}</h3>
                    <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {{ ticket.zone }}
                    </span>
                  </div>
                  <span class="text-xs text-slate-400 font-medium">👤 {{ ticket.waiterName }}</span>
                </div>
                
                <span class="text-xs font-bold px-2 py-1 rounded-lg bg-slate-950 text-amber-400 border border-slate-800 shrink-0">
                  ⏱️ {{ getElapsedTime(ticket.openedAt) }}
                </span>
              </div>

              <!-- ORDER NOTE ALERT -->
              @if (ticket.notes) {
                <div class="bg-amber-500/20 border-l-4 border-amber-500 text-amber-300 p-3 text-xs font-bold rounded-r-xl break-words">
                  ⚠️ ΣΗΜΕΙΩΣΗ: {{ ticket.notes }}
                </div>
              }

              <!-- ITEMS LIST -->
              <div class="flex flex-col gap-2">
                @for (item of ticket.items; track item.id) {
                  <div [class]="getItemStatusClass(item.status)"
                       class="p-3 rounded-xl border flex flex-col gap-2 transition-all">
                    
                    <div class="flex justify-between items-center gap-2">
                      <div class="flex items-center gap-2 font-black text-base text-white min-w-0">
                        <span class="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 text-xs flex items-center justify-center font-black shrink-0">
                          {{ item.quantity }}x
                        </span>
                        <span class="truncate">{{ item.productName }}</span>
                      </div>

                      <button (click)="bumpItemStatus(ticket, item)"
                              [class]="getItemButtonClass(item.status)"
                              class="px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0 transition-all cursor-pointer active:scale-95">
                        {{ getItemStatusActionLabel(item.status) }}
                      </button>
                    </div>

                    <!-- MODIFIERS -->
                    @if (item.modifiers && item.modifiers.length > 0) {
  <div class="flex flex-wrap gap-1.5 pl-9">
    @for (mod of item.modifiers; track mod.id || mod.optionId || $index) {
      <span class="text-xs font-extrabold bg-amber-400/10 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
        + {{ mod.name || mod.optionName || 'Επιλογή' }}
      </span>
    }
  </div>
}

                    <!-- ITEM SPECIFIC NOTE -->
                    @if (item.itemNotes) {
                      <div class="text-xs font-bold text-rose-400 italic pl-9 break-words">
                        ↳ Σημείωση: "{{ item.itemNotes }}"
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Complete Visible Items in Ticket -->
            <button (click)="completeEntireTicket(ticket)"
                    class="mt-4 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1">
              <span>✓ Έτοιμα Όλα ({{ ticket.items.length }})</span>
            </button>

          </div>
        } @empty {
          <div class="col-span-full text-center py-20 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500 font-bold">
            <span class="text-4xl block mb-2">{{ stationFilter() === 'BAR' ? '☕' : '🍳' }}</span>
            Δεν υπάρχουν ενεργές παραγγελίες για {{ stationFilter() === 'BAR' ? 'το Bar' : stationFilter() === 'KITCHEN' ? 'την Κουζίνα' : 'Κουζίνα / Bar' }}.
          </div>
        }
      </div>
    </div>
  `
})
export class KdsDisplayComponent implements OnInit, OnDestroy {
  // 🔔 1. Declare the signal to store active void alerts
  public voidNotifications = signal<VoidNotificationItem[]>([]);
  public posService = inject(RestaurantPosService);
  public stationFilter = signal<'ALL' | 'BAR' | 'KITCHEN'>('ALL');
  public now = signal<number>(Date.now());
  public activeVoidAlerts = signal<Array<{ id: string; tableNumber: number; itemName: string; reason?: string }>>([]);

  private timerInterval: any;
  private knownItemStateMap = new Map<string, ItemPreparationStatus>();
  private isInitialLoad = true;

  // Active tickets that have actually been SENT to the kitchen/bar (SENT_TO_KITCHEN or PREPARING)
  public activeTickets = computed<KitchenTicket[]>(() => {
    const tables = this.posService.tables();
    const tickets: KitchenTicket[] = [];

    for (const table of tables) {
      if (table.activeOrder && table.activeOrder.items && table.activeOrder.items.length > 0) {
        // Only show items that have been officially sent (ignore unsent PENDING and finished SERVED/VOIDED)
        const pendingItems = table.activeOrder.items.filter(
          i => i.status === 'SENT_TO_KITCHEN' || i.status === 'PREPARING'
        );
        
        if (pendingItems.length > 0) {
          tickets.push({
            tableNumber: table.tableNumber || table.number || 0,
            zone: table.zone || table.section || 'Σάλα',
            tableId: table.id,
            orderId: table.activeOrder.orderId,
            waiterName: table.assignedWaiterName || table.waiterName || 'Σερβιτόρος',
            openedAt: table.activeOrder.openedAt || new Date().toISOString(),
            status: 'PREPARING',
            notes: table.activeOrder.notes,
            items: pendingItems
          });
        }
      }
    }

    return tickets;
  });

  // Determines whether an item belongs to the BAR or KITCHEN
  private isBarItem(item: TableOrderItem): boolean {
    const products = this.posService.products();
    const prod = products.find(p => p.id === item.productId);
    
    const catId = (prod?.categoryId || '').toUpperCase();
    const catName = (prod?.categoryName || '').toLowerCase();

    // 1. Explicit Category ID / Name Match
    if (catId.includes('COFFEE') || catId.includes('DRINK') || catId.includes('BAR') || catId.includes('BEVERAGE')) {
      return true;
    }
    if (catName.includes('καφέ') || catName.includes('coffee') || catName.includes('ροφήμα') || catName.includes('ποτό') || catName.includes('bar')) {
      return true;
    }

    // 2. Keyword Match on Product Name
    const name = (item.productName || prod?.name || '').toLowerCase();
    return (
      name.includes('καφέ') || name.includes('espresso') || name.includes('freddo') || 
      name.includes('cappuccino') || name.includes('latte') || name.includes('nescafe') || 
      name.includes('frappe') || name.includes('ελληνικ') || name.includes('τσάι') || 
      name.includes('νερό') || name.includes('ποτό') || name.includes('μπύρα') || 
      name.includes('χυμό') || name.includes('drink') || name.includes('coffee') || 
      name.includes('cocktail') || name.includes('αναψυκτικ') || name.includes('σοκολάτα') || 
      name.includes('soda') || name.includes('beer') || name.includes('cola') || 
      name.includes('sprite') || name.includes('fanta') || name.includes('aperol')
    );
  }

  public filteredTickets = computed<KitchenTicket[]>(() => {
    const all = this.activeTickets();
    const filter = this.stationFilter();

    if (filter === 'ALL') return all;

    return all.map(ticket => {
      const matchingItems = ticket.items.filter(item => {
        const isDrink = this.isBarItem(item);
        return filter === 'BAR' ? isDrink : !isDrink;
      });

      if (matchingItems.length === 0) return null;

      return {
        ...ticket,
        items: matchingItems
      };
    }).filter((t): t is KitchenTicket => t !== null);
  });

  constructor() {
    effect(() => {
      const tables = this.posService.tables();
      if (tables.length === 0) return;

      for (const table of tables) {
        if (table.activeOrder?.items) {
          for (const item of table.activeOrder.items) {
            const previousStatus = this.knownItemStateMap.get(item.id);
            this.knownItemStateMap.set(item.id, item.status);

            if (!this.isInitialLoad && previousStatus && previousStatus !== 'VOIDED' && item.status === 'VOIDED') {
              this.handleVoidNotification({
                id: `VOID-${Date.now()}-${item.id}`,
                tableNumber: table.tableNumber || table.number || 0,
                itemName: `${item.quantity}x ${item.productName}`,
                reason: item.itemNotes || 'Ακύρωση από σερβιτόρο'
              });
            }
          }
        }
      }

      if (this.isInitialLoad) {
        this.isInitialLoad = false;
      }
    });
  }

  ngOnInit(): void {
    const emp = this.posService.currentEmployee();
    const role = (emp?.role as string)?.toUpperCase();

    if (role === 'BARMAN' || role === 'BARISTA' || role === 'BAR') {
      this.stationFilter.set('BAR');
    } else if (role === 'KITCHEN' || role === 'CHEF') {
      this.stationFilter.set('KITCHEN');
    }

    this.timerInterval = setInterval(() => {
      this.now.set(Date.now());
    }, 10000);

    // Unlocks browser audio on first tap/click anywhere on the kitchen screen
    const unlockAudio = () => {
      this.getAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  public getElapsedTime(openedAt: string): string {
    const diffMs = this.now() - new Date(openedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    return (mins > 0 ? mins : 1) + ' λ.';
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
      case 'PREPARING': return 'bg-amber-950/40 border-amber-500/60';
      case 'SENT_TO_KITCHEN': return 'bg-slate-950 border-slate-800';
      default: return 'bg-slate-950 border-slate-800';
    }
  }

  public getItemButtonClass(status: ItemPreparationStatus): string {
    switch (status) {
      case 'SENT_TO_KITCHEN':
      case 'PENDING': return 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30';
      case 'PREPARING': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }

  public getItemStatusActionLabel(status: ItemPreparationStatus): string {
    switch (status) {
      case 'SENT_TO_KITCHEN':
      case 'PENDING': return '▶️ Έναρξη';
      case 'PREPARING': return '✓ Έτοιμο';
      default: return '✓ Έτοιμο';
    }
  }

  public bumpItemStatus(ticket: KitchenTicket, item: TableOrderItem): void {
    this.posService.bumpOrderItemStatus(ticket.tableId, item.id);
  }

  public completeEntireTicket(ticket: KitchenTicket): void {
    for (const item of ticket.items) {
      this.posService.bumpOrderItemStatus(ticket.tableId, item.id);
    }
  }

  public acknowledgeVoid(alertId: string): void {
    this.activeVoidAlerts.update(alerts => alerts.filter(a => a.id !== alertId));
  }

  // 🔊 Audio context reference
  private audioCtx: AudioContext | null = null;

  /**
   * Initializes / resumes AudioContext on user interaction to bypass autoplay restrictions
   */
  private getAudioContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Generates a 2-tone kitchen warning alert (880 Hz -> 440 Hz)
   */
  public playVoidAlertSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tone 1: High Warning Beep (880 Hz - Sine wave)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Tone 2: Drop Urgent Alert (440 Hz - Sawtooth wave)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(440, now + 0.2);
      gain2.gain.setValueAtTime(0.25, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.6);
    } catch (err) {
      console.warn('Audio playback was blocked or failed:', err);
    }
  }

  // 🔊 2. Dismiss handler to remove an alert banner
  public dismissVoidNotification(id: string): void {
    this.voidNotifications.update(list => list.filter(n => n.id !== id));
  }

  // 3. Your updated handler:
  private handleVoidNotification(notification: VoidNotificationItem): void {
    // Play the chime
    this.playVoidAlertSound();

    // Add to alerts signal
    this.voidNotifications.update(list => [notification, ...list]);

    // Auto-dismiss banner after 8 seconds
    setTimeout(() => {
      this.dismissVoidNotification(notification.id);
    }, 8000);
  }
}