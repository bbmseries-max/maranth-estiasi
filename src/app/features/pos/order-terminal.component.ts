import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuSeederService } from '../../core/services/menu-seeder.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { ThermalPrinterService } from '../../core/services/thermal-printer.service';
import { 
  RestaurantTable, 
  TableOrderItem,
  Product, 
  ModifierGroup, 
  ModifierOption, 
  SelectedModifier
} from '../../core/modals';

@Component({
  selector: 'app-order-terminal',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterLink
  ],
  templateUrl: './order-terminal.component.html'
})
export class OrderTerminalComponent implements OnInit {
  private printerService = inject(ThermalPrinterService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tenantContext = inject(TenantContextService);
  private menuSeeder = inject(MenuSeederService);
  public posService = inject(RestaurantPosService);

  // State Signals
  public activeTableId = signal<string | null>(null);
  public selectedCategoryId = signal<string>('ALL');
  public searchQuery = '';
  public currentOrderNotes = '';

  // Modifier Modal Signals
  public selectedProductForModifiers = signal<Product | null>(null);
  public selectedModifierOptions = signal<Record<string, string[]>>({});

  // 🔒 Dynamic Reactive POS Signals
  public categories = computed(() => this.posService.categories());
  public products = computed(() => this.posService.products());

  public activeTable = computed<RestaurantTable | null>(() => {
    const id = this.activeTableId();
    if (!id) return null;
    return (this.posService.tables().find(t => t.id === id) as RestaurantTable) || null;
  });

  public getModalCalculatedPrice = computed<number>(() => {
    const prod = this.selectedProductForModifiers();
    if (!prod) return 0;

    let total = prod.price;
    const selections = this.selectedModifierOptions();
    const groups = this.activeModifierGroups();

    for (const group of groups) {
      const selectedIds = selections[group.id] || [];
      for (const optId of selectedIds) {
        const opt = group.options?.find((o: ModifierOption) => o.id === optId);
        if (opt?.priceExtra) {
          total += opt.priceExtra;
        }
      }
    }

    return Number(total.toFixed(2));
  });

  public filteredProducts = computed(() => {
    const catId = this.selectedCategoryId();
    let list = this.products();

    if (catId !== 'ALL') {
      list = list.filter(p => p.categoryId === catId);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    return list;
  });

  public pendingItemsCount = computed(() => {
    const items = this.activeTable()?.activeOrder?.items || [];
    return items.filter(i => i.status === 'PENDING').length;
  });

  public activeItemsCount = computed(() => {
    const items = this.activeTable()?.activeOrder?.items || [];
    return items.filter(i => i.status !== 'VOIDED').length;
  });

  ngOnInit(): void {
    const tableId = this.route.snapshot.paramMap.get('tableId');
    if (tableId) {
      this.activeTableId.set(tableId);
    }

    // 🔒 Only seed if in demo mode and inventory is completely empty
    const currentTenant = localStorage.getItem('active_tenant_id') || this.tenantContext.currentTenantId();
    if (currentTenant === 'coffee-shop-demo' && this.posService.products().length === 0) {
      this.menuSeeder.seedCoffeeShopTenant(false);
    }
  }

// --- DEFAULT COFFEE MODIFIERS FALLBACK ---
  private defaultCoffeeModifiers: ModifierGroup[] = [
    {
      id: 'grp_sweetness',
      name: 'Γλυκύτητα',
      required: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { id: 'opt_sketos', name: 'Σκέτος', priceExtra: 0 },
        { id: 'opt_metrios', name: 'Μέτριος', priceExtra: 0 },
        { id: 'opt_glykos', name: 'Γλυκός', priceExtra: 0 },
        { id: 'opt_stevia', name: 'Με Στέβια', priceExtra: 0 }
      ]
    },
    {
      id: 'grp_milk',
      name: 'Είδος Γάλακτος',
      required: false,
      minSelections: 0,
      maxSelections: 1,
      options: [
        { id: 'opt_regular', name: 'Κανονικό', priceExtra: 0 },
        { id: 'opt_oat', name: 'Βρώμης (Oat)', priceExtra: 0.40 },
        { id: 'opt_almond', name: 'Αμυγδάλου', priceExtra: 0.40 }
      ]
    },
    {
      id: 'grp_extra',
      name: 'Επιπλέον',
      required: false,
      minSelections: 0,
      maxSelections: 3,
      options: [
        { id: 'opt_decaf', name: 'Decaf', priceExtra: 0 },
        { id: 'opt_extra_shot', name: 'Extra Shot', priceExtra: 0.60 }
      ]
    }
  ];

  public activeModifierGroups = computed<ModifierGroup[]>(() => {
    const prod = this.selectedProductForModifiers();
    if (!prod) return [];

    const allGroups: ModifierGroup[] = this.posService.inventoryService.modifierGroups() || [];
    const matched = allGroups.filter((g: ModifierGroup) => prod.modifierGroupIds?.includes(g.id));

    // Check if item is coffee
    const isCoffeeItem = 
      prod.categoryName?.toLowerCase().includes('καφέ') || 
      prod.categoryName?.toLowerCase().includes('coffee') ||
      /espresso|freddo|cappuccino|latte|nescafe|frappe|ελληνικ/i.test(prod.name);

    if (matched.length === 0 && isCoffeeItem) {
      return this.defaultCoffeeModifiers;
    }

    return matched;
  });

  // --- PRODUCT & MODIFIER ACTIONS ---

  public onProductClick(product: Product): void {
    const tableId = this.activeTableId();
    if (!tableId) return;

    const isCoffeeItem = 
      product.categoryName?.toLowerCase().includes('καφέ') || 
      product.categoryName?.toLowerCase().includes('coffee') ||
      /espresso|freddo|cappuccino|latte|nescafe|frappe|ελληνικ/i.test(product.name);

    if ((product.modifierGroupIds && product.modifierGroupIds.length > 0) || isCoffeeItem) {
      this.openModifierModal(product);
    } else {
      this.posService.addProductToTableOrder(tableId, product);
    }
  }

  public openModifierModal(product: Product): void {
    this.selectedProductForModifiers.set(product);

    const initialSelections: Record<string, string[]> = {};
    const groups = this.activeModifierGroups();

    for (const group of groups) {
      if (group.required && group.options && group.options.length > 0) {
        initialSelections[group.id] = [group.options[0].id];
      } else {
        initialSelections[group.id] = [];
      }
    }

    this.selectedModifierOptions.set(initialSelections);
  }

  public closeModifierModal(): void {
    this.selectedProductForModifiers.set(null);
    this.selectedModifierOptions.set({});
  }

  public toggleModifierOption(groupId: string, optionId: string, maxSelections = 1): void {
    const current = { ...this.selectedModifierOptions() };
    const groupSelections = current[groupId] ? [...current[groupId]] : [];

    if (maxSelections === 1) {
      current[groupId] = [optionId];
    } else {
      const index = groupSelections.indexOf(optionId);
      if (index > -1) {
        groupSelections.splice(index, 1);
      } else if (groupSelections.length < maxSelections) {
        groupSelections.push(optionId);
      }
      current[groupId] = groupSelections;
    }

    this.selectedModifierOptions.set(current);
  }

  public isOptionSelected(groupId: string, optionId: string): boolean {
    return this.selectedModifierOptions()[groupId]?.includes(optionId) || false;
  }

  public confirmModifierSelection(): void {
    const tableId = this.activeTableId();
    const product = this.selectedProductForModifiers();
    if (!tableId || !product) return;

    const formattedModifiers: SelectedModifier[] = [];
    const selections = this.selectedModifierOptions();
    const groups = this.activeModifierGroups();

    for (const group of groups) {
      const selectedIds = selections[group.id] || [];
      for (const optId of selectedIds) {
        const opt = group.options?.find((o: ModifierOption) => o.id === optId);
        if (opt) {
          formattedModifiers.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceExtra: opt.priceExtra || 0
          });
        }
      }
    }

    this.posService.addProductToTableOrder(tableId, {
      ...product,
      price: this.getModalCalculatedPrice(),
      selectedModifiers: formattedModifiers
    });

    this.closeModifierModal();
  }
  // --- TABLE ACTIONS ---

  public hasPendingItems(): boolean {
    return this.pendingItemsCount() > 0;
  }

  public sendOrder(): void {
    const tableId = this.activeTableId();
    if (tableId) {
      this.posService.sendOrderToKitchen(tableId);
    }
  }

  public adjustItemQuantity(itemId: string, delta: number): void {
    const tableId = this.activeTableId();
    if (tableId) {
      this.posService.updateOrderItemQuantity(tableId, itemId, delta);
    }
  }

  public promptVoidItem(item: TableOrderItem): void {
    const tableId = this.activeTableId();
    if (!tableId) return;

    if (item.status === 'PENDING') {
      this.posService.removeOrderItem(tableId, item.id);
    } else {
      const reason = prompt('Αιτιολογία ακύρωσης προϊόντος:');
      if (reason) {
        this.posService.voidOrderItem(tableId, item.id, reason);
      }
    }
  }

  public onOrderNotesChange(notes: string): void {
    const tableId = this.activeTableId();
    if (tableId) {
      this.posService.updateOrderNotes(tableId, notes);
    }
  }
  
  public async settlePayment(method: 'CASH' | 'CARD'): Promise<void> {
    const tableId = this.activeTableId();
    if (!tableId) return;

    // ⛔ STRICT GUARD: Block settlement if items haven't been sent to the kitchen/bar
    if (this.hasPendingItems()) {
      alert(
        `⛔ ΑΠΑΓΟΡΕΥΕΤΑΙ Η ΕΞΟΦΛΗΣΗ!\n\n` +
        `Υπάρχουν ${this.pendingItemsCount()} προϊόντα που δεν έχουν σταλεί στην κουζίνα / bar.\n` +
        `Παρακαλώ πατήστε πρώτα "Αποστολή" στην κουζίνα πριν την είσπραξη!`
      );
      return;
    }

    const table = this.activeTable();
    const activeItems = (table?.activeOrder?.items || []).filter(i => i.status !== 'VOIDED');
    if (activeItems.length === 0) {
      alert('⚠️ Δεν υπάρχουν ενεργά προϊόντα στο τραπέζι για εξόφληση.');
      return;
    }

    try {
      await this.posService.settleTablePayment(tableId, method);
    } catch (err) {
      console.error('Payment error:', err);
    }
    this.router.navigate(['/floor-plan'], { replaceUrl: true });
  }

  public printBill(): void {
  const table = this.activeTable();
  if (!table) return;

  const items = table.activeOrder?.items || [];
  const total = Number(table.activeOrder?.grandTotal || table.currentTotal || 0);
  const waiter = table.waiterName || this.posService.currentEmployee()?.name || 'Σερβιτόρος';

  if (items.length === 0 || total <= 0) {
    alert('⚠️ Δεν υπάρχουν προϊόντα στην παραγγελία για εκτύπωση λογαριασμού.');
    return;
  }

  // 1. Trigger thermal receipt print window
  this.printerService.printTableBillReceipt(
    table.number || table.tableNumber || 1,
    table.name || `Τραπέζι ${table.number}`,
    items,
    total,
    waiter
  );

  // 2. Mark table status as BILL_PRINTED in Firestore & local state
  this.posService.printTableBill(table.id);
}

  // --- STYLING HELPERS ---
  public getItemCardBorderClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'border-amber-500/40 bg-amber-950/10';
      case 'SENT_TO_KITCHEN': return 'border-sky-500/40 bg-sky-950/10';
      case 'PREPARING': return 'border-orange-500/40 bg-orange-950/10';
      case 'SERVED': return 'border-emerald-500/40 bg-emerald-950/10';
      case 'VOIDED': return 'border-red-500/30 bg-red-950/10 opacity-60';
      default: return 'border-slate-800';
    }
  }

  public getItemStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'SENT_TO_KITCHEN': return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'PREPARING': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'SERVED': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'VOIDED': return 'bg-red-500/20 text-red-400 border-red-500/40';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  }

  public getItemStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'Εκκρεμεί';
      case 'SENT_TO_KITCHEN': return 'Στην Κουζίνα';
      case 'PREPARING': return 'Ετοιμάζεται';
      case 'SERVED': return 'Σερβιρίστηκε';
      case 'VOIDED': return 'Ακυρώθηκε';
      default: return status;
    }

  }
}