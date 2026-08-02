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
  stripGreekAccents 
} from '../../core/models/restaurant-pos.models';

const DEFAULT_COFFEE_MODIFIERS = [
  {
    groupTitle: 'Γλυκύτητα',
    options: [
      { id: 'MOD-SKETOS', name: 'Σκέτος', priceExtra: 0 },
      { id: 'MOD-METRIOS', name: 'Μέτριος', priceExtra: 0 },
      { id: 'MOD-GLYKOS', name: 'Γλυκός', priceExtra: 0 },
      { id: 'MOD-STEVIA', name: 'Στέβια', priceExtra: 0 }
    ]
  },
  {
    groupTitle: 'Είδος Γάλακτος',
    options: [
      { id: 'MOD-MILK-FULL', name: 'Πλήρες Γάλα', priceExtra: 0 },
      { id: 'MOD-MILK-LIGHT', name: 'Ελαφρύ 1.5%', priceExtra: 0 },
      { id: 'MOD-MILK-OAT', name: 'Γάλα Βρώμης', priceExtra: 0.30 },
      { id: 'MOD-MILK-ALMOND', name: 'Γάλα Αμυγδάλου', priceExtra: 0.30 }
    ]
  },
  {
    groupTitle: 'Έξτρα',
    options: [
      { id: 'MOD-EXTRA-SHOT', name: 'Έξτρα Δόση Espresso', priceExtra: 0.60 },
      { id: 'MOD-DECAF', name: 'Decaf', priceExtra: 0 }
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
            <h1 class="text-lg font-black text-white m-0">Τραπέζι #{{ activeTable()?.tableNumber }}</h1>
            <span class="text-[10px] text-amber-400 font-bold">📍 Ζώνη: {{ activeTable()?.zone }}</span>
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
                  [disabled]="!activeTable()?.activeOrder?.items?.length"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95">
            <span>🍳</span>
            <span>Αποστολή</span>
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
                  <span class="text-xs text-slate-400 font-semibold">{{ product.taxRate }}% ΦΠΑ</span>
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

        <!-- RIGHT: ACTIVE TICKET BASKET -->
        <div class="w-full lg:w-96 bg-slate-800/95 border-t lg:border-t-0 lg:border-l border-slate-700/80 flex flex-col p-4 shadow-2xl">
          
          <div class="flex justify-between items-center border-b border-slate-700 pb-3 mb-3">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Λογαριασμός Τραπεζιού</span>
            <span class="text-xs font-bold text-amber-400">
              {{ activeTable()?.activeOrder?.items?.length || 0 }} είδη
            </span>
          </div>

          <!-- TICKET ITEMS LIST -->
          <div class="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
            @for (item of activeTable()?.activeOrder?.items; track item.id) {
              <div class="bg-slate-900/80 border border-slate-700 rounded-2xl p-3 flex flex-col gap-1">
                <div class="flex justify-between items-start">
                  <span class="text-xs font-bold text-white">{{ item.productName }}</span>
                  <span class="text-xs font-black text-emerald-400">€{{ (item.finalItemPrice * item.quantity).toFixed(2) }}</span>
                </div>

                <!-- MODIFIERS & NOTES SUMMARY -->
                @if (item.modifiers && item.modifiers.length > 0) {
                  <div class="flex flex-wrap gap-1 mt-0.5">
                    @for (mod of item.modifiers; track mod.id) {
                      <span class="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full border border-slate-700">
                        + {{ mod.name }}
                      </span>
                    }
                  </div>
                }

                @if (item.itemNotes) {
                  <span class="text-[10px] text-slate-400 italic">📝 {{ item.itemNotes }}</span>
                }
              </div>
            } @empty {
              <div class="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
                <span class="text-3xl mb-2">☕</span>
                <span class="text-xs font-bold">Το τραπέζι δεν έχει παραγγελία</span>
              </div>
            }
          </div>

          <!-- ORDER TOTALS FOOTER -->
          <div class="pt-4 border-t border-slate-700/80 flex flex-col gap-2 mt-2">
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
                    @for (mod of group.options; track mod.id) {
                      <button (click)="toggleModifier(mod)"
                              class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                              [ngClass]="isModifierSelected(mod) 
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm' 
                                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'">
                        {{ mod.name }} {{ mod.priceExtra > 0 ? '(+' + mod.priceExtra.toFixed(2) + '€)' : '' }}
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
    let list = this.posService.products().filter(p => p.isActive);
    
    if (this.selectedCategoryId() !== 'ALL') {
      list = list.filter(p => p.categoryId === this.selectedCategoryId());
    }

    if (this.searchQuery.trim()) {
      const clean = stripGreekAccents(this.searchQuery);
      list = list.filter(p => stripGreekAccents(p.name).includes(clean));
    }

    return list;
  });

  ngOnInit(): void {
    const tableId = this.route.snapshot.paramMap.get('tableId');
    if (tableId) {
      this.activeTableId.set(tableId);
    }
  }

  public onProductClick(product: Product): void {
    if (product.categoryId === 'CAT-COFFEE' || product.modifierGroupIds?.length) {
      this.selectedProductForCustomization.set(product);
      this.activeModifiers.set([]);
      this.customItemNotes = '';
    } else {
      this.posService.addOrderItemToTable(this.activeTableId(), product);
    }
  }

  public toggleModifier(mod: OrderModifier): void {
    const current = this.activeModifiers();
    const exists = current.some(m => m.id === mod.id);
    if (exists) {
      this.activeModifiers.set(current.filter(m => m.id !== mod.id));
    } else {
      this.activeModifiers.set([...current, mod]);
    }
  }

  public isModifierSelected(mod: OrderModifier): boolean {
    return this.activeModifiers().some(m => m.id === mod.id);
  }

  public calculateCustomizedPrice(): number {
    const prod = this.selectedProductForCustomization();
    if (!prod) return 0;
    const extra = this.activeModifiers().reduce((sum, m) => sum + m.priceExtra, 0);
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

  public sendOrder(): void {
    this.posService.sendOrderToKitchen(this.activeTableId());
    this.router.navigate(['/floor-plan']);
  }
}