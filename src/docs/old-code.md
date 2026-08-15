 public loginWithPin(pin: string): { success: boolean; message: string; employee?: Employee } {
    const cleanPin = pin.trim();
    const emp = this.employees().find(
      e => (e.pinCode === cleanPin || e.pin === cleanPin) && (e.isActive ?? e.active ?? true)
    );

    if (emp) {
      this.setLoggedInEmployee(emp);
      return { success: true, message: 'Επιτυχής είσοδος', employee: emp };
    }
    return { success: false, message: 'Λανθασμένο PIN ή ανενεργός υπάλληλος.' };
  }

  order-grid
  import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../core/services/menu.service';
import { Product, Category } from '../../core/models/restaurant-pos.models';
import { TenantContextService } from '../../core/services/tenant-context.service';


@Component({
  selector: 'app-order-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-grid.Component.html'
})

export class OrderGridComponent implements OnInit {
  private menuService = inject(MenuService);
  public tenantContext = inject(TenantContextService);

  // Component Signals
  public categories = signal<Category[]>([]);
  public products = signal<Product[]>([]);
  public selectedCategoryId = signal<string | null>(null);

  ngOnInit() {
    // 1. Fetch Categories for active tenant
    this.menuService.getCategories().subscribe(cats => {
      this.categories.set(cats);
      if (cats.length > 0 && !this.selectedCategoryId()) {
        this.selectedCategoryId.set(cats[0].id); // Auto-select first category
      }
    });

    // 2. Fetch Products for active tenant
    this.menuService.getProducts().subscribe(prods => {
      this.products.set(prods);
    });
  }

  public selectCategory(catId: string): void {
    this.selectedCategoryId.set(catId);
  }

  // Filter products matching current category
  public filteredProducts(): Product[] {
    const catId = this.selectedCategoryId();
    if (!catId) return this.products();
    return this.products().filter(p => p.categoryId === catId);
  }
}

html
<div class="flex flex-col h-full bg-slate-900 text-white p-4">
  
  <!-- Active Tenant Badge -->
  <div class="mb-4 flex items-center justify-between border-b border-slate-700 pb-2">
    <span class="text-xs uppercase font-bold tracking-wider text-slate-400">Active Tenant:</span>
    <span class="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-full font-mono">
      {{ tenantContext.currentTenantId() }}
    </span>
  </div>

<!-- 2-LINE FULL-WIDTH WRAPPED GRID -->
<div class="w-full min-w-0 max-w-full bg-slate-900 border-b border-slate-800 p-2 shrink-0">
  
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 w-full max-h-28 overflow-y-auto">
    
    <!-- "ALL" BUTTON -->
    <button (click)="selectedCategoryId.set('ALL')"
            type="button"
            class="w-full py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center truncate"
            [ngClass]="selectedCategoryId() === 'ALL' 
              ? 'bg-amber-500 text-slate-950 border-2 border-amber-400 shadow-amber-500/20' 
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'">
      🌐 Όλα
    </button>

    <!-- CATEGORIES LOOP -->
    @for (cat of categories(); track cat.id) {
      <button (click)="selectedCategoryId.set(cat.id)"
              type="button"
              class="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center truncate"
              [ngClass]="selectedCategoryId() === cat.id 
                ? 'bg-amber-500 text-slate-950 font-black border-2 border-amber-400 shadow-amber-500/20' 
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'">
        {{ cat.name }}
      </button>
    }

  </div>
</div>

  <!-- Product Touch Grid -->
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 flex-1 overflow-y-auto">
    @for (product of filteredProducts(); track product.id) {
      <button 
        class="flex flex-col justify-between p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition shadow text-left h-28">
        <span class="font-bold text-sm text-slate-100 line-clamp-2">{{ product.name }}</span>
        <div class="flex justify-between items-center w-full mt-2">
          <span class="text-xs text-slate-400 font-mono">VAT {{ product.taxRate }}%</span>
          <span class="text-amber-400 font-extrabold text-base">€{{ product.price.toFixed(2) }}</span>
        </div>
      </button>
    } @empty {
      <div class="col-span-full flex items-center justify-center text-slate-500 py-12">
        No products found in this category.
      </div>
    }
  </div>

</div>

export interface Employee {
  id: string;
  storeId: string;
  name: string;
  pinCode: string;
  pin?: string;
  role: Role;
  hourlyRate: number;
  isActive: boolean;
  active?: boolean;
  createdAt?: string;
  biometricPublicKey?: string;
  tenantId: string;
}

  public addOrderItemToTable(tableId: string, product: Product, modifiers: OrderModifier[] = [], notes: string = ''): void {
    const waiter = this.currentEmployee();
    this.tableOrderService.addOrderItemToTable(tableId, product, modifiers, notes, waiter);
    this.inventoryService.deductRecipeIngredients(product, 1);
  }

    public async settleTablePayment(
    tableId: string, 
    paymentMethod: 'CASH' | 'CARD' | 'DEBT',
    targetWaiterVaultId?: string
  ): Promise<void> {
    const currentEmp = this.currentEmployee();

    // ⛔ GUARD 1: Block ghost users with no active session
    if (!currentEmp) {
      alert('⚠️ Δεν υπάρχει συνδεδεμένος χρήστης. Παρακαλώ συνδεθείτε με το PIN σας.');
      this.logoutEmployee();
      return;
    }

    const table = this.tables().find(t => t.id === tableId);
    const activeOrder = table?.activeOrder;

    // ⛔ GUARD 2: Kitchen Unsent Items Check
    if (activeOrder && activeOrder.items) {
      const unsentItems = activeOrder.items.filter(item => item.status === 'PENDING');
      if (unsentItems.length > 0) {
        alert(
          `⚠️ Υπάρχουν ${unsentItems.length} προϊόντα που δεν έχουν σταλεί στην κουζίνα!\n\nΠαρακαλώ πατήστε "Αποστολή" στην κουζίνα πριν την εξόφληση.`
        );
        return;
      }
    }

    // ⛔ GUARD 3: Must have an active open vault (NO SILENT PHANTOM VAULTS)
    const activeVaults = this.activeVaultSessions();
    let targetVault: WaiterVaultSession | null | undefined = targetWaiterVaultId 
      ? activeVaults.find(v => v.id === targetWaiterVaultId && v.status === 'OPEN')
      : activeVaults.find(v => v.waiterId === currentEmp.id && v.status === 'OPEN')
        || activeVaults.find(v => v.waiterName === currentEmp.name && v.status === 'OPEN')
        || this.activeVaultSession();

    if (!targetVault && activeVaults.length > 0) {
      targetVault = activeVaults[0];
    }

    if (!targetVault) {
      alert('⚠️ Δεν βρέθηκε ενεργό ανοιχτό ταμείο για την καταχώρηση της είσπραξης. Παρακαλώ ανοίξτε ταμείο/βάρδια.');
      return;
    }

    // Deduct stock for settled items
    if (activeOrder && activeOrder.items) {
      activeOrder.items.forEach(orderItem => {
        const matchingProd = this.products().find(p => p.id === orderItem.productId);
        if (matchingProd) {
          this.deductRecipeIngredients(matchingProd, orderItem.quantity);
        }
      });
    }
    
    return this.tableOrderService.settleTablePayment(tableId, paymentMethod, currentEmp, (sale) => {
      const addedCash = paymentMethod === 'CASH' ? (sale.grandTotal || 0) : 0;
      const addedCard = paymentMethod === 'CARD' ? (sale.grandTotal || 0) : 0;

      const updatedVault: WaiterVaultSession = {
        ...targetVault!,
        cashCollected: Number(((targetVault!.cashCollected || 0) + addedCash).toFixed(2)),
        cardCollected: Number(((targetVault!.cardCollected || 0) + addedCard).toFixed(2))
      };

      this.allVaultSessions.update(list => list.map(v => v.id === targetVault!.id ? updatedVault : v));
      this.activeVaultSessions.update(list => list.map(v => v.id === targetVault!.id ? updatedVault : v));
      
      if (this.activeVaultSession()?.id === targetVault!.id) {
        this.activeVaultSession.set(updatedVault);
      }

      if (this.db) {
        setDoc(doc(this.db, 'vaults', targetVault!.id), cleanUndefined(updatedVault), { merge: true }).catch(() => {});
      }

      this.logAudit(
        'PAYMENT_RECEIVED', 
        `Εξόφληση €${sale.grandTotal.toFixed(2)} (${paymentMethod}) - Τραπέζι #${sale.tableNumber} [Ταμείο: ${targetVault!.waiterName}]`, 
        sale.tableNumber
      );
    });
  }

  