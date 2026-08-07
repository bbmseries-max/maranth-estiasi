import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { 
  RestaurantTable, 
  Product, 
  OrderModifier, 
  Category, 
  ItemPreparationStatus,
  TableOrderItem,
  stripGreekAccents 
} from '../../core/models/restaurant-pos.models';

const DEFAULT_COFFEE_MODIFIERS: { groupTitle: string; options: OrderModifier[] }[] = [
  {
    groupTitle: 'Γλυκύτητα',
    options: [
      { id: 'MOD-SKETOS', category: 'Γλυκύτητα', name: 'Σκέτος', priceExtra: 0 },
      { id: 'MOD-METRIOS', category: 'Γλυκύτητα', name: 'Μέτριος', priceExtra: 0 },
      { id: 'MOD-GLYKOS', category: 'Γλυκύτητα', name: 'Γλυκός', priceExtra: 0 },
      { id: 'MOD-STEVIA', category: 'Γλυκύτητα', name: 'Στέβια', priceExtra: 0 }
    ]
  },
  {
    groupTitle: 'Είδος Γάλακτος',
    options: [
      { id: 'MOD-MILK-FULL', category: 'Γάλα', name: 'Πλήρες Γάλα', priceExtra: 0 },
      { id: 'MOD-MILK-LIGHT', category: 'Γάλα', name: 'Ελαφρύ 1.5%', priceExtra: 0 },
      { id: 'MOD-MILK-OAT', category: 'Γάλα', name: 'Γάλα Βρώμης', priceExtra: 0.30 },
      { id: 'MOD-MILK-ALMOND', category: 'Γάλα', name: 'Γάλα Αμυγδάλου', priceExtra: 0.30 }
    ]
  },
  {
    groupTitle: 'Έξτρα',
    options: [
      { id: 'MOD-EXTRA-SHOT', category: 'Έξτρα', name: 'Έξτρα Δόση Espresso', priceExtra: 0.60 },
      { id: 'MOD-DECAF', category: 'Έξτρα', name: 'Decaf', priceExtra: 0 }
    ]
  }
];

@Component({
  selector: 'app-order-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none">
      
      <!-- TOP NAVIGATION BAR -->
      <header class="h-16 bg-slate-800 border-b border-slate-700/80 px-4 flex items-center justify-between shadow-md">
        <div class="flex items-center gap-3">
          <a routerLink="/floor-plan" class="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs no-underline flex items-center gap-1.5 transition-all">
            <span>⬅️</span>
            <span class="hidden sm:inline">Πλάνο</span>
          </a>
          <div>
            <h1 class="text-lg font-black text-white m-0">
              Τραπέζι #{{ activeTable()?.tableNumber || activeTable()?.number || '?' }}
            </h1>
            <span class="text-[10px] text-amber-400 font-bold">📍 Ζώνη: {{ activeTable()?.zone || activeTable()?.section || 'Σάλα' }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- QUICK SEARCH BAR -->
          <div class="relative hidden md:block">
            <input type="text" [(ngModel)]="searchQuery" placeholder="Αναζήτηση προϊόντος..."
                   class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-48" />
          </div>

          <!-- KITCHEN DISPATCH BUTTON -->
          <button (click)="sendOrder()" 
                  [disabled]="!hasPendingItems()"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95">
            <span>🍳</span>
            <span>Αποστολή ({{ pendingItemsCount() }})</span>
          </button>
        </div>
      </header>

      <!-- MAIN POS GRID & BASKET SPLIT -->
      <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        <!-- LEFT: CATEGORIES & PRODUCT TILES -->
        <div class="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
          
          <!-- CATEGORY TABS -->
          <div class="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button (click)="selectedCategoryId.set('ALL')"
                    class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border"
                    [ngClass]="selectedCategoryId() === 'ALL' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
              🌐 Όλα
            </button>
            @for (cat of posService.categories(); track cat.id) {
              <button (click)="selectedCategoryId.set(cat.id)"
                      class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border"
                      [ngClass]="selectedCategoryId() === cat.id ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">
                {{ cat.name }}
              </button>
            }
          </div>

          <!-- PRODUCT TILES GRID -->
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            @for (product of filteredProducts(); track product.id) {
              <button (click)="onProductClick(product)"
                      class="bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between items-start text-left min-h-[100px] shadow-md transition-all group">
                <span class="text-xs font-bold text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-2">
                  {{ product.name }}
                </span>
                <div class="w-full flex justify-between items-end mt-2">
                  <span class="text-xs text-slate-400 font-semibold">{{ product.taxRate || 13 }}% ΦΠΑ</span>
                  <span class="text-base font-black text-emerald-400">€{{ product.price.toFixed(2) }}</span>
                </div>
              </button>
            } @empty {
              <div class="col-span-full py-12 text-center text-slate-500 font-bold text-xs">
                Δεν βρέθηκαν προϊόντα.
              </div>
            }
          </div>

        </div>

        <!-- RIGHT: ACTIVE TICKET BASKET & PAYMENT ACTIONS -->
        <div class="w-full lg:w-96 bg-slate-800/95 border-t lg:border-t-0 lg:border-l border-slate-700/80 flex flex-col p-4 shadow-2xl">
          
          <div class="flex justify-between items-center border-b border-slate-700 pb-3 mb-3">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Λογαριασμός Τραπεζιού</span>
            <span class="text-xs font-bold text-amber-400">
              {{ activeItemsCount() }} είδη
            </span>
          </div>

          <!-- TICKET ITEMS LIST -->
          <div class="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
            @for (item of activeTable()?.activeOrder?.items; track item.id) {
              <div class="bg-slate-900/80 border rounded-2xl p-3 flex flex-col gap-2 transition-all"
                   [ngClass]="getItemCardBorderClass(item.status)">
                
                <!-- TOP LINE: ITEM NAME, STATUS & PRICE -->
                <div class="flex justify-between items-start">
                  <div class="flex flex-col">
                    <span class="text-xs font-bold" [ngClass]="item.status === 'VOIDED' ? 'line-through text-red-400' : 'text-white'">
                      {{ item.productName }}
                    </span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border self-start mt-0.5"
                          [ngClass]="getItemStatusBadgeClass(item.status)">
                      {{ getItemStatusLabel(item.status) }}
                    </span>
                  </div>

                  <span class="text-xs font-black" [ngClass]="item.status === 'VOIDED' ? 'line-through text-red-400/60' : 'text-emerald-400'">
                    €{{ (item.finalItemPrice * item.quantity).toFixed(2) }}
                  </span>
                </div>

                <!-- MODIFIERS SUMMARY -->
                @if (item.modifiers && item.modifiers.length > 0) {
                  <div class="flex flex-wrap gap-1">
                    @for (mod of item.modifiers; track mod.name) {
                      <span class="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full border border-slate-700">
                        + {{ mod.name }}
                      </span>
                    }
                  </div>
                }

                @if (item.itemNotes) {
                  <span class="text-[10px] text-slate-400 italic">📝 {{ item.itemNotes }}</span>
                }

                <!-- ITEM QUANTITY ADJUSTERS & VOID BUTTONS -->
                @if (item.status !== 'VOIDED') {
                  <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-1">
                    
                    <!-- QUANTITY ADJUST CONTROLS -->
                    <div class="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button (click)="adjustItemQuantity(item.id, -1)"
                              class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center active:scale-95 transition-all">
                        ➖
                      </button>
                      
                      <span class="text-xs font-black text-amber-400 px-2 min-w-[20px] text-center">
                        {{ item.quantity }}
                      </span>

                      <button (click)="adjustItemQuantity(item.id, 1)"
                              class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center active:scale-95 transition-all">
                        ➕
                      </button>
                    </div>

                    <!-- VOID / DELETE BUTTON -->
                    <button (click)="promptVoidItem(item)"
                            class="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1">
                      <span>🗑️</span>
                      <span>{{ item.status === 'PENDING' ? 'Διαγραφή' : 'Ακύρωση' }}</span>
                    </button>

                  </div>
                }

              </div>
            } @empty {
              <div class="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                <span class="text-3xl mb-2">☕</span>
                <span class="text-xs font-bold">Το τραπέζι είναι ελεύθερο</span>
              </div>
            }
          </div>

          <!-- KITCHEN ORDER-WIDE NOTE INPUT -->
          <div class="p-3 bg-slate-900 border border-slate-800 rounded-2xl my-3">
            <label class="block text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <span>📝</span>
              <span>Σημείωση Κουζίνας / Bar</span>
            </label>
            <input
              type="text"
              [(ngModel)]="currentOrderNotes"
              (ngModelChange)="onOrderNotesChange($event)"
              placeholder="π.χ. Αλλεργία σε ξηρούς καρπούς, φέρτε πρώτα τα ποτά..."
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <!-- ORDER TOTALS & TABLE CLOSING PAYMENT BUTTONS -->
          <div class="pt-3 border-t border-slate-700/80 flex flex-col gap-2 mt-2">
            <div class="flex justify-between items-center text-xs text-slate-400">
              <span>Καθαρή Αξία:</span>
              <span class="font-bold text-white">€{{ activeTable()?.activeOrder?.subtotalNet?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="flex justify-between items-center text-xs text-slate-400">
              <span>ΦΠΑ:</span>
              <span class="font-bold text-white">€{{ activeTable()?.activeOrder?.totalTax?.toFixed(2) || '0.00' }}</span>
            </div>
            <div class="flex justify-between items-center text-base font-black text-white pt-2 border-t border-slate-700">
              <span>Σύνολο:</span>
              <span class="text-2xl text-emerald-400">€{{ activeTable()?.activeOrder?.grandTotal?.toFixed(2) || '0.00' }}</span>
            </div>

            <!-- TABLE CLOSING PAYMENT ACTIONS -->
            @if ((activeTable()?.activeOrder?.grandTotal || 0) > 0) {
              <div class="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-700">
                <div class="grid grid-cols-2 gap-2">
                  <button (click)="settlePayment('CASH')"
                          class="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-white text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1">
                    <span>💵</span>
                    <span>Μετρητά</span>
                  </button>
                  <button (click)="settlePayment('CARD')"
                          class="py-3 rounded-xl bg-sky-600 hover:bg-sky-500 font-black text-white text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1">
                    <span>💳</span>
                    <span>Κάρτα</span>
                  </button>
                </div>
                
                <button (click)="printBill()"
                        class="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-amber-400 text-xs border border-amber-500/30 transition-all flex items-center justify-center gap-1">
                  <span>🧾</span>
                  <span>Εκτύπωση Λογαριασμού</span>
                </button>
              </div>
            }
          </div>

        </div>

      </div>

      <!-- MODAL: COFFEE & ITEM CUSTOMIZATION MODIFIER -->
      @if (selectedProductForCustomization(); as prod) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">☕ {{ prod.name }}</h3>
              <button (click)="selectedProductForCustomization.set(null)" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <!-- MODIFIER GROUPS -->
            <div class="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
              @for (group of modifierGroups; track group.groupTitle) {
                <div>
                  <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    {{ group.groupTitle }}
                  </span>
                  <div class="flex flex-wrap gap-2">
                    @for (mod of group.options; track mod.name) {
                      <button (click)="toggleModifier(mod)"
                              class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                              [ngClass]="isModifierSelected(mod) 
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm' 
                                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'">
                        {{ mod.name }} {{ (mod.priceExtra || 0) > 0 ? '(+' + (mod.priceExtra || 0).toFixed(2) + '€)' : '' }}
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- CUSTOM NOTES INPUT -->
              <div class="flex flex-col gap-1 mt-2">
                <label class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Σημείωση για την Κουζίνα</label>
                <input type="text" [(ngModel)]="customItemNotes" placeholder="π.χ. Πολύ ζεστός..."
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>
            </div>

            <!-- CONFIRM MODAL BUTTON -->
            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="selectedProductForCustomization.set(null)" 
                      class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs">
                Ακύρωση
              </button>
              <button (click)="confirmProductAdd()" 
                      class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md">
                Προσθήκη (€{{ calculateCustomizedPrice().toFixed(2) }})
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `
})
export class OrderTerminalComponent implements OnInit {
  public posService = inject(RestaurantPosService);
  public route = inject(ActivatedRoute);
  public router = inject(Router);

  public currentOrderNotes: string = '';

  public activeTableId = signal<string>('');
  public selectedCategoryId = signal<string>('ALL');
  public searchQuery = '';

  public selectedProductForCustomization = signal<Product | null>(null);
  public activeModifiers = signal<OrderModifier[]>([]);
  public customItemNotes = '';
  public modifierGroups = DEFAULT_COFFEE_MODIFIERS;

  public activeTable = computed(() => 
    this.posService.tables().find(t => t.id === this.activeTableId())
  );

  public filteredProducts = computed(() => {
    let list = this.posService.products().filter(p => p.isActive ?? true);
    
    if (this.selectedCategoryId() !== 'ALL') {
      list = list.filter(p => p.categoryId === this.selectedCategoryId());
    }

    if (this.searchQuery.trim()) {
      const clean = stripGreekAccents(this.searchQuery);
      list = list.filter(p => stripGreekAccents(p.name).includes(clean));
    }

    return list;
  });

  public onOrderNotesChange(note: string): void {
    const table = this.activeTable();
    if (table && table.activeOrder) {
      table.activeOrder.notes = note.trim();
    }
  }

  public setItemSpecificNote(item: TableOrderItem, noteText: string): void {
    item.itemNotes = noteText.trim();
  }

  public activeItemsCount = computed(() => {
    const items = this.activeTable()?.activeOrder?.items || [];
    return items.filter(i => i.status !== 'VOIDED').length;
  });

  public pendingItemsCount = computed(() => {
    const items = this.activeTable()?.activeOrder?.items || [];
    return items.filter(i => i.status === 'PENDING').length;
  });

  public hasPendingItems = computed(() => this.pendingItemsCount() > 0);

  ngOnInit(): void {
    const tableId = this.route.snapshot.paramMap.get('tableId');
    if (tableId) {
      this.activeTableId.set(tableId);
      const table = this.activeTable();
      if (table?.activeOrder?.notes) {
        this.currentOrderNotes = table.activeOrder.notes;
      }
    }
  }

public onProductClick(product: Product): void {
  const catId = (product.categoryId || '').toUpperCase();
  const catName = (product.categoryName || '').toUpperCase();
  const prodName = (product.name || '').toLowerCase();

  // 🎯 Updated check matching your exact Firestore DB structure
  const isCoffeeItem = 
    catId === 'CAT-COFFEE' ||
    catName === 'COFFEE' ||
    catName.includes('COFFEE') ||
    catName.includes('ΚΑΦΕ') ||
    prodName.includes('freddo') ||
    prodName.includes('espresso') ||
    prodName.includes('cappuccino') ||
    prodName.includes('latte') ||
    prodName.includes('nescafe') ||
    prodName.includes('frappe') ||
    prodName.includes('ελληνικ') ||
    (product.modifierGroupIds && product.modifierGroupIds.length > 0);

  if (isCoffeeItem) {
    // Opens the Decaf / Sugar / Milk customization modal
    this.selectedProductForCustomization.set(product);
    this.activeModifiers.set([]);
    this.customItemNotes = '';
  } else {
    // Direct add for non-coffee items
    this.posService.addOrderItemToTable(this.activeTableId(), product);
  }
}

  public toggleModifier(mod: OrderModifier): void {
    const current = this.activeModifiers();
    const exists = current.some(m => m.name === mod.name);
    if (exists) {
      this.activeModifiers.set(current.filter(m => m.name !== mod.name));
    } else {
      this.activeModifiers.set([...current, mod]);
    }
  }

  public isModifierSelected(mod: OrderModifier): boolean {
    return this.activeModifiers().some(m => m.name === mod.name);
  }

  public calculateCustomizedPrice(): number {
    const prod = this.selectedProductForCustomization();
    if (!prod) return 0;
    const extra = this.activeModifiers().reduce((sum, m) => sum + (m.priceExtra || 0), 0);
    return prod.price + extra;
  }

  public confirmProductAdd(): void {
    const prod = this.selectedProductForCustomization();
    if (prod) {
      this.posService.addOrderItemToTable(
        this.activeTableId(), 
        prod, 
        this.activeModifiers(), 
        this.customItemNotes
      );
      this.selectedProductForCustomization.set(null);
    }
  }

  public adjustItemQuantity(itemId: string, delta: number): void {
    this.posService.updateTableOrderItemQuantity(this.activeTableId(), itemId, delta);
  }

  public promptVoidItem(item: any): void {
    if (item.status === 'PENDING') {
      this.posService.voidTableOrderItem(this.activeTableId(), item.id, 'Διαγραφή πριν την αποστολή');
    } else {
      const reason = prompt(`Αιτιολογία ακύρωσης για ${item.productName}:`, 'Λάθος παραγγελία');
      if (reason !== null) {
        this.posService.voidTableOrderItem(this.activeTableId(), item.id, reason || 'Ακύρωση από σερβιτόρο');
      }
    }
  }

  public getItemStatusLabel(status: ItemPreparationStatus): string {
    switch (status) {
      case 'PENDING': return '⌛ Εκκρεμεί';
      case 'SENT_TO_KITCHEN': return '🍳 Κουζίνα';
      case 'PREPARING': return '👨‍🍳 Ετοιμάζεται';
      case 'SERVED': return '✓ Σερβιρίστηκε';
      case 'VOIDED': return '🚫 Ακυρώθηκε';
      default: return status;
    }
  }

  public getItemStatusBadgeClass(status: ItemPreparationStatus): string {
    switch (status) {
      case 'PENDING': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'SENT_TO_KITCHEN': return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
      case 'PREPARING': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40';
      case 'SERVED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'VOIDED': return 'bg-red-500/20 text-red-400 border-red-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }

  public getItemCardBorderClass(status: ItemPreparationStatus): string {
    switch (status) {
      case 'PENDING': return 'border-amber-500/40 bg-slate-900/90';
      case 'VOIDED': return 'border-red-900/60 bg-red-950/20 opacity-60';
      default: return 'border-slate-700 bg-slate-900/80';
    }
  }

  public sendOrder(): void {
    this.posService.sendOrderToKitchen(this.activeTableId());
    this.router.navigate(['/floor-plan']);
  }

  public settlePayment(method: 'CASH' | 'CARD'): void {
    this.posService.settleTablePayment(this.activeTableId(), method);
  }

  public printBill(): void {
    const table = this.activeTable();
    if (!table || !table.activeOrder) return;

    this.posService.markTableBillPrinted(table.id);

    const order = table.activeOrder;
    const dateStr = new Date().toLocaleString('el-GR');
    const activeItems = order.items.filter(i => i.status !== 'VOIDED');

    const printWin = window.open('', '_blank', 'width=400,height=600');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="el">
        <head>
          <meta charset="UTF-8">
          <title>Λογαριασμός - Τραπέζι #${table.number || table.tableNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 12px 4px;
              color: #000;
              font-size: 12px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .item-name { flex: 1; padding-right: 6px; word-break: break-word; }
            .item-price { text-align: right; min-width: 50px; font-weight: bold; }
            .totals-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 4px; }
            .header-title { font-size: 16px; font-weight: bold; }
            .mod-text { font-size: 10px; color: #444; display: block; padding-left: 10px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">🍊 MARANTH ESTIASI</div>
            <div>Καφέ - Εστιατόριο - Bar</div>
            <div>Τηλ: 210-0000000</div>
          </div>
          <div class="divider"></div>
          <div><strong>Τραπέζι:</strong> #${table.number || table.tableNumber} (${table.zone || table.section || 'Σάλα'})</div>
          <div><strong>Σερβιτόρος:</strong> ${table.assignedWaiterName || table.waiterName || 'Σερβιτόρος'}</div>
          <div><strong>Ημερομηνία:</strong> ${dateStr}</div>
          <div><strong>Αρ. Παραγγελίας:</strong> ${order.orderId}</div>
          ${order.notes ? `<div><strong>Σημείωση:</strong> ${order.notes}</div>` : ''}
          <div class="divider"></div>
          <div class="font-bold item-row">
            <span>Ποσ. Είδος</span>
            <span>Τιμή</span>
          </div>
          <div class="divider"></div>
          ${activeItems.map(item => `
            <div>
              <div class="item-row">
                <span class="item-name">${item.quantity}x ${item.productName}</span>
                <span class="item-price">€${(item.finalItemPrice * item.quantity).toFixed(2)}</span>
              </div>
              ${item.modifiers && item.modifiers.length > 0 ? `
                <span class="mod-text">+ ${item.modifiers.map(m => m.name).join(', ')}</span>
              ` : ''}
              ${item.itemNotes ? `
                <span class="mod-text">📝 ${item.itemNotes}</span>
              ` : ''}
            </div>
          `).join('')}
          <div class="divider"></div>
          <div class="item-row">
            <span>Καθαρή Αξία:</span>
            <span>€${(order.subtotalNet || 0).toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>ΦΠΑ (13%):</span>
            <span>€${(order.totalTax || 0).toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="totals-row">
            <span>ΣΥΝΟΛΟ:</span>
            <span>€${(order.grandTotal || 0).toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 10px;">
            *** ΠΡΟΣΩΡΙΝΟΣ ΛΟΓΑΡΙΑΣΜΟΣ ***<br>
            Ευχαριστούμε για την προτίμηση!
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  }
}