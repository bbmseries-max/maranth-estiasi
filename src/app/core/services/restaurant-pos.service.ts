// src/app/core/services/restaurant-pos.service.ts

import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MenuSeederService } from './menu-seeder.service';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe 
} from 'firebase/firestore';

import { InventoryService } from './inventory.service';
import { AuthShiftService } from './auth-shift.service';
import { TableOrderService } from './table-order.service';
import { TenantContextService } from './tenant-context.service';

// Unified Barrel Export Import
import { 
  Employee,
  Role,
  Product, 
  OrderModifier, 
  Table, 
  DailyZReportSnapshot, 
  AuditLog, 
  WaiterVaultSession, 
  SaleRecord,
  UnitOfMeasure,
  GreekVatRate,
  ItemPreparationStatus 
} from '../modals';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDnixK-3v_bAjCFhvB6diDNp6eXoC2V4_c",
  authDomain: "maranth-estiasi.firebaseapp.com",
  projectId: "maranth-estiasi",
  storageBucket: "maranth-estiasi.firebasestorage.app",
  messagingSenderId: "927547122917",
  appId: "1:927547122917:web:7f6ab240c6e2f58967e00c"
};

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const copy: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      copy[key] = cleanUndefined(obj[key]);
    }
  }
  return copy;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantPosService {
  private menuSeeder = inject(MenuSeederService);
  private tenantContext = inject(TenantContextService);
  public db: any = null;
  private router = inject(Router);

  // Active Listeners Lifecycle Trackers
  private activeVaultsUnsub: Unsubscribe | null = null;
  private salesUnsub: Unsubscribe | null = null;
  private zReportsUnsub: Unsubscribe | null = null;

  // Sub-Services Injection
  public inventoryService = inject(InventoryService);
  public authShiftService = inject(AuthShiftService);
  public tableOrderService = inject(TableOrderService);

  // --- PASS-THROUGH SIGNALS ---
  public rawMaterials = this.inventoryService.rawMaterials;
  public categories = this.inventoryService.categories;
  public products = this.inventoryService.products;
  public spoilageLogs = this.inventoryService.spoilageLogs;

  // Delegate employees signal directly to AuthShiftService
  public employees = this.authShiftService.employees;
  public currentEmployee = this.authShiftService.currentEmployee;
  public workShifts = this.authShiftService.workShifts;
  public activeWorkShift = this.authShiftService.activeWorkShift;
  public canManageSystem = this.authShiftService.canManageSystem;

  public tables = this.tableOrderService.tables;
  public activeOrders = this.tableOrderService.activeOrders;
  public unreadReadyNotifications = this.tableOrderService.unreadReadyNotifications;
  public occupiedTables = this.tableOrderService.occupiedTables;

  // --- OCCUPIED TABLES COUNT ---
// --- OCCUPIED TABLES COUNT ---
  public occupiedTablesCount = computed(() => {
    const currentTenant = this.tenantContext.currentTenantId();
    const tablesList = this.tables();
    
    // 1. Count occupied tables
    const occupiedFromTables = tablesList.filter(t => {
      const matchTenant = !t.tenantId || t.tenantId === currentTenant;
      const isOccupied = t.status !== 'FREE' && t.status !== 'AVAILABLE';
      return matchTenant && isOccupied;
    }).length;

    // 2. Fallback: check activeOrders length
    if (occupiedFromTables === 0 && this.activeOrders().length > 0) {
      return this.activeOrders().length;
    }

    return occupiedFromTables;
  });

  // --- LIVE FLOOR REVENUE CALCULATION ---
 // --- LIVE FLOOR REVENUE CALCULATION ---
  public totalLiveFloorRevenue = computed(() => {
    const currentTenant = this.tenantContext.currentTenantId();
    let total = 0;

    // 1. Inspect Table Embedded Active Orders
    const storeTables = this.tables().filter(t => !t.tenantId || t.tenantId === currentTenant);

    for (const table of storeTables) {
      if (table.status === 'FREE' || table.status === 'AVAILABLE') {
        continue;
      }

      const orderObj = (table as any).activeOrder || (table as any).currentOrder || (table as any).order;
      const itemsList = orderObj?.items || (table as any).items || [];

      if (Array.isArray(itemsList) && itemsList.length > 0) {
        for (const item of itemsList) {
          if (item && item.status !== 'VOIDED' as any) {
            const rawPrice = item.finalItemPrice ?? item.unitPrice ?? item.price ?? item.productPrice ?? 0;
            const price = Number(rawPrice) || 0;
            const qty = Number(item.quantity || item.qty || 1);
            total += price * qty;
          }
        }
      } else if (orderObj && typeof orderObj.total === 'number' && orderObj.total > 0) {
        total += Number(orderObj.total);
      }
    }

    // 2. Fallback: If table items were not attached directly to table objects, inspect activeOrders()
    if (total === 0 && this.activeOrders().length > 0) {
      const orders = this.activeOrders().filter(o => !o.tenantId || o.tenantId === currentTenant);

      for (const order of orders) {
        if (Array.isArray(order.items) && order.items.length > 0) {
          for (const item of order.items) {
            if (item && item.status !== 'VOIDED' as any) {
              const rawPrice = item.finalItemPrice ?? item.unitPrice ?? item.unitPrice ?? 0;
              const price = Number(rawPrice) || 0;
              const qty = Number(item.quantity || 1);
              total += price * qty;
            }
          }
        } else if (typeof (order as any).total === 'number') {
          total += Number((order as any).total);
        }
      }
    }

    return Number(total.toFixed(2));
  });

  // Alias for template bindings
  public liveFloorRevenue = computed(() => this.totalLiveFloorRevenue());

  // --- FINANCIAL & REPORTING SIGNALS ---
  public allVaultSessions = signal<WaiterVaultSession[]>([]);
  public activeVaultSessions = signal<WaiterVaultSession[]>([]);
  public activeVaultSession = signal<WaiterVaultSession | null>(null);
  public auditLogs = signal<AuditLog[]>([]);
  public zReports = signal<DailyZReportSnapshot[]>([]);
  public salesHistory = signal<SaleRecord[]>([]);

  // Computed Financial Metrics
  public totalDailyCashInVaults = computed(() => {
    return this.allVaultSessions().reduce((acc, v) => acc + (v.cashCollected || 0), 0);
  });

  public totalDailyCardInVaults = computed(() => {
    return this.allVaultSessions().reduce((acc, v) => acc + (v.cardCollected || 0), 0);
  });

  public totalDailyStartingFloats = computed(() => {
    return this.allVaultSessions().reduce((acc, v) => acc + (v.startingFloat || 0), 0);
  });

  public totalDailyGrossSales = computed(() => {
    const settledSalesTotal = this.salesHistory().reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    return settledSalesTotal + this.totalLiveFloorRevenue();
  });

  // Template Aliases
  public totalCashInVaults = computed(() => this.totalDailyCashInVaults());
  public totalCardInVaults = computed(() => this.totalDailyCardInVaults());
  public totalStartingFloats = computed(() => this.totalDailyStartingFloats());
  public totalGrossSales = computed(() => this.totalDailyGrossSales());

  public vatBreakdown = computed(() => {
    let gross13 = 0; let net13 = 0; let vat13 = 0;
    let gross24 = 0; let net24 = 0; let vat24 = 0;
    let gross6 = 0;  let net6 = 0;  let vat6 = 0;

    const sales = this.salesHistory();

    for (const sale of sales) {
      if (!sale.items || sale.items.length === 0) {
        const gross = sale.grandTotal || 0;
        const net = gross / 1.13;
        gross13 += gross;
        net13 += net;
        vat13 += (gross - net);
        continue;
      }

      for (const item of sale.items) {
        if (item.status === 'VOIDED') continue;

        const itemGross = (item.finalItemPrice || item.unitPrice || item.unitPrice || 0) * (item.quantity || 1);
        const rate = Number(item.taxRate) || 13;

        if (rate === 24) {
          const net = itemGross / 1.24;
          gross24 += itemGross;
          net24 += net;
          vat24 += (itemGross - net);
        } else if (rate === 6) {
          const net = itemGross / 1.06;
          gross6 += itemGross;
          net6 += net;
          vat6 += (itemGross - net);
        } else {
          const net = itemGross / 1.13;
          gross13 += itemGross;
          net13 += net;
          vat13 += (itemGross - net);
        }
      }
    }

    const totalGross = gross13 + gross24 + gross6;
    const totalNet = net13 + net24 + net6;
    const totalVat = vat13 + vat24 + vat6;

    return {
      totalGross: Number(totalGross.toFixed(2)),
      gross13: Number(gross13.toFixed(2)),
      net13: Number(net13.toFixed(2)),
      vat13: Number(vat13.toFixed(2)),
      gross24: Number(gross24.toFixed(2)),
      net24: Number(net24.toFixed(2)),
      vat24: Number(vat24.toFixed(2)),
      gross6: Number(gross6.toFixed(2)),
      net6: Number(net6.toFixed(2)),
      vat6: Number(vat6.toFixed(2)),
      totalNet: Number(totalNet.toFixed(2)),
      totalVat: Number(totalVat.toFixed(2))
    };
  });

  // Alias for VAT
  public vatData = computed(() => this.vatBreakdown());

  constructor() {
    try {
      const app = initializeApp(DEFAULT_FIREBASE_CONFIG);
      this.db = getFirestore(app);

      // Initialize Modular Sync Services
      this.inventoryService.initFirestoreSync(this.db);
      this.authShiftService.initFirestoreSync(this.db);
      this.tableOrderService.initFirestoreSync(this.db, () => this.currentEmployee());
      this.initVaultsSync();
      this.initFinancialListeners();
    } catch (e) {
      console.error('Firebase initialization error:', e);
    }
  }

 public reconnectActiveStoreSync(emp?: Employee): void {
    if (!this.db) return;
    this.inventoryService.initFirestoreSync(this.db);
    this.authShiftService.initFirestoreSync(this.db);
    this.tableOrderService.initFirestoreSync(this.db, () => emp || this.currentEmployee());
    this.initVaultsSync();
    this.initFinancialListeners();
  }

  /**
   * Safe Dynamic Resolver for Tenant ID & Store ID (Priority: Employee -> localStorage -> signal)
   */
  public getActiveTenantAndStore(): { tenantId: string; storeId: string } {
    const tenantId = 
      this.currentEmployee()?.tenantId ||
      localStorage.getItem('active_tenant_id') ||
      (this.tenantContext as any).currentTenantId?.() || 
      (this.tenantContext as any).tenantId?.() || 
      'coffee-shop-demo';

    const storeId = 
      this.currentEmployee()?.storeId ||
      localStorage.getItem('active_store_id') ||
      (this.tenantContext as any).currentStoreId?.() || 
      (this.tenantContext as any).activeStoreId?.() || 
      (this.tenantContext as any).storeId?.() || 
      'store-1';

    return { tenantId, storeId };
  }

  // --- NOTIFICATION DELEGATES ---
  public clearAllNotifications(): void {
    this.tableOrderService.clearAllNotifications();
  }

  public dismissNotification(idOrIndex: string | number): void {
    this.tableOrderService.dismissNotification(idOrIndex);
  }

  // --- AUTH & STAFF DELEGATES ---
  public loginWithPin(pin: string): Employee | null {
    const emp = this.authShiftService.loginWithPin(pin);
    if (emp) {
      this.setLoggedInEmployee(emp);
    }
    return emp;
  }

 public setLoggedInEmployee(emp: Employee): void {
    this.tableOrderService.clearAllNotifications();
    this.authShiftService.setLoggedInEmployee(emp);
    this.logAudit('CLOCK_IN', `Είσοδος στο σύστημα (${emp.name} - ${emp.role})`);

    // Reconnect Firestore listeners with employee's specific tenant & store
    this.reconnectActiveStoreSync(emp);

    // Check if open vault session exists
    const existingVault = this.activeVaultSessions().find(
      v => (v.waiterId === emp.id || v.waiterId === emp.pin || v.waiterName === emp.name) && v.status === 'OPEN'
    );

    if (!existingVault) {
      this.openWaiterVault(50);
    } else {
      this.activeVaultSession.set(existingVault);
    }
  }

  public logoutEmployee(): void {
    this.authShiftService.logoutEmployee();
  }

  public clockInShift(notes?: string): void {
    this.authShiftService.clockInShift(notes);
  }

  public getEmployeeActiveShift(empId: string) {
    return this.authShiftService.getEmployeeActiveShift(empId);
  }

  public addEmployee(data: { name: string; pinCode: string; role: Role; hourlyRate: number }) {
    return this.authShiftService.addEmployee(data);
  }

  public updateEmployee(emp: Employee) {
    return this.authShiftService.updateEmployee(emp);
  }

  public toggleEmployeeActiveStatus(id: string, active: boolean) {
    return this.authShiftService.toggleEmployeeActiveStatus(id, active);
  }

  public registerEmployeeBiometrics(emp: Employee) {
    return this.authShiftService.registerEmployeeBiometrics(emp);
  }

  public getRoleLabel(role?: string): string {
    switch (role?.toUpperCase()) {
      case 'MANAGER':
      case 'ADMIN':
      case 'OWNER': return 'Διαχειριστής / Manager';
      case 'WAITER': return 'Σερβιτόρος';
      case 'KITCHEN':
      case 'CHEF': return 'Κουζίνα';
      case 'BAR':
      case 'BARISTA':
      case 'BARMAN': return 'Barista / Μπαρ';
      default: return role || 'Υπάλληλος';
    }
  }

  // --- CATEGORIES & PRODUCTS DELEGATES ---

  public async seedDefaultMenuForCurrentStore(): Promise<void> {
    const tenantId = this.tenantContext.currentTenantId();
    const storeId = this.tenantContext.currentStoreId();

    const starterCategories = [
      { id: `${storeId}_cat_coffee`, name: 'Καφέδες & Ροφήματα', code: 'COFFEE', icon: '☕', order: 1, tenantId, storeId },
      { id: `${storeId}_cat_drinks`, name: 'Αναψυκτικά & Χυμοί', code: 'DRINKS', icon: '🥤', order: 2, tenantId, storeId },
      { id: `${storeId}_cat_food`, name: 'Σνακ & Φαγητό', code: 'FOOD', icon: '🥪', order: 3, tenantId, storeId },
      { id: `${storeId}_cat_bar`, name: 'Μπύρες & Ποτά', code: 'BAR', icon: '🍺', order: 4, tenantId, storeId }
    ];

    const starterProducts: Product[] = [
      { id: `${storeId}_prod_1`, name: 'Espresso', price: 1.80, categoryId: 'COFFEE', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_2`, name: 'Espresso Double', price: 2.20, categoryId: 'COFFEE', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_3`, name: 'Freddo Espresso', price: 2.30, categoryId: 'COFFEE', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_4`, name: 'Cappuccino', price: 2.50, categoryId: 'COFFEE', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_5`, name: 'Freddo Cappuccino', price: 2.70, categoryId: 'COFFEE', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_6`, name: 'Ελληνικός Διπλός', price: 2.00, categoryId: 'COFFEE', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_7`, name: 'Φυσικός Χυμός Πορτοκάλι', price: 3.50, categoryId: 'DRINKS', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_8`, name: 'Τοστ Γαλοπούλα - Κασέρι', price: 2.80, categoryId: 'FOOD', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_9`, name: 'Club Sandwich Classic', price: 6.50, categoryId: 'FOOD', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_10`, name: 'Μπύρα Alfa 330ml', price: 3.50, categoryId: 'BAR', taxRate: 24, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_11`, name: 'Aperol Spritz', price: 7.00, categoryId: 'BAR', taxRate: 24, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_12`, name: 'Νερό 500ml', price: 0.50, categoryId: 'DRINKS', taxRate: 13, isActive: true, tenantId, storeId }
    ];

    if ((this.inventoryService as any).categories) {
      (this.inventoryService as any).categories.set(starterCategories);
    }
    this.products.update(list => [...list.filter(p => p.storeId !== storeId), ...starterProducts]);

    if (this.db) {
      for (const cat of starterCategories) {
        await setDoc(doc(this.db, 'categories', cat.id), cleanUndefined(cat), { merge: true }).catch(() => {});
      }
      for (const prod of starterProducts) {
        await setDoc(doc(this.db, 'products', prod.id), cleanUndefined(prod), { merge: true }).catch(() => {});
      }
    }
  }
  
  public addCategory(name: string, icon: string = '📁') {
    return this.inventoryService.addCategory(name, icon);
  }

  public deleteCategory(catId: string) {
    return this.inventoryService.deleteCategory(catId);
  }

  public addProduct(prodData: { name: string; categoryId: string; price: number; purchasePrice?: number; taxRate: GreekVatRate; isPinnedToPOS?: boolean }) {
    return this.inventoryService.addProduct(prodData);
  }

  public updateProduct(prodId: string, prodData: Partial<Product>) {
    return this.inventoryService.updateProduct(prodId, prodData);
  }

  public deleteProduct(prodId: string) {
    return this.inventoryService.deleteProduct(prodId);
  }

  // --- INVENTORY & RAW MATERIAL DELEGATES ---

  // Inside src/app/core/services/restaurant-pos.service.ts

  public initFinancialListeners(): void {
    if (!this.db) return;

    if (this.salesUnsub) this.salesUnsub();
    if (this.zReportsUnsub) this.zReportsUnsub();

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    // 1. Sync Sales History real-time
    const salesQuery = query(
      collection(this.db, 'sales'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );

    this.salesUnsub = onSnapshot(salesQuery, (snap) => {
      const list: SaleRecord[] = [];
      snap.forEach(d => list.push(d.data() as SaleRecord));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.salesHistory.set(list);
    });

    // 2. Sync Z-Reports real-time
    const zQuery = query(
      collection(this.db, 'z_reports'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );

    this.zReportsUnsub = onSnapshot(zQuery, (snap) => {
      const list: DailyZReportSnapshot[] = [];
      snap.forEach(d => list.push(d.data() as DailyZReportSnapshot));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.zReports.set(list);
    });
  }

  public addRawMaterial(data: { name: string; unit: UnitOfMeasure; currentStock: number; minAlertStock: number; costPerUnit: number }) {
    return this.inventoryService.addRawMaterial(data);
  }

  public updateRawMaterial(id: string, data: Partial<any>) {
    return this.inventoryService.updateRawMaterial(id, data);
  }

  public adjustRawMaterialStock(id: string, count: number, reason?: string) {
    return this.inventoryService.adjustRawMaterialStock(id, count, reason);
  }

  public deleteRawMaterial(id: string) {
    return this.inventoryService.deleteRawMaterial(id);
  }

  public recordGoodsReceiving(data: any) {
    return this.inventoryService.recordGoodsReceiving(data);
  }

  public logSpoilage(data: any) {
    return this.inventoryService.logSpoilage(data, this.currentEmployee());
  }

  public deductRecipeIngredients(prod: Product, mult?: number) {
    return this.inventoryService.deductRecipeIngredients(prod, mult);
  }

  // --- TABLE & FLOOR PLAN DELEGATES ---

  public addProductToTableOrder(tableId: string, product: Product, modifiers: OrderModifier[] = [], notes: string = ''): void {
    this.addOrderItemToTable(tableId, product, modifiers, notes);
  }

  public removeOrderItem(tableId: string, itemId: string): void {
    this.tableOrderService.removeOrderItem(tableId, itemId);
  }

  public updateOrderItemQuantity(tableId: string, itemId: string, delta: number): void {
    this.tableOrderService.updateTableOrderItemQuantity(tableId, itemId, delta);
  }

  public voidOrderItem(tableId: string, itemId: string, reason?: string): void {
    this.tableOrderService.voidTableOrderItem(tableId, itemId, reason);
  }

  public updateOrderNotes(tableId: string, notes: string): void {
    const table = this.tables().find(t => t.id === tableId);
    if (table && table.activeOrder) {
      this.tableOrderService.updateTable(tableId, {
        activeOrder: {
          ...table.activeOrder,
          notes
        }
      });
    }
  }

  public printTableBill(tableId: string): void {
    this.markTableBillPrinted(tableId);
  }

  public addTable(data: { number: number; seats?: number; section?: string; zone?: string }) {
    return this.tableOrderService.addTable(data);
  }

  public updateTable(tableId: string, data: Partial<Table>) {
    return this.tableOrderService.updateTable(tableId, data);
  }

  public deleteTable(tableId: string) {
    return this.tableOrderService.deleteTable(tableId);
  }

  public addOrderItemToTable(tableId: string, product: Product, modifiers: OrderModifier[] = [], notes: string = '', waiter?: Employee | null): void {
    const activeWaiter = waiter || this.currentEmployee();
    return this.tableOrderService.addOrderItemToTable(tableId, product, modifiers, notes, activeWaiter);
  }

  public updateTableOrderItemQuantity(tableId: string, itemId: string, delta: number) {
    return this.tableOrderService.updateTableOrderItemQuantity(tableId, itemId, delta);
  }

  public voidTableOrderItem(tableId: string, itemId: string, reason?: string) {
    return this.tableOrderService.voidTableOrderItem(tableId, itemId, reason);
  }

  public sendOrderToKitchen(tableId: string) {
    return this.tableOrderService.sendOrderToKitchen(tableId);
  }

  public bumpOrderItemStatus(tableId: string, itemId: string) {
    return this.tableOrderService.bumpOrderItemStatus(tableId, itemId);
  }

  public completeKitchenTicket(orderId: string, tableId: string) {
    const table = this.tables().find(t => t.id === tableId);
    if (table && table.activeOrder) {
      const updatedItems = table.activeOrder.items.map(i => ({ ...i, status: 'SERVED' as ItemPreparationStatus }));
      this.tableOrderService.updateTable(tableId, { activeOrder: { ...table.activeOrder, items: updatedItems } });
    }
  }

  public markTableBillPrinted(tableId: string) {
    return this.tableOrderService.markTableBillPrinted(tableId);
  }

  public async settleTablePayment(
    tableId: string, 
    paymentMethod: 'CASH' | 'CARD' | 'DEBT',
    targetWaiterVaultId?: string
  ): Promise<void> {
    const table = this.tables().find(t => t.id === tableId);
    const activeOrder = table?.activeOrder;

    if (activeOrder && activeOrder.items) {
      const unsentItems = activeOrder.items.filter(item => item.status === 'PENDING');
      if (unsentItems.length > 0) {
        alert(
          `⚠️ Υπάρχουν ${unsentItems.length} εκκρεμή προϊόντα που δεν έχουν σταλεί στην κουζίνα!\n\nΠαρακαλώ πατήστε "Αποστολή" στην κουζίνα πριν την εξόφληση.`
        );
        return;
      }
    }

    const currentEmp = this.currentEmployee();

    // Deduct inventory stock for settled products
    if (activeOrder && activeOrder.items) {
      activeOrder.items.forEach(orderItem => {
        const matchingProd = this.products().find(p => p.id === orderItem.productId);
        if (matchingProd) {
          this.deductRecipeIngredients(matchingProd, orderItem.quantity);
        }
      });
    }
    
    return this.tableOrderService.settleTablePayment(tableId, paymentMethod, currentEmp, (sale) => {
      const activeVaults = this.activeVaultSessions();
      
      // 1. Find the active vault (matching target ID, sale waiter, employee ID, or employee name)
      let targetVault: WaiterVaultSession | null | undefined = targetWaiterVaultId 
        ? activeVaults.find(v => v.id === targetWaiterVaultId && v.status === 'OPEN')
        : activeVaults.find(v => v.waiterId === sale.waiterId && v.status === 'OPEN') 
          || activeVaults.find(v => v.waiterId === currentEmp?.id && v.status === 'OPEN')
          || activeVaults.find(v => v.waiterName === currentEmp?.name && v.status === 'OPEN')
          || activeVaults[0];

      // 2. Auto-create fallback vault if none was open and assign it properly
      if (!targetVault && currentEmp) {
        this.openWaiterVault(50);
        targetVault = this.activeVaultSession();
      }

      // 3. Update vault cash/card totals
      if (targetVault) {
        const addedCash = paymentMethod === 'CASH' ? (sale.grandTotal || 0) : 0;
        const addedCard = paymentMethod === 'CARD' ? (sale.grandTotal || 0) : 0;

        const updatedVault: WaiterVaultSession = {
          ...targetVault,
          cashCollected: Number(((targetVault.cashCollected || 0) + addedCash).toFixed(2)),
          cardCollected: Number(((targetVault.cardCollected || 0) + addedCard).toFixed(2))
        };

        this.allVaultSessions.update(list => list.map(v => v.id === targetVault!.id ? updatedVault : v));
        this.activeVaultSessions.update(list => list.map(v => v.id === targetVault!.id ? updatedVault : v));
        this.activeVaultSession.set(updatedVault);

        if (this.db) {
          setDoc(doc(this.db, 'vaults', targetVault.id), cleanUndefined(updatedVault), { merge: true }).catch(() => {});
        }
      }

      this.logAudit(
        'PAYMENT_RECEIVED', 
        `Εξόφληση €${sale.grandTotal.toFixed(2)} (${paymentMethod}) - Τραπέζι #${sale.tableNumber} ${targetVault ? '[Ταμείο: ' + targetVault.waiterName + ']' : ''}`, 
        sale.tableNumber
      );
    });
  }

  // --- VAULT MANAGEMENT DELEGATES ---

// Replace lines 463-500 in src/app/core/services/restaurant-pos.service.ts

  private initVaultsSync(): void {
    if (!this.db) return;

    if (this.activeVaultsUnsub) {
      this.activeVaultsUnsub();
    }

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    // Listen to the 'vaults' collection with relaxed matching (like AuthShiftService)
    this.activeVaultsUnsub = onSnapshot(collection(this.db, 'vaults'), (snap) => {
      const vaultList: WaiterVaultSession[] = [];
      
      snap.forEach(docSnap => {
        const data = docSnap.data() as WaiterVaultSession;
        const vaultId = data.id || docSnap.id;

        // Match if belongs to active tenant OR is global/legacy
        const matchesTenant = !data.tenantId || data.tenantId === tenantId;
        const matchesStore = !data.storeId || data.storeId === storeId;

        if (matchesTenant && matchesStore) {
          vaultList.push({
            ...data,
            id: vaultId
          });
        }
      });

      vaultList.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

      this.allVaultSessions.set(vaultList);

      const activeOnly = vaultList.filter(v => v.status === 'OPEN');
      this.activeVaultSessions.set(activeOnly);

      const emp = this.currentEmployee();
      if (emp) {
        const myActiveVault = activeOnly.find(
          v => v.waiterId === emp.id || v.waiterId === emp.pin || v.waiterName === emp.name
        );
        this.activeVaultSession.set(myActiveVault || null);
      } else {
        this.activeVaultSession.set(null);
      }
    });
  }

  public openWaiterVault(startingFloat: number = 50): void {
    const emp = this.currentEmployee();
    if (!emp) return;

    const { tenantId, storeId } = this.getActiveTenantAndStore();
    const cleanFloat = startingFloat >= 0 ? startingFloat : 50;

    const existingOpenVault = this.activeVaultSessions().find(
      v => (v.waiterId === emp.id || v.waiterName === emp.name) && v.status === 'OPEN'
    );
    
    if (existingOpenVault) {
      if (existingOpenVault.startingFloat !== cleanFloat) {
        this.updateWaiterVaultFloat(existingOpenVault.id, cleanFloat);
      } else {
        this.activeVaultSession.set(existingOpenVault);
      }
      return;
    }

    const vault: WaiterVaultSession = {
      id: `VAULT-${emp.id}-${Date.now()}`,
      tenantId: emp.tenantId || tenantId,
      storeId: emp.storeId || storeId,
      shiftLogId: `SHIFT-${emp.id}-${Date.now()}`,
      waiterId: emp.id,
      waiterName: emp.name,
      openedAt: new Date().toISOString(),
      startingFloat: cleanFloat,
      cashCollected: 0,
      cardCollected: 0,
      status: 'OPEN'
    };

    this.activeVaultSession.set(vault);
    this.activeVaultSessions.update(list => [vault, ...list.filter(v => v.waiterId !== emp.id)]);
    this.allVaultSessions.update(list => [vault, ...list.filter(v => v.id !== vault.id)]);

    if (this.db) {
      setDoc(doc(this.db, 'vaults', vault.id), cleanUndefined(vault)).catch(err => {
        console.error('Error opening vault in Firestore:', err);
      });
    }

    this.logAudit('VAULT_OPENED', `Άνοιγμα ταμείου (${emp.name}): €${cleanFloat.toFixed(2)}`);
  }

  public updateWaiterVaultFloat(vaultId: string, newStartingFloat: number): void {
    const vault = this.allVaultSessions().find(v => v.id === vaultId);
    if (!vault) return;

    const cleanFloat = Math.max(0, newStartingFloat);
    const updatedVault: WaiterVaultSession = {
      ...vault,
      startingFloat: cleanFloat
    };

    this.allVaultSessions.update(list => list.map(v => v.id === vaultId ? updatedVault : v));
    this.activeVaultSessions.update(list => list.map(v => v.id === vaultId ? updatedVault : v));

    if (this.activeVaultSession()?.id === vaultId) {
      this.activeVaultSession.set(updatedVault);
    }

    if (this.db) {
      setDoc(doc(this.db, 'vaults', vaultId), cleanUndefined(updatedVault), { merge: true }).catch(() => {});
    }

    this.logAudit('VAULT_FLOAT_UPDATED', `Αλλαγή αρχικού ταμείου (${vault.waiterName}): €${cleanFloat.toFixed(2)}`);
  }

  public closeWaiterVault(vaultId: string, actualCashCounted: number, notes: string = ''): void {
    const vault = this.allVaultSessions().find(v => v.id === vaultId);
    if (!vault) return;

    const expectedTotalCash = vault.startingFloat + vault.cashCollected;
    const variance = actualCashCounted - expectedTotalCash;

    const closedVault: WaiterVaultSession = {
      ...vault,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      expectedCash: expectedTotalCash,
      cashHandedOver: actualCashCounted,
      cashVariance: variance,
      notes
    };

    this.closeWaiterVaultSession(closedVault);
  }

  public async closeWaiterVaultSession(closedSession: WaiterVaultSession): Promise<void> {
    const nowStr = new Date().toISOString();

    // 1. Mark Vault as CLOSED locally
    const finalizedVault: WaiterVaultSession = {
      ...closedSession,
      status: 'CLOSED',
      closedAt: nowStr
    };

    this.activeVaultSessions.update(list => list.filter(v => v.id !== closedSession.id));
    this.allVaultSessions.update(list => list.map(v => v.id === closedSession.id ? finalizedVault : v));
    
    if (this.activeVaultSession()?.id === closedSession.id) {
      this.activeVaultSession.set(null);
    }

    // 2. Persist Vault Closure to Firestore
    if (this.db && closedSession.id) {
      try {
        await setDoc(doc(this.db, 'vaults', closedSession.id), cleanUndefined(finalizedVault), { merge: true });
      } catch (err) {
        console.error('Error saving closed vault to Firestore:', err);
      }
    }

    // 3. Close the Employee's Work Shift in AuthShiftService
    const waiterKey = closedSession.waiterId || closedSession.waiterName;
    await this.authShiftService.clockOutEmployeeShift(waiterKey, `Κλείσιμο ταμείου (${closedSession.waiterName})`);

    // 4. Force active shift local signal to null
    this.authShiftService.activeWorkShift.set(null);

    // 5. Log Security Audit
    this.logAudit(
      'VAULT_CLOSED',
      `Κλείσιμο ταμείου & έξοδος βάρδιας: ${closedSession.waiterName}. Μετρητά: €${(closedSession.cashHandedOver || 0).toFixed(2)}`
    );
  }

  // --- Z-REPORT & SYSTEM RESET ---
  public closeDayAndGenerateZReport(): DailyZReportSnapshot {
    const emp = this.currentEmployee();
    const { tenantId, storeId } = this.getActiveTenantAndStore();
    const vat = this.vatBreakdown();
    const todayStr = new Date().toLocaleDateString('el-GR');

    const snapshot: DailyZReportSnapshot = {
      id: `Z-REPORT-${Date.now()}`,
      tenantId: emp?.tenantId || tenantId,
      storeId: emp?.storeId || storeId,
      dateStr: todayStr,
      timestamp: new Date().toISOString(),
      closedByEmployeeId: emp?.id || 'SYSTEM',
      closedByEmployeeName: emp?.name || 'Manager',
      totalCash: Number(this.totalDailyCashInVaults().toFixed(2)),
      totalCard: Number(this.totalDailyCardInVaults().toFixed(2)),
      totalGrossRevenue: vat.totalGross,
      net13: vat.net13,
      vat13: vat.vat13,
      net24: vat.net24,
      vat24: vat.vat24,
      totalNetRevenue: vat.totalNet,
      totalVatLiability: vat.totalVat
    };

    if (this.db) {
      setDoc(doc(this.db, 'z_reports', snapshot.id), cleanUndefined(snapshot)).catch(() => {});
    }

    this.zReports.update(list => [snapshot, ...list]);
    this.logAudit('Z_REPORT_CLOSED', `Έκδοση Z-Report & Κλείσιμο Ημέρας. Σύνολο Τζίρου: €${snapshot.totalGrossRevenue.toFixed(2)}`);

    return snapshot;
  }

  public async resetDatabaseToDefaults(): Promise<void> {
    if (!this.db) return;

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    try {
      const collectionsToWipe = ['tables', 'shifts', 'vaults', 'auditLogs', 'spoilageLogs', 'z_reports', 'sales'];

      for (const colName of collectionsToWipe) {
        const q = query(
          collection(this.db, colName),
          where('tenantId', '==', tenantId),
          where('storeId', '==', storeId)
        );
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(this.db, colName, docSnap.id));
        }
      }

      this.workShifts.set([]);
      this.allVaultSessions.set([]);
      this.activeVaultSessions.set([]);
      this.activeWorkShift.set(null);
      this.activeVaultSession.set(null);
      this.auditLogs.set([]);
      this.zReports.set([]);
      this.salesHistory.set([]);

      this.logAudit('MASTER_RESET', '🔥 Πλήρης Μηδενισμός Βάσης Καταστήματος');
    } catch (e) {
      console.error('Database reset warning:', e);
    }
  }

  // --- AUDIT LOGGING ---
  public logAudit(action: string, details: string, tableNumber?: number): void {
    const emp = this.currentEmployee();
    const { tenantId, storeId } = this.getActiveTenantAndStore();

    const newLog: AuditLog = {
      id: `AUDIT-${Date.now()}`,
      tenantId: emp?.tenantId || tenantId,
      storeId: emp?.storeId || storeId,
      timestamp: new Date().toISOString(),
      employeeId: emp?.id || 'SYSTEM',
      employeeName: emp?.name || 'Σύστημα',
      action,
      tableNumber,
      details
    };
    this.auditLogs.set([newLog, ...this.auditLogs()]);
    if (this.db) {
      setDoc(doc(this.db, 'auditLogs', newLog.id), cleanUndefined(newLog)).catch(() => {});
    }
  }
}