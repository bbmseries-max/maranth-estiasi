import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

import { InventoryService } from './inventory.service';
import { AuthShiftService } from './auth-shift.service';
import { TableOrderService } from './table-order.service';

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
} from '../models/restaurant-pos.models';

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
  public db: any = null;
  private router = inject(Router);

  // Sub-Services Injection
  public inventoryService = inject(InventoryService);
  public authShiftService = inject(AuthShiftService);
  public tableOrderService = inject(TableOrderService);

  // --- PASS-THROUGH SIGNALS ---
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
  public totalLiveFloorRevenue = this.tableOrderService.totalLiveFloorRevenue;

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

  public vatBreakdown = computed(() => {
    const totalGross = this.salesHistory().reduce((acc, s) => acc + s.grandTotal, 0);
    const totalNet = totalGross / 1.13;
    const totalVat = totalGross - totalNet;

    return {
      totalGross,
      net13: totalNet,
      vat13: totalVat,
      net24: 0,
      vat24: 0,
      totalNet,
      totalVat
    };
  });

  constructor() {
    try {
      const app = initializeApp(DEFAULT_FIREBASE_CONFIG);
      this.db = getFirestore(app);

      // Initialize Modular Sync Services
      this.inventoryService.initFirestoreSync(this.db);
      this.authShiftService.initFirestoreSync(this.db);
      this.tableOrderService.initFirestoreSync(this.db, () => this.currentEmployee());
      this.initVaultsSync();
    } catch (e) {
      console.error('Firebase initialization error:', e);
    }
  }

  // --- NOTIFICATION DELEGATES ---
  public clearAllNotifications(): void {
    this.tableOrderService.clearAllNotifications();
  }

  public dismissNotification(idOrIndex: string | number): void {
    this.tableOrderService.dismissNotification(idOrIndex);
  }

// --- AUTH & STAFF DELEGATES ---
  public loginWithPin(pin: string) {
    return this.authShiftService.loginWithPin(pin);
  }

  public setLoggedInEmployee(emp: Employee): void {
    this.tableOrderService.clearAllNotifications();
    this.authShiftService.setLoggedInEmployee(emp);
    this.logAudit('CLOCK_IN', `Είσοδος στο σύστημα (${emp.role})`);

    // Non-cash roles auto-start session with €0 starting cash
    const nonCashRoles = ['CHEF', 'BARMAN', 'BARISTA', 'KITCHEN'];
    const role = emp.role?.toUpperCase() || '';

    if (nonCashRoles.includes(role)) {
      this.autoStartZeroCashVault(emp);
    }
  }

  private autoStartZeroCashVault(emp: Employee): void {
    // Check if an open vault already exists for this employee
    const existingVault = this.activeVaultSessions().find(v => v.waiterId === emp.id && v.status === 'OPEN');
    if (existingVault) return;

    const zeroVault: WaiterVaultSession = {
      id: `VAULT-${Date.now()}`,
      shiftLogId: `SHIFT-${Date.now()}`,
      waiterId: emp.id,
      waiterName: emp.name,
      startingFloat: 0,
      startingCash: 0,
      cashCollected: 0,
      cardCollected: 0,
      status: 'OPEN',
      openedAt: new Date().toISOString()
    };

    // Update active vault signals without opening any modal UI
    this.allVaultSessions.update(list => [...list, zeroVault]);
    this.activeVaultSessions.update(list => [...list, zeroVault]);
    this.activeVaultSession.set(zeroVault);

    if (this.db) {
      setDoc(doc(this.db, 'vaults', zeroVault.id), cleanUndefined(zeroVault), { merge: true }).catch(err => {
        console.error('Error auto-creating zero cash vault in Firestore:', err);
      });
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
      case 'ADMIN': return 'Διαχειριστής / Manager';
      case 'WAITER': return 'Σερβιτόρος';
      case 'KITCHEN': return 'Κουζίνα';
      case 'BAR':
      case 'BARISTA': return 'Barista / Μπαρ';
      default: return role || 'Υπάλληλος';
    }
  }

  // --- CATEGORIES & PRODUCTS DELEGATES ---
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
  public addTable(data: { number: number; seats?: number; section?: string; zone?: string }) {
    return this.tableOrderService.addTable(data);
  }

  public updateTable(tableId: string, data: Partial<Table>) {
    return this.tableOrderService.updateTable(tableId, data);
  }

  public deleteTable(tableId: string) {
    return this.tableOrderService.deleteTable(tableId);
  }

  public addOrderItemToTable(tableId: string, product: Product, modifiers: OrderModifier[] = [], notes: string = ''): void {
    const waiter = this.currentEmployee();
    this.tableOrderService.addOrderItemToTable(tableId, product, modifiers, notes, waiter);
    this.inventoryService.deductRecipeIngredients(product, 1);
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
  targetWaiterVaultId?: string // 👈 Optional parameter when assigned by manager
): Promise<void> {
  // 🛑 UNSENT ITEMS GUARD: Block payment if any items haven't been sent to kitchen
  const table = this.tables().find(t => t.id === tableId);
  const activeOrder = table?.activeOrder;

  if (activeOrder && activeOrder.items) {
    const unsentItems = activeOrder.items.filter(item => item.status === 'PENDING');
    if (unsentItems.length > 0) {
      alert(
        `⚠️ Υπάρχουν ${unsentItems.length} εκκρεμή προϊόντα που δεν έχουν σταλεί στην κουζίνα!\n\nΠαρακαλώ πατήστε "Αποστολή" στην κουζίνα πριν την εξόφληση.`
      );
      return; // ⛔ Abort settlement immediately
    }
  }

  const currentEmp = this.currentEmployee();
  
  return this.tableOrderService.settleTablePayment(tableId, paymentMethod, currentEmp, (sale) => {
    // 1. Identify target vault:
    //    - First check if explicit targetWaiterVaultId was passed
    //    - Then check for sale waiter's active vault
    //    - Fall back to logged-in user's active vault
    const activeVaults = this.activeVaultSessions();
    let targetVault = targetWaiterVaultId 
      ? activeVaults.find(v => v.id === targetWaiterVaultId && v.status === 'OPEN')
      : activeVaults.find(v => v.waiterId === sale.waiterId && v.status === 'OPEN') 
        || activeVaults.find(v => v.waiterId === currentEmp?.id && v.status === 'OPEN');

    if (targetVault) {
      const addedCash = paymentMethod === 'CASH' ? sale.grandTotal : 0;
      const addedCard = paymentMethod === 'CARD' ? sale.grandTotal : 0;

      const updatedVault: WaiterVaultSession = {
        ...targetVault,
        cashCollected: Number((targetVault.cashCollected + addedCash).toFixed(2)),
        cardCollected: Number((targetVault.cardCollected + addedCard).toFixed(2))
      };

      // 2. Update local signals
      this.allVaultSessions.update(list => list.map(v => v.id === targetVault!.id ? updatedVault : v));
      this.activeVaultSessions.update(list => list.map(v => v.id === targetVault!.id ? updatedVault : v));

      if (this.activeVaultSession()?.id === targetVault.id) {
        this.activeVaultSession.set(updatedVault);
      }

      // 3. Sync update to Firestore
      if (this.db) {
        setDoc(doc(this.db, 'vaults', targetVault.id), cleanUndefined(updatedVault), { merge: true }).catch(err => {
          console.error('Error updating target waiter vault in Firestore:', err);
        });
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

  /**
 * Real-time listener for Waiter Vault Sessions
 */
private initVaultsSync(): void {
  if (!this.db) return;

  onSnapshot(collection(this.db, 'vaults'), (snap) => {
    const vaultList: WaiterVaultSession[] = [];
    if (!snap.empty) {
      snap.forEach(docSnap => {
        vaultList.push(docSnap.data() as WaiterVaultSession);
      });
    }

    // Sort by openedAt date descending
    vaultList.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

    // 1. Update all sessions
    this.allVaultSessions.set(vaultList);

    // 2. Filter ONLY OPEN vaults for activeVaultSessions
    const activeOnly = vaultList.filter(v => v.status === 'OPEN');
    this.activeVaultSessions.set(activeOnly);

    // 3. Sync logged-in waiter's vault session
    const emp = this.currentEmployee();
    if (emp) {
      const myActiveVault = activeOnly.find(v => v.waiterId === emp.id);
      this.activeVaultSession.set(myActiveVault || null);
    } else {
      this.activeVaultSession.set(null);
    }
  });
}

public openWaiterVault(startingFloat: number = 50): void {
  const emp = this.currentEmployee();
  if (!emp) return;

  const cleanFloat = startingFloat >= 0 ? startingFloat : 50;

  const existingOpenVault = this.activeVaultSessions().find(v => v.waiterId === emp.id && v.status === 'OPEN');
  
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

 public closeWaiterVaultSession(closedSession: WaiterVaultSession): void {
  // 1. Remove closed session from activeVaultSessions list
  this.activeVaultSessions.update(list => list.filter(s => s.id !== closedSession.id));

  // 2. Update historical list with closed vault state
  this.allVaultSessions.update(list => list.map(s => s.id === closedSession.id ? closedSession : s));

  // 3. Clear activeVaultSession if it belongs to the current logged-in employee
  if (this.activeVaultSession()?.id === closedSession.id) {
    this.activeVaultSession.set(null);
  }

  // 4. Update Firestore database
  if (this.db) {
    setDoc(doc(this.db, 'vaults', closedSession.id), cleanUndefined(closedSession), { merge: true }).catch(err => {
      console.error('Error updating vault in Firestore:', err);
    });
  }

  // 5. Clock out shift (sets employee status to inactive / red)
  this.authShiftService.clockOutEmployeeShift(closedSession.waiterId);

  this.logAudit(
    'VAULT_CLOSED',
    `Κλείσιμο ταμείου & έξοδος βάρδιας (Clock-Out) - ${closedSession.waiterName}. Παραδόθηκαν: €${closedSession.cashHandedOver?.toFixed(2) || '0.00'}`
  );
}

  // --- Z-REPORT & SYSTEM RESET ---
  public closeDayAndGenerateZReport(): DailyZReportSnapshot {
    const emp = this.currentEmployee() || { id: 'MANAGER', name: 'Manager' };
    const vat = this.vatBreakdown();
    const todayStr = new Date().toLocaleDateString('el-GR');

    const snapshot: DailyZReportSnapshot = {
      id: `Z-REPORT-${Date.now()}`,
      dateStr: todayStr,
      timestamp: new Date().toISOString(),
      closedByEmployeeId: emp.id,
      closedByEmployeeName: emp.name,
      totalCash: this.totalDailyCashInVaults(),
      totalCard: this.totalDailyCardInVaults(),
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
    this.logAudit('Z_REPORT_CLOSED', `Εκδοση Z-Report & Κλείσιμο Ημέρας. Σύνολο Τζίρου: €${snapshot.totalGrossRevenue.toFixed(2)}`);

    return snapshot;
  }

  public async resetDatabaseToDefaults(): Promise<void> {
    if (!this.db) return;

    try {
      const collectionsToWipe = ['tables', 'shifts', 'vaults', 'auditLogs', 'spoilageLogs', 'z_reports', 'sales'];

      for (const colName of collectionsToWipe) {
        const snap = await getDocs(collection(this.db, colName));
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

      this.logAudit('MASTER_RESET', '🔥 Πλήρης Μηδενισμός Βάσης & Fresh Start');
    } catch (e) {
      console.error('Database reset warning:', e);
    }
  }

  // --- AUDIT LOGGING ---
  public logAudit(action: string, details: string, tableNumber?: number): void {
    const emp = this.currentEmployee() || { id: 'SYSTEM', name: 'Σύστημα' };
    const newLog: AuditLog = {
      id: `AUDIT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      employeeId: emp.id,
      employeeName: emp.name,
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