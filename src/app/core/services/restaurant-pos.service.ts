// src/app/core/services/restaurant-pos.service.ts

import { Injectable, signal, computed, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  orderBy,
  limit,
  setDoc, 
  updateDoc,
  increment,
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

import { 
  Employee, 
  Role, 
  Product, 
  OrderModifier, 
  Table, 
  DailyZReportSnapshot, 
  AuditLog, 
  ModifierGroup,
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
  return copy as any;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantPosService {
  private ngZone = inject(NgZone);
  public tenantContext = inject(TenantContextService);
  public db: any = null;
  private router = inject(Router);

  // Active Listeners Lifecycle Trackers
  private activeVaultsUnsub: Unsubscribe | null = null;
  private salesUnsub: Unsubscribe | null = null;
  private zReportsUnsub: Unsubscribe | null = null;
  private auditLogsUnsub: Unsubscribe | null = null;
  private isInitialVaultsSync = true;

  // Sub-Services Injection
  public inventoryService = inject(InventoryService);
  public authShiftService = inject(AuthShiftService);
  public tableOrderService = inject(TableOrderService);

  // Pass-through Signals
  public rawMaterials = this.inventoryService.rawMaterials;
  public categories = this.inventoryService.categories;
  public products = this.inventoryService.products;
  public spoilageLogs = this.inventoryService.spoilageLogs;

  public employees = this.authShiftService.employees;
  public currentEmployee = this.authShiftService.currentEmployee;
  public workShifts = this.authShiftService.workShifts;
  public activeWorkShift = this.authShiftService.activeWorkShift;
  public canManageSystem = this.authShiftService.canManageSystem;

  public tables = this.tableOrderService.tables;
  public activeOrders = this.tableOrderService.activeOrders;
  public unreadReadyNotifications = this.tableOrderService.unreadReadyNotifications;
  public occupiedTables = this.tableOrderService.occupiedTables;

  // Financial & Reporting Signals
  public allVaultSessions = signal<WaiterVaultSession[]>([]);
  public activeVaultSessions = signal<WaiterVaultSession[]>([]);
  public activeVaultSession = signal<WaiterVaultSession | null>(null);
  public auditLogs = signal<AuditLog[]>([]);
  public zReports = signal<DailyZReportSnapshot[]>([]);
  public salesHistory = signal<SaleRecord[]>([]);

  public reserveTable = this.tableOrderService.reserveTable.bind(this.tableOrderService);
  public cancelReservation = this.tableOrderService.cancelReservation.bind(this.tableOrderService);

  // Tenant Computations
  public activeTenantId = computed(() => {
    return this.currentEmployee()?.tenantId || this.tenantContext.currentTenantId();
  });

  private getTenantSlug(): string {
    return this.tenantContext.currentTenantId() || 'coffee-shop-demo';
  }

  public activeStoreId = computed(() => {
    return this.currentEmployee()?.storeId || this.tenantContext.currentStoreId();
  });

  // Occupied Tables Count
  public occupiedTablesCount = computed(() => {
    const currentTenant = this.activeTenantId();
    const currentStore = this.activeStoreId();

    return this.tables().filter(t => {
      const matchScope = (!t.tenantId || t.tenantId === currentTenant) && (!t.storeId || t.storeId === currentStore);
      const isOccupied = t.status !== 'FREE' && t.status !== 'AVAILABLE';
      return matchScope && isOccupied;
    }).length;
  });

  // Live Floor Revenue Calculation
  public totalLiveFloorRevenue = computed(() => {
    const currentTenant = this.activeTenantId();
    const currentStore = this.activeStoreId();
    let total = 0;

    const storeTables = this.tables().filter(t => 
      (!t.tenantId || t.tenantId === currentTenant) &&
      (!t.storeId || t.storeId === currentStore)
    );

    for (const table of storeTables) {
      if (table.status === 'FREE' || table.status === 'AVAILABLE') continue;

      const orderObj = (table as any).activeOrder || (table as any).currentOrder || (table as any).order;
      const itemsList = orderObj?.items || (table as any).items || [];

      if (Array.isArray(itemsList) && itemsList.length > 0) {
        for (const item of itemsList) {
          if (item && item.status !== 'VOIDED') {
            const rawPrice = item.finalItemPrice ?? item.unitPrice ?? item.price ?? 0;
            const price = Number(rawPrice) || 0;
            const qty = Number(item.quantity || 1);
            total += price * qty;
          }
        }
      } else if (orderObj && typeof orderObj.total === 'number' && orderObj.total > 0) {
        total += Number(orderObj.total);
      }
    }

    return Number(total.toFixed(2));
  });

  public liveFloorRevenue = computed(() => this.totalLiveFloorRevenue());

  // Financial Totals
  public totalDailyCashInVaults = computed(() => {
    return this.activeVaultSessions().reduce((acc, v) => acc + (v.cashCollected || 0), 0);
  });

  public totalDailyCardInVaults = computed(() => {
    return this.activeVaultSessions().reduce((acc, v) => acc + (v.cardCollected || 0), 0);
  });

  public totalDailyStartingFloats = computed(() => {
    return this.activeVaultSessions().reduce((acc, v) => acc + (v.startingFloat || 0), 0);
  });

  public totalDailyGrossSales = computed(() => {
    const settledSalesTotal = this.currentWindowSales().reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    return Number((settledSalesTotal + this.totalLiveFloorRevenue()).toFixed(2));
  });

  public totalCashInVaults = computed(() => this.totalDailyCashInVaults());
  public totalCardInVaults = computed(() => this.totalDailyCardInVaults());
  public totalStartingFloats = computed(() => this.totalDailyStartingFloats());
  public totalGrossSales = computed(() => this.totalDailyGrossSales());
  public modifierGroups = this.inventoryService.modifierGroups;

  // Finds the timestamp of the last recorded Z-report for this store
  public lastZReportTimestamp = computed<string | null>(() => {
    const list = this.zReports();
    if (list.length === 0) return null;
    // zReports are already sorted desc by timestamp
    return list[0].timestamp || null;
  });

  // Sales strictly belonging to the current open business window
  public currentWindowSales = computed<SaleRecord[]>(() => {
    const lastZTime = this.lastZReportTimestamp();
    const allSales = this.salesHistory();

    if (!lastZTime) {
      return allSales; // First day of operation: all recorded sales
    }

    const lastZEpoch = new Date(lastZTime).getTime();
    return allSales.filter(s => new Date(s.timestamp).getTime() > lastZEpoch);
  });

  // Active business window VAT Breakdown
  public vatBreakdown = computed(() => {
    let gross13 = 0; let net13 = 0; let vat13 = 0;
    let gross24 = 0; let net24 = 0; let vat24 = 0;
    let gross6 = 0;  let net6 = 0;  let vat6 = 0;

    const sales = this.currentWindowSales();

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

        const itemGross = (item.finalItemPrice || item.unitPrice || 0) * (item.quantity || 1);
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

  public vatData = computed(() => this.vatBreakdown());

  constructor() {
    try {
      const app = initializeApp(DEFAULT_FIREBASE_CONFIG);
      this.db = getFirestore(app);

      this.inventoryService.initFirestoreSync(this.db);
      this.authShiftService.initFirestoreSync(this.db);
      this.tableOrderService.initFirestoreSync(this.db, () => this.currentEmployee());
      this.initVaultsSync();
      this.initFinancialListeners();
    } catch (e) {
      console.error('Firebase initialization error:', e);
    }
  }

  public teardownListeners(): void {
    if (this.salesUnsub) { this.salesUnsub(); this.salesUnsub = null; }
    if (this.zReportsUnsub) { this.zReportsUnsub(); this.zReportsUnsub = null; }
    if (this.auditLogsUnsub) { this.auditLogsUnsub(); this.auditLogsUnsub = null; }
    if (this.activeVaultsUnsub) { this.activeVaultsUnsub(); this.activeVaultsUnsub = null; }
  }

  public reconnectActiveStoreSync(emp?: Employee): void {
    if (!this.db) return;
    this.teardownListeners();
    this.inventoryService.initFirestoreSync(this.db);
    this.authShiftService.initFirestoreSync(this.db);
    this.tableOrderService.initFirestoreSync(this.db, () => emp || this.currentEmployee());
    this.initVaultsSync();
    this.initFinancialListeners();
  }

  public getActiveTenantAndStore(): { tenantId: string; storeId: string } {
    return {
      tenantId: this.activeTenantId(),
      storeId: this.activeStoreId()
    };
  }

  // Financial Listeners (Query-Scoped)
  public initFinancialListeners(): void {
    if (!this.db) return;

    if (this.salesUnsub) this.salesUnsub();
    if (this.zReportsUnsub) this.zReportsUnsub();
    if (this.auditLogsUnsub) this.auditLogsUnsub();

    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();

    // 1. Scoped Sales
    const salesQuery = query(
      collection(this.db, 'sales'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );

    this.salesUnsub = onSnapshot(salesQuery, (snap) => {
      const list: SaleRecord[] = [];
      snap.forEach(d => {
        list.push({ ...(d.data() as SaleRecord), id: d.id });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.salesHistory.set(list);
    }, (err) => console.error(`[Firestore/Security] Sales query error for ${tenantId}:`, err));

    // 2. Scoped Z-Reports
    const zReportsQuery = query(
      collection(this.db, 'z_reports'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );

    this.zReportsUnsub = onSnapshot(zReportsQuery, (snap) => {
      const list: DailyZReportSnapshot[] = [];
      snap.forEach(d => {
        list.push({ ...(d.data() as DailyZReportSnapshot), id: d.id });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.zReports.set(list);
    }, (err) => console.error(`[Firestore/Security] Z-Reports query error for ${tenantId}:`, err));

    // 3. Scoped Audit Logs
    const auditQuery = query(
      collection(this.db, 'auditLogs'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    this.auditLogsUnsub = onSnapshot(auditQuery, (snap) => {
      const list: AuditLog[] = [];
      snap.forEach(d => {
        list.push({ ...(d.data() as AuditLog), id: d.id });
      });
      this.auditLogs.set(list);
    }, (err) => console.error(`[Firestore/Security] Audit logs query error for ${tenantId}:`, err));
  }

  // Vault Management (Query-Scoped)
  private initVaultsSync(): void {
    if (!this.db) return;

    if (this.activeVaultsUnsub) {
      this.activeVaultsUnsub();
    }

    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();

    const vaultsQuery = query(
      collection(this.db, 'vaults'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );

    this.activeVaultsUnsub = onSnapshot(vaultsQuery, (snap) => {
      const vaultList: WaiterVaultSession[] = [];

      snap.forEach(docSnap => {
        const data = docSnap.data() as WaiterVaultSession;
        vaultList.push({
          ...data,
          id: docSnap.id,
          startingFloat: data.startingFloat ?? 0,
          cashCollected: data.cashCollected ?? 0,
          cardCollected: data.cardCollected ?? 0
        });
      });

      vaultList.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
      this.allVaultSessions.set(vaultList);

      const activeOnly = vaultList.filter(v => v.status === 'OPEN');
      this.activeVaultSessions.set(activeOnly);

      const emp = this.currentEmployee();
      if (emp) {
        const myActiveVault = activeOnly.find(v => v.waiterId === emp.id);
        this.activeVaultSession.set(myActiveVault || null);

        const isFloorStaff = (emp.role || '').toUpperCase() === 'WAITER';
        if (isFloorStaff && !myActiveVault && !this.isInitialVaultsSync) {
          console.warn(`[Vault] Active vault closed for ${emp.name}. Terminating session.`);
          this.logoutEmployee();
        }
      } else {
        this.activeVaultSession.set(null);
      }

      if (this.isInitialVaultsSync) {
        this.isInitialVaultsSync = false;
      }
    }, (err) => console.error(`[Firestore/Security] Vaults sync error for ${tenantId}:`, err));
  }

  // Notification Delegates
  public clearAllNotifications(): void {
    this.tableOrderService.clearAllNotifications();
  }

  public dismissNotification(idOrIndex: string | number): void {
    this.tableOrderService.dismissNotification(idOrIndex);
  }

  // Staff and Authentication Delegates
  public async loginWithPin(pin: string): Promise<Employee | null> {
    const result: any = await this.authShiftService.loginWithPin(pin);
    const emp: Employee | null = result?.employee || (result?.id ? result : null);
    return emp;
  }

  public setLoggedInEmployee(emp: Employee, customFloat: number = 0): void {
    this.tableOrderService.clearAllNotifications();
    this.authShiftService.setLoggedInEmployee(emp);

    localStorage.setItem('current_employee', JSON.stringify(emp));
    if (emp.tenantId) localStorage.setItem('active_tenant_id', emp.tenantId);
    if (emp.storeId) localStorage.setItem('active_store_id', emp.storeId);

    this.reconnectActiveStoreSync(emp);
    this.logAudit('CLOCK_IN', `Είσοδος στο σύστημα (${emp.name} - ${emp.role})`);

    const existingVault = this.activeVaultSessions().find(
      v => v.waiterId === emp.id && v.status === 'OPEN'
    );

    if (existingVault) {
      this.activeVaultSession.set(existingVault);
    } else {
      this.openWaiterVault(customFloat, emp);
    }
  }

  public logoutEmployee(): void {
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');
    sessionStorage.clear();

    this.ngZone.run(() => {
      this.authShiftService.currentEmployee.set(null);
      this.authShiftService.activeWorkShift.set(null);
      this.activeVaultSession.set(null);
      this.router.navigate(['/login'], { replaceUrl: true });
    });
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

  // Vault Helpers
  public openWaiterVault(startingFloat: number = 0, targetEmp?: Employee | null): void {
    const emp = targetEmp || this.currentEmployee();
    if (!emp) return;

    const tenantId = emp.tenantId || this.activeTenantId();
    const storeId = emp.storeId || this.activeStoreId();
    const cleanFloat = Math.max(0, startingFloat);

    const existingOpenVault = this.activeVaultSessions().find(
      v => v.waiterId === emp.id && v.status === 'OPEN'
    );

    if (existingOpenVault) {
      this.activeVaultSession.set(existingOpenVault);
      return;
    }

    const vault: WaiterVaultSession = {
      id: `VAULT-${emp.id}-${Date.now()}`,
      tenantId,
      storeId,
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
      setDoc(doc(this.db, 'vaults', vault.id), cleanUndefined(vault), { merge: true }).catch(err => {
        console.error('Error writing vault to Firestore:', err);
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

  public getEmployeeOpenVault(empIdOrPin: string): WaiterVaultSession | undefined {
    if (!empIdOrPin) return undefined;
    const target = String(empIdOrPin).trim().toLowerCase();
    
    return this.activeVaultSessions().find(v => {
      if (v.status !== 'OPEN') return false;
      const vWaiterId = String(v.waiterId || '').toLowerCase();
      const vWaiterName = String(v.waiterName || '').toLowerCase();
      return vWaiterId === target || vWaiterName === target || vWaiterId.includes(target);
    });
  }

  public async closeWaiterVaultSession(closedSession: WaiterVaultSession): Promise<void> {
    const nowStr = new Date().toISOString();
    const currentEmp = this.currentEmployee();

    const startFloat = closedSession.startingFloat || 0;
    const cash = closedSession.cashCollected || 0;
    const card = closedSession.cardCollected || 0;
    const expected = Number((startFloat + cash).toFixed(2));
    const handedOver = closedSession.cashHandedOver ?? expected;
    const variance = Number((handedOver - expected).toFixed(2));

    const finalizedVault: WaiterVaultSession = {
      ...closedSession,
      status: 'CLOSED',
      closedAt: nowStr,
      expectedCash: expected,
      cashHandedOver: handedOver,
      cashVariance: variance
    };

    this.activeVaultSessions.update(list => list.filter(v => v.id !== closedSession.id));
    this.allVaultSessions.update(list => list.map(v => v.id === closedSession.id ? finalizedVault : v));

    if (this.activeVaultSession()?.id === closedSession.id) {
      this.activeVaultSession.set(null);
    }

    if (this.db && closedSession.id) {
      await setDoc(doc(this.db, 'vaults', closedSession.id), cleanUndefined(finalizedVault), { merge: true }).catch(err => {
        console.error('Error saving closed vault:', err);
      });
    }

    await this.authShiftService.clockOutEmployeeShift(
      closedSession.waiterId, 
      `Κλείσιμο ταμείου (${closedSession.waiterName})`,
      {
        startingFloat: startFloat,
        cashCollected: cash,
        cardCollected: card,
        expectedCash: expected,
        actualCash: handedOver,
        cashVariance: variance,
        totalSales: Number((cash + card).toFixed(2))
      }
    );

    this.logAudit(
      'VAULT_CLOSED', 
      `Κλείσιμο ταμείου (${closedSession.waiterName}): Παράδοση €${handedOver.toFixed(2)}`
    );

    if (currentEmp && currentEmp.id === closedSession.waiterId) {
      this.logoutEmployee();
    }
  }

  // Inventory & Menu Delegates
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

  public async seedDefaultMenuForCurrentStore(): Promise<void> {
    const { tenantId, storeId } = this.getActiveTenantAndStore();

    // 1. Categories
    const starterCategories = [
      { id: `${storeId}_cat_coffee`, name: 'Καφέδες & Ροφήματα', code: 'COFFEE', icon: '☕', order: 1, tenantId, storeId },
      { id: `${storeId}_cat_drinks`, name: 'Αναψυκτικά & Χυμοί', code: 'DRINKS', icon: '🥤', order: 2, tenantId, storeId },
      { id: `${storeId}_cat_food`, name: 'Σνακ & Φαγητό', code: 'FOOD', icon: '🥪', order: 3, tenantId, storeId },
      { id: `${storeId}_cat_bar`, name: 'Μπύρες & Ποτά', code: 'BAR', icon: '🍺', order: 4, tenantId, storeId }
    ];

    // 2. Tenant-Scoped Modifier Groups (Matching your ModifierGroup & ModifierOption interfaces)
    const sweetnessGroupId = `${storeId}_modgrp_sweetness`;
    const milkGroupId = `${storeId}_modgrp_milk`;
    const coffeeExtrasGroupId = `${storeId}_modgrp_coffee_extras`;
    const breadGroupId = `${storeId}_modgrp_bread`;
    const toastExtrasGroupId = `${storeId}_modgrp_toast_extras`;

    const starterModifierGroups: ModifierGroup[] = [
      {
        id: sweetnessGroupId,
        tenantId,
        storeId,
        name: 'Γλυκύτητα',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: `${storeId}_opt_sketos`, tenantId, storeId, name: 'Σκέτος', priceExtra: 0, available: true },
          { id: `${storeId}_opt_metrios`, tenantId, storeId, name: 'Μέτριος', priceExtra: 0, available: true },
          { id: `${storeId}_opt_glykos`, tenantId, storeId, name: 'Γλυκός', priceExtra: 0, available: true },
          { id: `${storeId}_opt_stevia`, tenantId, storeId, name: 'Με Στέβια', priceExtra: 0, available: true }
        ]
      },
      {
        id: milkGroupId,
        tenantId,
        storeId,
        name: 'Είδος Γάλακτος',
        required: false,
        minSelect: 0,
        maxSelect: 1,
        minSelections: 0,
        maxSelections: 1,
        options: [
          { id: `${storeId}_opt_regular_milk`, tenantId, storeId, name: 'Κανονικό Γάλα', priceExtra: 0, available: true },
          { id: `${storeId}_opt_oat_milk`, tenantId, storeId, name: 'Βρώμης (Oat)', priceExtra: 0.50, available: true },
          { id: `${storeId}_opt_almond_milk`, tenantId, storeId, name: 'Αμυγδάλου', priceExtra: 0.50, available: true }
        ]
      },
      {
        id: coffeeExtrasGroupId,
        tenantId,
        storeId,
        name: 'Επιπλέον Καφέ',
        required: false,
        minSelect: 0,
        maxSelect: 3,
        minSelections: 0,
        maxSelections: 3,
        options: [
          { id: `${storeId}_opt_decaf`, tenantId, storeId, name: 'Decaf', priceExtra: 0, available: true },
          { id: `${storeId}_opt_extra_shot`, tenantId, storeId, name: 'Extra Shot Espresso', priceExtra: 0.60, available: true },
          { id: `${storeId}_opt_syrup_vanilla`, tenantId, storeId, name: 'Σιρόπι Βανίλια', priceExtra: 0.40, available: true },
          { id: `${storeId}_opt_syrup_caramel`, tenantId, storeId, name: 'Σιρόπι Καραμέλα', priceExtra: 0.40, available: true }
        ]
      },
      {
        id: breadGroupId,
        tenantId,
        storeId,
        name: 'Είδος Ψωμιού',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: `${storeId}_opt_bread_white`, tenantId, storeId, name: 'Λευκό Ψωμί', priceExtra: 0, available: true },
          { id: `${storeId}_opt_bread_dark`, tenantId, storeId, name: 'Ψωμί Ολικής', priceExtra: 0, available: true },
          { id: `${storeId}_opt_bread_brioche`, tenantId, storeId, name: 'Brioche', priceExtra: 0.50, available: true }
        ]
      },
      {
        id: toastExtrasGroupId,
        tenantId,
        storeId,
        name: 'Extra Προσθήκες',
        required: false,
        minSelect: 0,
        maxSelect: 4,
        minSelections: 0,
        maxSelections: 4,
        options: [
          { id: `${storeId}_opt_extra_bacon`, tenantId, storeId, name: 'Extra Μπέικον', priceExtra: 0.60, available: true },
          { id: `${storeId}_opt_extra_cheese`, tenantId, storeId, name: 'Extra Τυρί', priceExtra: 0.50, available: true },
          { id: `${storeId}_opt_mayo`, tenantId, storeId, name: 'Μαγιονέζα', priceExtra: 0.30, available: true },
          { id: `${storeId}_opt_egg`, tenantId, storeId, name: 'Αυγό Τηγανητό', priceExtra: 0.80, available: true }
        ]
      }
    ];

    // Groups linked specifically to coffee and food products:
    const coffeeGroupIds = [sweetnessGroupId, milkGroupId, coffeeExtrasGroupId];
    const foodGroupIds = [breadGroupId, toastExtrasGroupId];

    // 3. Products with explicit modifierGroupIds linkage
    const starterProducts: Product[] = [
      { id: `${storeId}_prod_1`, name: 'Espresso', price: 1.80, categoryId: `${storeId}_cat_coffee`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: coffeeGroupIds },
      { id: `${storeId}_prod_2`, name: 'Espresso Double', price: 2.20, categoryId: `${storeId}_cat_coffee`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: coffeeGroupIds },
      { id: `${storeId}_prod_3`, name: 'Freddo Espresso', price: 2.20, categoryId: `${storeId}_cat_coffee`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: coffeeGroupIds },
      { id: `${storeId}_prod_4`, name: 'Cappuccino', price: 2.50, categoryId: `${storeId}_cat_coffee`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: coffeeGroupIds },
      { id: `${storeId}_prod_5`, name: 'Freddo Cappuccino', price: 2.50, categoryId: `${storeId}_cat_coffee`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: coffeeGroupIds },
      { id: `${storeId}_prod_6`, name: 'Ελληνικός Διπλός', price: 2.00, categoryId: `${storeId}_cat_coffee`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: [sweetnessGroupId] },
      { id: `${storeId}_prod_7`, name: 'Φυσικός Χυμός Πορτοκάλι', price: 3.50, categoryId: `${storeId}_cat_drinks`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_8`, name: 'Τοστ Γαλοπούλα Τυρί', price: 2.50, categoryId: `${storeId}_cat_food`, station: 'KITCHEN', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: foodGroupIds },
      { id: `${storeId}_prod_9`, name: 'Club Sandwich Classic', price: 6.50, categoryId: `${storeId}_cat_food`, station: 'KITCHEN', taxRate: 13, isActive: true, tenantId, storeId, modifierGroupIds: foodGroupIds },
      { id: `${storeId}_prod_10`, name: 'Μπύρα Alfa 330ml', price: 3.50, categoryId: `${storeId}_cat_drinks`, station: 'BAR', taxRate: 24, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_11`, name: 'Aperol Spritz', price: 7.50, categoryId: `${storeId}_cat_drinks`, station: 'BAR', taxRate: 24, isActive: true, tenantId, storeId },
      { id: `${storeId}_prod_12`, name: 'Νερό 500ml', price: 0.50, categoryId: `${storeId}_cat_drinks`, station: 'BAR', taxRate: 13, isActive: true, tenantId, storeId }
    ];

    // 4. Update In-Memory Reactive State
    if ((this.inventoryService as any).categories?.set) {
      (this.inventoryService as any).categories.set(starterCategories);
    }
    if ((this.inventoryService as any).modifierGroups?.set) {
      (this.inventoryService as any).modifierGroups.set(starterModifierGroups);
    }
    this.products.update(list => [...list.filter(p => p.storeId !== storeId), ...starterProducts]);

    // 5. Persist to Firestore with Multi-Tenant Scoping
    if (this.db) {
      for (const cat of starterCategories) {
        await setDoc(doc(this.db, 'categories', cat.id), cleanUndefined(cat), { merge: true }).catch(() => {});
      }
      for (const group of starterModifierGroups) {
        await setDoc(doc(this.db, 'modifier_groups', group.id), cleanUndefined(group), { merge: true }).catch(() => {});
      }
      for (const prod of starterProducts) {
        await setDoc(doc(this.db, 'products', prod.id), cleanUndefined(prod), { merge: true }).catch(() => {});
      }
    }
  }

  // Table & Floor Plan Delegates
  public addTable(data: { number: string | number; seats?: number; section?: string; zone?: string }) {
    return this.tableOrderService.addTable(data);
  }

  public updateTable(tableId: string, data: Partial<Table>) {
    return this.tableOrderService.updateTable(tableId, data);
  }

  public deleteTable(tableId: string) {
    return this.tableOrderService.deleteTable(tableId);
  }

  public addProductToTableOrder(tableId: string, product: Product, modifiers: OrderModifier[] = [], notes: string = ''): void {
    this.tableOrderService.addOrderItemToTable(tableId, product, modifiers, notes, this.currentEmployee());
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

  public bumpOrderItemStatus(tableId: string, itemId: string) {
    return this.tableOrderService.bumpOrderItemStatus(tableId, itemId);
  }

  public updateOrderNotes(tableId: string, notes: string): void {
    const table = this.tables().find(t => t.id === tableId);
    if (table && table.activeOrder) {
      this.tableOrderService.updateTable(tableId, {
        activeOrder: { ...table.activeOrder, notes }
      });
    }
  }

  public printTableBill(tableId: string): void {
    this.tableOrderService.markTableBillPrinted(tableId);
  }

  public sendOrderToKitchen(tableId: string) {
    return this.tableOrderService.sendOrderToKitchen(tableId);
  }

  public moveOrMergeTable(sourceTableId: string, targetTableId: string) {
    return this.tableOrderService.moveOrMergeTable(sourceTableId, targetTableId, this.currentEmployee());
  }

  // 1. Partial Item Settlement (Connected directly to Vault & Audit Log)
  public async settlePartialItems(
    tableId: string, 
    itemIdsToSettle: string[], 
    method: 'CASH' | 'CARD'
  ): Promise<{ success: boolean; remainingTotal: number }> {
    const currentEmp = this.currentEmployee();
    const activeVaults = this.activeVaultSessions();
    const targetVault = activeVaults.find(v => v.waiterId === currentEmp?.id && v.status === 'OPEN') 
                      || this.activeVaultSession();

    return this.tableOrderService.settlePartialItems(
      tableId, 
      itemIdsToSettle, 
      method, 
      currentEmp, 
      async (sale: SaleRecord) => {
        const addedCash = method === 'CASH' ? (sale.grandTotal || 0) : 0;
        const addedCard = method === 'CARD' ? (sale.grandTotal || 0) : 0;

        if (this.db && targetVault) {
          try {
            await updateDoc(doc(this.db, 'vaults', targetVault.id), {
              cashCollected: increment(addedCash),
              cardCollected: increment(addedCard)
            });
          } catch (e) {
            console.error('Error incrementing vault totals on partial payment:', e);
          }
        }

        this.logAudit(
          'PARTIAL_PAYMENT_RECEIVED', 
          `Μερική Είσπραξη €${sale.grandTotal.toFixed(2)} (${method}) - Τραπέζι #${sale.tableNumber}`, 
          sale.tableNumber
        );
      }
    );
  }

  // 2. Full Table Settlement (Atomic Increment + Deductions)
  public async settleTablePayment(
    tableId: string, 
    paymentMethod: 'CASH' | 'CARD' | 'DEBT',
    targetWaiterVaultId?: string
  ): Promise<void> {
    const currentEmp = this.currentEmployee();

    if (!currentEmp) {
      alert('⚠️ Δεν υπάρχει συνδεδεμένος χρήστης. Παρακαλώ συνδεθείτε.');
      this.logoutEmployee();
      return;
    }

    const table = this.tables().find(t => t.id === tableId);
    const activeOrder = table?.activeOrder;

    if (activeOrder && activeOrder.items) {
      const unsentItems = activeOrder.items.filter(item => item.status === 'PENDING');
      if (unsentItems.length > 0) {
        alert(`⚠️ Υπάρχουν ${unsentItems.length} προϊόντα που δεν έχουν σταλεί στην κουζίνα!`);
        return;
      }
    }

    const activeVaults = this.activeVaultSessions();
    let targetVault: WaiterVaultSession | null = null;

    if (targetWaiterVaultId) {
      targetVault = activeVaults.find(v => v.id === targetWaiterVaultId && v.status === 'OPEN') || null;
    } else {
      targetVault = activeVaults.find(v => v.waiterId === currentEmp.id && v.status === 'OPEN') || this.activeVaultSession();
    }

    if (!targetVault) {
      alert('⚠️ Δεν βρέθηκε ενεργό ανοιχτό ταμείο για τον υπάλληλο. Ανοίξτε ταμείο πριν την είσπραξη.');
      return;
    }

    if (activeOrder && activeOrder.items) {
      activeOrder.items.forEach(orderItem => {
        const matchingProd = this.products().find(p => p.id === orderItem.productId);
        if (matchingProd) {
          this.deductRecipeIngredients(matchingProd, orderItem.quantity);
        }
      });
    }

    return this.tableOrderService.settleTablePayment(tableId, paymentMethod, currentEmp, async (sale) => {
      const addedCash = paymentMethod === 'CASH' ? (sale.grandTotal || 0) : 0;
      const addedCard = paymentMethod === 'CARD' ? (sale.grandTotal || 0) : 0;

      if (this.db) {
        try {
          await updateDoc(doc(this.db, 'vaults', targetVault!.id), {
            cashCollected: increment(addedCash),
            cardCollected: increment(addedCard)
          });
        } catch (e) {
          console.error('Error incrementing vault totals:', e);
        }
      }

      this.logAudit(
        'PAYMENT_RECEIVED', 
        `Εξόφληση €${sale.grandTotal.toFixed(2)} (${paymentMethod}) - Τραπέζι #${sale.tableNumber}`, 
        sale.tableNumber
      );
    });
  }

  public closeDayAndGenerateZReport(): DailyZReportSnapshot {
    const emp = this.currentEmployee();
    const { tenantId, storeId } = this.getActiveTenantAndStore();
    const vat = this.vatBreakdown();
    const activeWindow = this.currentWindowSales();
    const nowIso = new Date().toISOString();
    const dateDisplay = new Date().toLocaleDateString('el-GR');

    // Aggregate cash and card strictly from the current business window
    const totalCash = activeWindow.reduce(
      (sum, s) => sum + (s.paymentMethod === 'CASH' ? (s.grandTotal || 0) : 0), 
      0
    );
    const totalCard = activeWindow.reduce(
      (sum, s) => sum + (s.paymentMethod === 'CARD' ? (s.grandTotal || 0) : 0), 
      0
    );

    const snapshot: DailyZReportSnapshot = {
      id: `Z-REPORT-${Date.now()}`,
      tenantId: emp?.tenantId || tenantId,
      storeId: emp?.storeId || storeId,
      dateStr: dateDisplay,
      timestamp: nowIso,
      closedByEmployeeId: emp?.id || 'SYSTEM',
      closedByEmployeeName: emp?.name || 'Manager',
      totalCash: Number(totalCash.toFixed(2)),
      totalCard: Number(totalCard.toFixed(2)),
      totalGrossRevenue: vat.totalGross,
      net13: vat.net13,
      vat13: vat.vat13,
      net24: vat.net24,
      vat24: vat.vat24,
      totalNetRevenue: vat.totalNet,
      totalVatLiability: vat.totalVat
    };

    if (this.db) {
      setDoc(doc(this.db, 'z_reports', snapshot.id), cleanUndefined(snapshot)).catch((err) => {
        console.error('Error saving Z-Report:', err);
      });
    }

    this.zReports.update(list => [snapshot, ...list]);
    this.logAudit('Z_REPORT_CLOSED', `Έκδοση Z-Report. Τζίρος: €${snapshot.totalGrossRevenue.toFixed(2)}`);

    return snapshot;
  }

  // Safe Guarded Reset
  public async resetDatabaseToDefaults(): Promise<void> {
    if (!this.db) return;

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    if (tenantId !== 'coffee-shop-demo') {
      console.error('[Security] Master reset is restricted to demo environments.');
      alert('⛔ Ο ολικός μηδενισμός επιτρέπεται μόνο σε δοκιμαστικό λογαριασμό (Demo).');
      return;
    }

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

      this.logAudit('MASTER_RESET', '🔥 Μηδενισμός Demo Βάσης');
    } catch (e) {
      console.error('Database reset error:', e);
    }
  }

  // Audit Logging
  public logAudit(action: string, details: string, tableContext?: string | number | any): void {
    const emp = this.currentEmployee();
    const { tenantId, storeId } = this.getActiveTenantAndStore();

    let resolvedTableNumber: string | number | undefined = undefined;
    if (typeof tableContext === 'string' || typeof tableContext === 'number') {
      resolvedTableNumber = tableContext;
    } else if (tableContext && typeof tableContext === 'object') {
      resolvedTableNumber = tableContext.tableNumber ?? tableContext.number ?? tableContext.id;
    }

    const newLog: AuditLog = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenantId: emp?.tenantId || tenantId,
      storeId: emp?.storeId || storeId,
      timestamp: new Date().toISOString(),
      employeeId: emp?.id || 'SYSTEM',
      employeeName: emp?.name || 'Σύστημα',
      action,
      tableNumber: resolvedTableNumber,
      details
    };

    if (this.db) {
      setDoc(doc(this.db, 'auditLogs', newLog.id), cleanUndefined(newLog)).catch(() => {});
    }
  }
}