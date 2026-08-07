import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { ActiveOrder } from '../models/restaurant-pos.models';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot, 
  deleteField, 
  Timestamp 
} from 'firebase/firestore';

import {
  UnitOfMeasure,
  Role,
  GreekVatRate,
  ItemPreparationStatus,
  OrderModifier,
  TableOrderItem,
  Table,
  Employee,
  RawMaterial,
  Category,
  Product,
  WorkShiftLog,
  WaiterVaultSession,
  AuditLog,
  SpoilageLog,
  DailyZReportSnapshot,
  SaleRecord,
  ReadyNotification
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

const INITIAL_TABLES: Table[] = [
  { id: 't1', number: 1, tableNumber: 1, seats: 4, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
  { id: 't2', number: 2, tableNumber: 2, seats: 2, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
  { id: 't3', number: 3, tableNumber: 3, seats: 6, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
  { id: 't4', number: 4, tableNumber: 4, seats: 4, section: 'OUTDOOR', zone: 'Αυλή', status: 'FREE', currentTotal: 0 },
  { id: 't5', number: 5, tableNumber: 5, seats: 4, section: 'OUTDOOR', zone: 'Αυλή', status: 'FREE', currentTotal: 0 },
  { id: 't6', number: 6, tableNumber: 6, seats: 2, section: 'BAR', zone: 'Bar', status: 'FREE', currentTotal: 0 },
  { id: 'takeaway-counter', number: 99, tableNumber: 99, seats: 1, section: 'TAKEAWAY', zone: 'Παραλαβή', status: 'FREE', currentTotal: 0 }
];

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp_1', name: 'Διαχειριστής', pinCode: '1111', pin: '1111', role: 'MANAGER', hourlyRate: 10.0, isActive: true, active: true },
  { id: 'emp_2', name: 'Γιώργος (Σερβιτόρος)', pinCode: '2222', pin: '2222', role: 'WAITER', hourlyRate: 6.5, isActive: true, active: true },
  { id: 'emp_3', name: 'Μαρία (Barista)', pinCode: '3333', pin: '3333', role: 'BAR', hourlyRate: 7.0, isActive: true, active: true },
  { id: 'emp_4', name: 'Κώστας (Κουζίνα)', pinCode: '4444', pin: '4444', role: 'KITCHEN', hourlyRate: 8.0, isActive: true, active: true }
];

const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  { id: 'RM-1', name: 'Espresso Beans (Specialty)', unit: 'KG', currentStock: 12.5, minAlertStock: 3.0, costPerUnit: 18.5 },
  { id: 'RM-2', name: 'Φρέσκο Γάλα 3.7%', unit: 'LITER', currentStock: 24.0, minAlertStock: 6.0, costPerUnit: 1.2 },
  { id: 'RM-3', name: 'Γάλα Βρώμης (Barista)', unit: 'LITER', currentStock: 10.0, minAlertStock: 3.0, costPerUnit: 2.1 },
  { id: 'RM-4', name: 'Ψωμί Brioche', unit: 'PCS', currentStock: 45.0, minAlertStock: 15.0, costPerUnit: 0.6 }
];

@Injectable({
  providedIn: 'root'
})
export class RestaurantPosService {
  private router = inject(Router);
  public db: any = null;
  
  activeOrders = signal<ActiveOrder[]>([]);
  currentEmployee = signal<Employee | null>(null);
  tables = signal<Table[]>([]);
  employees = signal<Employee[]>([]);
  rawMaterials = signal<RawMaterial[]>([]);
  categories = signal<Category[]>([]);
  products = signal<Product[]>([]);
  workShifts = signal<WorkShiftLog[]>([]);
  activeWorkShift = signal<WorkShiftLog | null>(null);
  allVaultSessions = signal<WaiterVaultSession[]>([]);
  activeVaultSessions = signal<WaiterVaultSession[]>([]);
  activeVaultSession = signal<WaiterVaultSession | null>(null);
  auditLogs = signal<AuditLog[]>([]);
  spoilageLogs = signal<SpoilageLog[]>([]);
  zReports = signal<DailyZReportSnapshot[]>([]);
  salesHistory = signal<SaleRecord[]>([]);

  

  unreadReadyNotifications = signal<ReadyNotification[]>([]);
  isCloudSynced = signal<boolean>(false);

  private knownItemStatusMap = new Map<string, ItemPreparationStatus>();
  private isInitialTablesSync = true;

  constructor() {
    try {
      const app = initializeApp(DEFAULT_FIREBASE_CONFIG);
      this.db = getFirestore(app);
      this.syncFirestoreData();
      this.seedInitialTables();
    } catch (e) {
      console.error('Firebase initialization error:', e);
    }
  }

  public canManageSystem(): boolean {
    const emp = this.currentEmployee();
    return emp?.role === 'MANAGER' || emp?.role === 'ADMIN';
  }

  public clearAllNotifications(): void {
    this.unreadReadyNotifications.set([]);
  }

  public getRoleLabel(role?: string): string {
    switch (role?.toUpperCase()) {
      case 'MANAGER':
      case 'ADMIN': 
        return 'Διαχειριστής / Manager';
      case 'WAITER': 
        return 'Σερβιτόρος';
      case 'KITCHEN': 
        return 'Κουζίνα';
      case 'BAR':
      case 'BARISTA': 
        return 'Barista / Μπαρ';
      default: 
        return role || 'Υπάλληλος';
    }
  }

  private async seedInitialTables() {
    if (!this.db) return;
    try {
      for (const table of INITIAL_TABLES) {
        await setDoc(doc(this.db, 'tables', table.id), cleanUndefined(table), { merge: true });
      }
      for (const emp of INITIAL_EMPLOYEES) {
        await setDoc(doc(this.db, 'employees', emp.id), cleanUndefined(emp), { merge: true });
      }
      for (const mat of INITIAL_RAW_MATERIALS) {
        await setDoc(doc(this.db, 'rawMaterials', mat.id), cleanUndefined(mat), { merge: true });
      }
    } catch (e) {}
  }

  private syncFirestoreData() {
    if (!this.db) return;

    onSnapshot(collection(this.db, 'tables'), (snap) => {
      const cloudTableMap = new Map<string, Table>();
      const newlyServedItems: { tableId: string; tableNumber: number; zone: string; itemSummary: string }[] = [];
      const extractedActiveOrders: ActiveOrder[] = [];

      if (!snap.empty) {
        snap.forEach(docSnap => {
          const rawTable = docSnap.data() as any;
          const isFree = !rawTable.status || rawTable.status === 'FREE' || rawTable.status === 'AVAILABLE';

          const t: Table = {
            ...rawTable,
            status: isFree ? 'FREE' : rawTable.status,
            currentTotal: isFree ? 0 : (rawTable.currentTotal || 0),
            activeOrder: (isFree || !rawTable.activeOrder) ? undefined : rawTable.activeOrder,
            activeOrderId: (isFree || !rawTable.activeOrderId) ? undefined : rawTable.activeOrderId,
            waiterId: isFree ? undefined : rawTable.waiterId,
            waiterName: isFree ? undefined : rawTable.waiterName,
            assignedWaiterId: isFree ? undefined : rawTable.assignedWaiterId,
            assignedWaiterName: isFree ? undefined : rawTable.assignedWaiterName
          };
          cloudTableMap.set(t.id, t);

          if (t.activeOrder) {
            extractedActiveOrders.push(t.activeOrder);
          }

          if (rawTable.activeOrder && rawTable.activeOrder.items) {
            for (const item of rawTable.activeOrder.items) {
              const prevStatus = this.knownItemStatusMap.get(item.id);
              this.knownItemStatusMap.set(item.id, item.status);

              if (!this.isInitialTablesSync && prevStatus && prevStatus !== 'SERVED' && item.status === 'SERVED') {
                newlyServedItems.push({
                  tableId: rawTable.id,
                  tableNumber: rawTable.number || rawTable.tableNumber || 0,
                  zone: rawTable.zone || rawTable.section || 'Σάλα',
                  itemSummary: `${item.quantity}x ${item.productName || item.name || 'Προϊόν'}`
                });
              }
            }
          }
        });
      }

      const mergedList = INITIAL_TABLES.map(initTable => {
        const cloudTable = cloudTableMap.get(initTable.id);
        if (cloudTable) {
          const isFree = cloudTable.status === 'FREE';
          return {
            ...initTable,
            ...cloudTable,
            status: isFree ? 'FREE' : cloudTable.status,
            currentTotal: isFree ? 0 : (cloudTable.currentTotal || 0),
            activeOrder: isFree ? undefined : cloudTable.activeOrder
          };
        }
        return initTable;
      });

      cloudTableMap.forEach((cloudTable, id) => {
        if (!mergedList.some(t => t.id === id)) {
          const isFree = cloudTable.status === 'FREE';
          mergedList.push({
            ...cloudTable,
            status: isFree ? 'FREE' : cloudTable.status,
            currentTotal: isFree ? 0 : (cloudTable.currentTotal || 0),
            activeOrder: isFree ? undefined : cloudTable.activeOrder
          });
        }
      });

      mergedList.sort((a, b) => (a.number || a.tableNumber || 0) - (b.number || b.tableNumber || 0));
      this.tables.set(mergedList);
      this.activeOrders.set(extractedActiveOrders);
      this.isCloudSynced.set(true);

      if (this.isInitialTablesSync) {
        this.isInitialTablesSync = false;
      } else if (newlyServedItems.length > 0 && this.currentEmployee()) {
        for (const notif of newlyServedItems) {
          this.addReadyNotification(notif);
        }
      }
    }, (err) => console.warn('Tables sync warning:', err));

    onSnapshot(collection(this.db, 'employees'), (snap) => {
      const cloudMap = new Map<string, Employee>();
      if (!snap.empty) {
        snap.forEach(docSnap => {
          const emp = docSnap.data() as Employee;
          cloudMap.set(emp.id, emp);
        });
      }
      const merged: Employee[] = INITIAL_EMPLOYEES.map(initEmp => {
        const cloudEmp = cloudMap.get(initEmp.id);
        return cloudEmp ? { ...initEmp, ...cloudEmp } : initEmp;
      });
      cloudMap.forEach((cloudEmp, id) => {
        if (!merged.some(e => e.id === id)) merged.push(cloudEmp);
      });
      this.employees.set(merged);
    });

    onSnapshot(collection(this.db, 'shifts'), (snap) => {
      const shiftList: WorkShiftLog[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => shiftList.push(docSnap.data() as WorkShiftLog));
      }
      this.workShifts.set(shiftList);

      const activeEmp = this.currentEmployee();
      if (activeEmp) {
        const myShift = shiftList.find(s => s.employeeId === activeEmp.id && s.status === 'WORKING');
        this.activeWorkShift.set(myShift || null);
      } else {
        this.activeWorkShift.set(null);
      }
    });

    onSnapshot(collection(this.db, 'vaults'), (snap) => {
      const vaultList: WaiterVaultSession[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => vaultList.push(docSnap.data() as WaiterVaultSession));
      }
      this.allVaultSessions.set(vaultList);

      const openVaults = vaultList.filter(v => v.status === 'OPEN');
      const uniqueOpenMap = new Map<string, WaiterVaultSession>();

      for (const v of openVaults) {
        const existing = uniqueOpenMap.get(v.waiterId);
        if (!existing || new Date(v.openedAt).getTime() > new Date(existing.openedAt).getTime()) {
          uniqueOpenMap.set(v.waiterId, v);
        }
      }

      const deduplicatedActiveVaults = Array.from(uniqueOpenMap.values());
      this.activeVaultSessions.set(deduplicatedActiveVaults);

      const activeEmp = this.currentEmployee();
      if (activeEmp) {
        const myVault = deduplicatedActiveVaults.find(v => v.waiterId === activeEmp.id);
        this.activeVaultSession.set(myVault || null);
      } else {
        this.activeVaultSession.set(null);
      }
    });

    onSnapshot(collection(this.db, 'auditLogs'), (snap) => {
      const list: AuditLog[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as AuditLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      this.auditLogs.set(list);
    });

    onSnapshot(collection(this.db, 'rawMaterials'), (snap) => {
      const list: RawMaterial[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as RawMaterial));
      }
      this.rawMaterials.set(list);
    });

    onSnapshot(collection(this.db, 'categories'), (snap) => {
      const list: Category[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as Category));
        list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
      this.categories.set(list);
    });

    onSnapshot(collection(this.db, 'products'), (snap) => {
      const list: Product[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as Product));
      }
      this.products.set(list);
    });

    onSnapshot(collection(this.db, 'spoilageLogs'), (snap) => {
      const list: SpoilageLog[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as SpoilageLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      this.spoilageLogs.set(list);
    });

    onSnapshot(collection(this.db, 'z_reports'), (snap) => {
      const list: DailyZReportSnapshot[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as DailyZReportSnapshot));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      this.zReports.set(list);
    });

    onSnapshot(collection(this.db, 'sales'), (snap) => {
      const list: SaleRecord[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as SaleRecord));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      this.salesHistory.set(list);
    });
  }

  private addReadyNotification(notif: { tableId: string; tableNumber: number; zone: string; itemSummary: string }) {
    const fullNotif: ReadyNotification = {
      ...notif,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      readyAt: new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
    };
    this.unreadReadyNotifications.update(list => [fullNotif, ...list]);
  }

  public dismissNotification(idOrIndex: string | number) {
    this.unreadReadyNotifications.update(list =>
      list.filter((item, index) => item.id !== idOrIndex && index !== idOrIndex)
    );
  }

  private deductRecipeIngredients(product: Product, multiplier: number = 1) {
    if (!product.recipeIngredients || product.recipeIngredients.length === 0) return;

    const materials = [...this.rawMaterials()];

    for (const ing of product.recipeIngredients) {
      const matIndex = materials.findIndex(m => m.id === ing.rawMaterialId);
      if (matIndex >= 0) {
        const mat = materials[matIndex];
        const consumed = ing.quantityUsed * multiplier;
        const newStock = mat.currentStock - consumed;

        materials[matIndex] = {
          ...mat,
          currentStock: newStock
        };

        if (newStock <= mat.minAlertStock) {
          this.logAudit('LOW_STOCK_WARNING', `⚠️ Χαμηλό απόθεμα για ${mat.name} (${newStock.toFixed(2)} ${mat.unit} απομένουν)`);
        }

        if (this.db) {
          setDoc(doc(this.db, 'rawMaterials', mat.id), cleanUndefined(materials[matIndex]), { merge: true }).catch(() => {});
        }
      }
    }

    this.rawMaterials.set(materials);
  }

  // --- AUTH & SHIFTS ---

  loginWithPin(pin: string): { success: boolean; message: string; employee?: Employee } {
    const cleanPin = pin.trim();
    const emp = this.employees().find(e => (e.pinCode === cleanPin || e.pin === cleanPin) && (e.isActive ?? e.active ?? true));
    if (emp) {
      this.setLoggedInEmployee(emp);
      return { success: true, message: 'Επιτυχής είσοδος', employee: emp };
    }
    return { success: false, message: 'Λανθασμένο PIN ή ανενεργός υπάλληλος.' };
  }

  public setLoggedInEmployee(emp: Employee): void {
    this.unreadReadyNotifications.set([]);
    this.currentEmployee.set(emp);
    this.logAudit('CLOCK_IN', `Είσοδος στο σύστημα (${emp.role})`);
  }

  logoutEmployee() {
    this.currentEmployee.set(null);
    this.activeWorkShift.set(null);
    this.activeVaultSession.set(null);
    this.unreadReadyNotifications.set([]);
    this.router.navigate(['/login']).catch(() => { window.location.href = '/login'; });
  }

  clockInShift(notes: string = 'Έναρξη βάρδιας') {
    const emp = this.currentEmployee();
    if (!emp) return;

    const newShift: WorkShiftLog = {
      id: `SHIFT-${emp.id}-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      clockInTime: new Date().toISOString(),
      hourlyRateAtShift: emp.hourlyRate || 7.0,
      status: 'WORKING',
      notes
    };

    this.activeWorkShift.set(newShift);
    this.workShifts.update(shifts => [newShift, ...shifts.filter(s => s.employeeId !== emp.id || s.status !== 'WORKING')]);

    if (this.db) {
      setDoc(doc(this.db, 'shifts', newShift.id), cleanUndefined(newShift)).catch(() => {});
    }
  }

  openWaiterVault(startingFloat: number = 50) {
    const emp = this.currentEmployee();
    if (!emp) return;

    const existingOpenVault = this.activeVaultSessions().find(v => v.waiterId === emp.id);
    if (existingOpenVault) {
      if (startingFloat >= 0 && existingOpenVault.startingFloat !== startingFloat) {
        this.updateWaiterVaultFloat(existingOpenVault.id, startingFloat);
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
      startingFloat: startingFloat >= 0 ? startingFloat : 50,
      cashCollected: 0,
      cardCollected: 0,
      status: 'OPEN'
    };

    this.activeVaultSession.set(vault);
    this.activeVaultSessions.update(list => [vault, ...list.filter(v => v.waiterId !== emp.id)]);

    if (this.db) {
      setDoc(doc(this.db, 'vaults', vault.id), cleanUndefined(vault)).catch(() => {});
    }
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

    this.allVaultSessions.update(list => list.map(v => v.id === vaultId ? closedVault : v));
    this.activeVaultSessions.update(list => list.filter(v => v.id !== vaultId));

    if (this.activeVaultSession()?.id === vaultId) {
      this.activeVaultSession.set(null);
    }

    if (this.db) {
      setDoc(doc(this.db, 'vaults', vaultId), cleanUndefined(closedVault), { merge: true }).catch(err => {
        console.error('Error closing vault in Firestore:', err);
      });
    }

    this.logAudit('VAULT_CLOSED', `Κλείσιμο Ταμείου (${vault.waiterName}): Καταμέτρηση €${actualCashCounted.toFixed(2)} (Διαφορά: €${variance.toFixed(2)})`);
  }

  // --- RAW MATERIALS MANAGEMENT ---

  public addRawMaterial(matData: { name: string; unit: UnitOfMeasure; currentStock: number; minAlertStock: number; costPerUnit: number }): { success: boolean; message: string; material?: RawMaterial } {
    if (!matData.name.trim()) {
      return { success: false, message: 'Το όνομα υλικού δεν μπορεί να είναι κενό.' };
    }

    const newMat: RawMaterial = {
      id: `RM-${Date.now()}`,
      name: matData.name.trim(),
      unit: matData.unit || 'KG',
      currentStock: matData.currentStock >= 0 ? matData.currentStock : 0,
      minAlertStock: matData.minAlertStock >= 0 ? matData.minAlertStock : 2.0,
      costPerUnit: matData.costPerUnit >= 0 ? matData.costPerUnit : 0
    };

    const updated = [...this.rawMaterials(), newMat];
    this.rawMaterials.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'rawMaterials', newMat.id), cleanUndefined(newMat)).catch(() => {});
    }

    this.logAudit('RAW_MATERIAL_ADDED', `Προσθήκη πρώτης ύλης: ${newMat.name} (${newMat.currentStock} ${newMat.unit})`);
    return { success: true, message: 'Η πρώτη ύλη καταχωρήθηκε επιτυχώς.', material: newMat };
  }

  public updateRawMaterial(id: string, matData: Partial<RawMaterial>) {
    const existing = this.rawMaterials().find(m => m.id === id);
    if (!existing) return;

    const updatedMat: RawMaterial = {
      ...existing,
      ...matData,
      name: matData.name ? matData.name.trim() : existing.name
    };

    const updatedList = this.rawMaterials().map(m => m.id === id ? updatedMat : m);
    this.rawMaterials.set(updatedList);

    if (this.db) {
      setDoc(doc(this.db, 'rawMaterials', id), cleanUndefined(updatedMat), { merge: true }).catch(() => {});
    }

    this.logAudit('RAW_MATERIAL_UPDATED', `Ενημέρωση πρώτης ύλης: ${updatedMat.name}`);
  }

  public adjustRawMaterialStock(id: string, newStockCount: number, reason: string = 'Απογραφή'): void {
    const existing = this.rawMaterials().find(m => m.id === id);
    if (!existing) return;

    const prevStock = existing.currentStock;
    const updatedMat: RawMaterial = {
      ...existing,
      currentStock: Math.max(0, newStockCount)
    };

    const updatedList = this.rawMaterials().map(m => m.id === id ? updatedMat : m);
    this.rawMaterials.set(updatedList);

    if (this.db) {
      setDoc(doc(this.db, 'rawMaterials', id), cleanUndefined(updatedMat), { merge: true }).catch(() => {});
    }

    this.logAudit('RAW_MATERIAL_ADJUSTED', `Απογραφή ${updatedMat.name}: Από ${prevStock.toFixed(2)} ${updatedMat.unit} -> ${newStockCount.toFixed(2)} ${updatedMat.unit} (${reason})`);
  }

  public deleteRawMaterial(id: string): { success: boolean; message: string } {
    const target = this.rawMaterials().find(m => m.id === id);
    if (!target) return { success: false, message: 'Το υλικό δεν βρέθηκε.' };

    const updated = this.rawMaterials().filter(m => m.id !== id);
    this.rawMaterials.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'rawMaterials', id)).catch(() => {});
    }

    this.logAudit('RAW_MATERIAL_DELETED', `Διαγραφή πρώτης ύλης: ${target.name}`);
    return { success: true, message: 'Η πρώτη ύλη διαγράφηκε επιτυχώς.' };
  }

  public addRawMaterialStock(matData: { name: string; quantity: number; unit: UnitOfMeasure; unitPrice: number }) {
    const existing = this.rawMaterials().find(m => m.name.toLowerCase() === matData.name.trim().toLowerCase());

    let updatedMat: RawMaterial;
    if (existing) {
      updatedMat = {
        ...existing,
        currentStock: existing.currentStock + matData.quantity,
        costPerUnit: matData.unitPrice > 0 ? matData.unitPrice : existing.costPerUnit
      };
    } else {
      updatedMat = {
        id: `RM-${Date.now()}`,
        name: matData.name.trim(),
        unit: matData.unit,
        currentStock: matData.quantity,
        minAlertStock: 2.0,
        costPerUnit: matData.unitPrice
      };
    }

    const updatedList = this.rawMaterials().filter(m => m.id !== updatedMat.id).concat(updatedMat);
    this.rawMaterials.set(updatedList);

    if (this.db) {
      setDoc(doc(this.db, 'rawMaterials', updatedMat.id), cleanUndefined(updatedMat)).catch(() => {});
    }

    this.logAudit('STOCK_RECEIVED', `Παραλαβή τιμολογίου: ${updatedMat.name} +${matData.quantity} ${updatedMat.unit}`);
  }

  // --- TABLE & POS ORDERS ---

  public addTable(data: { number: number; seats?: number; section?: string; zone?: string }): { success: boolean; message: string; table?: Table } {
    const num = Number(data.number);
    if (!num || num <= 0) {
      return { success: false, message: 'Ο αριθμός τραπεζιού πρέπει να είναι θετικός ακέραιος.' };
    }

    const existing = this.tables().find(t => (t.number === num || t.tableNumber === num) && t.id !== 'takeaway-counter');
    if (existing) {
      return { success: false, message: `Υπάρχει ήδη τραπέζι με αριθμό #${num}!` };
    }

    const newTable: Table = {
      id: `t_${Date.now()}`,
      number: num,
      tableNumber: num,
      name: `Τραπέζι ${num}`,
      seats: data.seats || 4,
      capacity: data.seats || 4,
      section: (data.section || 'INDOOR') as any,
      zone: data.zone || (data.section === 'OUTDOOR' ? 'Αυλή' : data.section === 'BAR' ? 'Bar' : 'Σάλα'),
      status: 'FREE',
      currentTotal: 0
    };

    const updated = [...this.tables(), newTable].sort((a, b) => (a.number || 0) - (b.number || 0));
    this.tables.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'tables', newTable.id), cleanUndefined(newTable)).catch(() => {});
    }

    this.logAudit('TABLE_ADDED', `Προσθήκη νέου τραπεζιού #${num} (${newTable.zone})`, num);
    return { success: true, message: 'Το τραπέζι δημιουργήθηκε επιτυχώς', table: newTable };
  }

  public updateTable(tableId: string, data: Partial<Table>) {
    const existing = this.tables().find(t => t.id === tableId);
    if (!existing) return;

    const num = data.number ?? data.tableNumber ?? existing.number ?? existing.tableNumber;
    const seats = data.seats ?? data.capacity ?? existing.seats ?? existing.capacity;

    const updatedTable: Table = {
      ...existing,
      ...data,
      number: num,
      tableNumber: num,
      name: data.name || `Τραπέζι ${num}`,
      seats: seats,
      capacity: seats
    };

    const updatedList = this.tables().map(t => t.id === tableId ? updatedTable : t);
    this.tables.set(updatedList);

    if (this.db) {
      setDoc(doc(this.db, 'tables', tableId), cleanUndefined(updatedTable), { merge: true }).catch(() => {});
    }

    this.logAudit('TABLE_UPDATED', `Ενημέρωση τραπεζιού #${num} (${updatedTable.zone})`, num);
  }

  public deleteTable(tableId: string): { success: boolean; message: string } {
    const target = this.tables().find(t => t.id === tableId);
    if (!target) return { success: false, message: 'Το τραπέζι δεν βρέθηκε.' };

    if (target.status === 'OCCUPIED' || target.status === 'BILL_PRINTED') {
      return { success: false, message: 'Δεν μπορείτε να διαγράψετε τραπέζι με ενεργή παραγγελία!' };
    }

    const updated = this.tables().filter(t => t.id !== tableId);
    this.tables.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'tables', tableId)).catch(() => {});
    }

    this.logAudit('TABLE_DELETED', `Διαγραφή τραπεζιού #${target.number || target.tableNumber}`);
    return { success: true, message: 'Το τραπέζι διαγράφηκε επιτυχώς.' };
  }

  addOrderItemToTable(tableId: string, product: Product, modifiers: OrderModifier[] = [], notes: string = '') {
    const waiter = this.currentEmployee() || { id: 'WAITER_1', name: 'Σερβιτόρος' };
    const extraCost = modifiers.reduce((acc, m) => acc + (m.priceExtra || 0), 0);
    const finalPrice = product.price + extraCost;

    const table = this.tables().find(t => t.id === tableId);
    if (!table) return;

    const existingOrder = table.activeOrder || {
      orderId: `ORD-${Date.now()}`,
      openedAt: new Date().toISOString(),
      items: [],
      subtotalNet: 0,
      totalTax: 0,
      grandTotal: 0
    };

    const newItem: TableOrderItem = {
      id: `ITEM-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 1,
      taxRate: product.taxRate || 13,
      modifiers,
      finalItemPrice: finalPrice,
      itemNotes: notes,
      orderedByWaiterId: waiter.id,
      orderedByWaiterName: waiter.name,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };

    const updatedItems = [...existingOrder.items, newItem];
    const activeItems = updatedItems.filter(i => i.status !== 'VOIDED');
    const grandTotal = activeItems.reduce((acc, i) => acc + (i.finalItemPrice * i.quantity), 0);
    const subtotalNet = grandTotal / 1.13;
    const totalTax = grandTotal - subtotalNet;

    const updatedT: Table = {
      ...table,
      status: 'OCCUPIED' as const,
      waiterId: waiter.id,
      assignedWaiterId: waiter.id,
      waiterName: waiter.name,
      assignedWaiterName: waiter.name,
      currentTotal: grandTotal,
      activeOrder: { ...existingOrder, items: updatedItems, subtotalNet, totalTax, grandTotal }
    };

    const updatedTables = this.tables().map(t => t.id === tableId ? updatedT : t);
    this.tables.set(updatedTables);

    if (this.db) {
      setDoc(doc(this.db, 'tables', tableId), cleanUndefined(updatedT)).catch(() => {});
    }

    this.deductRecipeIngredients(product, 1);
  }

  async updateTableOrderItemQuantity(tableId: string, itemId: string, delta: number) {
    const table = this.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const existingItems = table.activeOrder.items;
    const targetItem = existingItems.find(i => i.id === itemId);
    if (!targetItem) return;

    const newQty = targetItem.quantity + delta;

    let updatedItems: TableOrderItem[];
    if (newQty <= 0) {
      if (targetItem.status === 'PENDING') {
        updatedItems = existingItems.filter(i => i.id !== itemId);
      } else {
        updatedItems = existingItems.map(i => i.id === itemId ? { ...i, status: 'VOIDED' as ItemPreparationStatus } : i);
      }
    } else {
      updatedItems = existingItems.map(i => i.id === itemId ? { ...i, quantity: newQty } : i);
    }

    const activeItems = updatedItems.filter(i => i.status !== 'VOIDED');
    const grandTotal = activeItems.reduce((acc, i) => acc + (i.finalItemPrice * i.quantity), 0);
    const subtotalNet = grandTotal / 1.13;
    const totalTax = grandTotal - subtotalNet;

    const updatedTable: Table = {
      ...table,
      currentTotal: grandTotal,
      activeOrder: {
        ...table.activeOrder,
        items: updatedItems,
        subtotalNet,
        totalTax,
        grandTotal
      }
    };

    const updatedTables = this.tables().map(t => t.id === tableId ? updatedTable : t);
    this.tables.set(updatedTables);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', tableId), cleanUndefined(updatedTable));
      } catch (e) {}
    }
  }

  async voidTableOrderItem(tableId: string, itemId: string, reason: string = 'Ακύρωση από σερβιτόρο') {
    const table = this.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const targetItem = table.activeOrder.items.find(i => i.id === itemId);
    if (!targetItem) return;

    let updatedItems: TableOrderItem[];
    if (targetItem.status === 'PENDING') {
      updatedItems = table.activeOrder.items.filter(i => i.id !== itemId);
    } else {
      updatedItems = table.activeOrder.items.map(i => 
        i.id === itemId ? { ...i, status: 'VOIDED' as ItemPreparationStatus } : i
      );
    }

    const activeItems = updatedItems.filter(i => i.status !== 'VOIDED');
    const grandTotal = activeItems.reduce((acc, i) => acc + (i.finalItemPrice * i.quantity), 0);
    const subtotalNet = grandTotal / 1.13;
    const totalTax = grandTotal - subtotalNet;

    const updatedTable: Table = {
      ...table,
      currentTotal: grandTotal,
      activeOrder: {
        ...table.activeOrder,
        items: updatedItems,
        subtotalNet,
        totalTax,
        grandTotal
      }
    };

    const updatedTables = this.tables().map(t => t.id === tableId ? updatedTable : t);
    this.tables.set(updatedTables);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', tableId), cleanUndefined(updatedTable));
      } catch (e) {}
    }

    this.logAudit('ITEM_VOIDED', `Ακύρωση ${targetItem.productName} (${reason}) - Τραπέζι #${table.number || table.tableNumber}`, table.number || table.tableNumber);
  }

  sendOrderToKitchen(tableId: string) {
    const table = this.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const updatedItems = table.activeOrder.items.map(i => 
      i.status === 'PENDING' ? { ...i, status: 'SENT_TO_KITCHEN' as const } : i
    );

    const updatedT: Table = { ...table, status: 'OCCUPIED' as const, activeOrder: { ...table.activeOrder, items: updatedItems } };
    const updatedTables = this.tables().map(t => t.id === tableId ? updatedT : t);
    this.tables.set(updatedTables);

    if (this.db) {
      setDoc(doc(this.db, 'tables', tableId), cleanUndefined(updatedT)).catch(() => {});
    }
  }

  public async updateOrderItemStatus(orderId: string, itemId: string, newStatus: ItemPreparationStatus): Promise<void> {
    const targetTable = this.tables().find(t => t.activeOrder?.orderId === orderId);
    if (!targetTable || !targetTable.activeOrder) return;

    const updatedItems = targetTable.activeOrder.items.map(item =>
      item.id === itemId ? { ...item, status: newStatus } : item
    );

    const updatedTable: Table = {
      ...targetTable,
      activeOrder: {
        ...targetTable.activeOrder,
        items: updatedItems
      }
    };

    const updatedTables = this.tables().map(t => t.id === targetTable.id ? updatedTable : t);
    this.tables.set(updatedTables);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', targetTable.id), cleanUndefined(updatedTable), { merge: true });
      } catch (e) {}
    }
  }

  bumpOrderItemStatus(tableId: string, itemId: string) {
    const table = this.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const updatedItems = table.activeOrder.items.map(item => {
      if (item.id === itemId) {
        let nextStatus: ItemPreparationStatus = 'PREPARING';
        if (item.status === 'PREPARING') nextStatus = 'SERVED';
        return { ...item, status: nextStatus };
      }
      return item;
    });

    const updatedT: Table = { ...table, activeOrder: { ...table.activeOrder, items: updatedItems } };
    const updatedTables = this.tables().map(t => t.id === tableId ? updatedT : t);
    this.tables.set(updatedTables);

    if (this.db) {
      setDoc(doc(this.db, 'tables', tableId), cleanUndefined(updatedT)).catch(() => {});
    }
  }

  completeKitchenTicket(orderId: string, tableId: string) {
    const table = this.tables().find(t => t.id === tableId);
    if (table && table.activeOrder) {
      const updatedItems = table.activeOrder.items.map(i => ({ ...i, status: 'SERVED' as ItemPreparationStatus }));
      const updatedT: Table = { ...table, activeOrder: { ...table.activeOrder, items: updatedItems } };
      const updatedTables = this.tables().map(t => t.id === tableId ? updatedT : t);
      this.tables.set(updatedTables);

      if (this.db) {
        setDoc(doc(this.db, 'tables', tableId), cleanUndefined(updatedT)).catch(() => {});
      }
    }
  }

  async markTableBillPrinted(tableId: string) {
    const table = this.tables().find(t => t.id === tableId);
    if (!table) return;

    const updatedT: Table = { ...table, status: 'BILL_PRINTED' as const };
    const updated = this.tables().map(t => t.id === tableId ? updatedT : t);
    this.tables.set(updated);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', tableId), {
          status: 'BILL_PRINTED',
          updatedAt: Timestamp.now()
        }, { merge: true });
      } catch (e) {}
    }

    this.logAudit('BILL_PRINTED', `Εκτύπωση λογαριασμού τραπεζιού`, table.number || table.tableNumber);
  }

  async settleTablePayment(tableId: string, paymentMethod: 'CASH' | 'CARD' | 'DEBT') {
    const table = this.tables().find(t => t.id === tableId);
    if (!table) return;

    const grandTotal = table.activeOrder?.grandTotal || table.currentTotal || 0;
    const tableNum = table.number || table.tableNumber || 0;
    const waiter = this.currentEmployee() || { id: 'WAITER', name: 'Σερβιτόρος' };

    const saleRecord: SaleRecord = {
      id: `SALE-${Date.now()}`,
      orderId: table.activeOrder?.orderId || `ORD-${Date.now()}`,
      tableId: table.id,
      tableNumber: tableNum,
      waiterId: waiter.id,
      waiterName: waiter.name,
      paymentMethod,
      items: table.activeOrder?.items || [],
      subtotalNet: table.activeOrder?.subtotalNet || (grandTotal / 1.13),
      totalTax: table.activeOrder?.totalTax || (grandTotal - (grandTotal / 1.13)),
      grandTotal,
      timestamp: new Date().toISOString()
    };

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'sales', saleRecord.id), cleanUndefined(saleRecord));
      } catch (e) {
        console.warn('Error writing sale record:', e);
      }
    }

    const vault = this.activeVaultSession();
    if (vault) {
      const updatedVault: WaiterVaultSession = {
        ...vault,
        cashCollected: paymentMethod === 'CASH' ? vault.cashCollected + grandTotal : vault.cashCollected,
        cardCollected: paymentMethod === 'CARD' ? vault.cardCollected + grandTotal : vault.cardCollected
      };
      this.activeVaultSession.set(updatedVault);

      if (this.db) {
        setDoc(doc(this.db, 'vaults', vault.id), cleanUndefined(updatedVault), { merge: true }).catch(() => {});
      }
    }

    const freedTable: Table = {
      ...table,
      status: 'FREE' as const,
      currentTotal: 0,
      activeOrder: undefined,
      activeOrderId: undefined,
      waiterId: undefined,
      assignedWaiterId: undefined,
      waiterName: undefined,
      assignedWaiterName: undefined
    };

    const updatedTables = this.tables().map(t => t.id === tableId ? freedTable : t);
    this.tables.set(updatedTables);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', tableId), cleanUndefined({
          ...freedTable,
          activeOrder: deleteField(),
          waiterId: deleteField(),
          waiterName: deleteField()
        }));
      } catch (e) {}
    }

    this.logAudit('PAYMENT_RECEIVED', `Εξόφληση €${grandTotal.toFixed(2)} (${paymentMethod}) - Τραπέζι #${tableNum}`, tableNum);
    this.router.navigate(['/floor-plan']);
  }

  // --- CATALOG & STAFF MANAGEMENT ---

  public async updateEmployee(updatedEmp: Employee): Promise<void> {
    const updatedList = this.employees().map(e => e.id === updatedEmp.id ? { ...updatedEmp } : e);
    this.employees.set(updatedList);

    if (this.currentEmployee()?.id === updatedEmp.id) {
      this.currentEmployee.set(updatedEmp);
    }

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'employees', updatedEmp.id), cleanUndefined(updatedEmp), { merge: true });
      } catch (e) {
        console.error('Error updating employee in Firestore:', e);
      }
    }

    this.logAudit('STAFF_UPDATED', `Ενημέρωση υπαλλήλου: ${updatedEmp.name}`);
  }

  addEmployee(empData: { name: string; pinCode: string; role: Role; hourlyRate: number }): { success: boolean; message: string; employee?: Employee } {
    const cleanPin = empData.pinCode.trim();
    if (!empData.name || cleanPin.length < 4 || cleanPin.length > 8) {
      return { success: false, message: 'Το PIN πρέπει να είναι 4 έως 8 ψηφία.' };
    }

    const existing = this.employees().find(e => e.pinCode === cleanPin || e.pin === cleanPin);
    if (existing) {
      return { success: false, message: 'Υπάρχει ήδη υπάλληλος με αυτό το PIN!' };
    }

    const newEmp: Employee = {
      id: `emp_${Date.now()}`,
      name: empData.name,
      pinCode: cleanPin,
      pin: cleanPin,
      role: empData.role,
      hourlyRate: empData.hourlyRate || 7.0,
      isActive: true,
      active: true,
      createdAt: new Date().toISOString()
    };

    const updated = [...this.employees(), newEmp];
    this.employees.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'employees', newEmp.id), cleanUndefined(newEmp)).catch(() => {});
    }

    this.logAudit('STAFF_ADDED', `Προσθήκη νέου υπαλλήλου: ${newEmp.name} (${newEmp.role})`);
    return { success: true, message: 'Ο υπάλληλος δημιουργήθηκε επιτυχώς', employee: newEmp };
  }

  toggleEmployeeActiveStatus(empId: string, isActive: boolean) {
    const updated = this.employees().map(e => e.id === empId ? { ...e, isActive, active: isActive } : e);
    this.employees.set(updated);

    if (this.db) {
      updateDoc(doc(this.db, 'employees', empId), { isActive, active: isActive }).catch(() => {});
    }

    this.logAudit('STAFF_STATUS_CHANGED', `Αλλαγή κατάστασης υπαλλήλου ID ${empId} -> ${isActive ? 'ΕΝΕΡΓΟΣ' : 'ΑΝΕΝΕΡΓΟΣ'}`);
  }

  toggleEmployeeStatus(empId: string, isActive: boolean) {
    this.toggleEmployeeActiveStatus(empId, isActive);
  }

  addCategory(name: string, icon: string = '📁'): { success: boolean; message: string; category?: Category } {
    if (!name.trim()) {
      return { success: false, message: 'Το όνομα κατηγορίας δεν μπορεί να είναι κενό.' };
    }

    const newCat: Category = {
      id: `CAT-${Date.now()}`,
      name: name.trim(),
      icon: icon || '📁',
      sortOrder: this.categories().length + 1
    };

    const updated = [...this.categories(), newCat];
    this.categories.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'categories', newCat.id), cleanUndefined(newCat)).catch(() => {});
    }

    this.logAudit('CATEGORY_ADDED', `Προσθήκη νέας κατηγορίας: ${newCat.name}`);
    return { success: true, message: 'Η κατηγορία δημιουργήθηκε επιτυχώς', category: newCat };
  }

  deleteCategory(catId: string): void {
    const cat = this.categories().find(c => c.id === catId);
    const updated = this.categories().filter(c => c.id !== catId);
    this.categories.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'categories', catId)).catch(() => {});
    }

    this.logAudit('CATEGORY_DELETED', `Διαγραφή κατηγορίας: ${cat?.name || catId}`);
  }

  addProduct(prodData: { name: string; categoryId: string; price: number; purchasePrice?: number; taxRate: GreekVatRate; isPinnedToPOS?: boolean }) {
    const category = this.categories().find(c => c.id === prodData.categoryId);
    const newProd: Product = {
      id: `PRD-${Date.now()}`,
      name: prodData.name,
      categoryId: prodData.categoryId,
      categoryName: category?.name || 'Γενικά',
      price: prodData.price,
      purchasePrice: prodData.purchasePrice || 0,
      costPrice: prodData.purchasePrice || 0,
      taxRate: prodData.taxRate,
      stockCount: 100,
      isPinnedToPOS: prodData.isPinnedToPOS ?? true,
      isActive: true
    };

    const updated = [...this.products(), newProd];
    this.products.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'products', newProd.id), cleanUndefined(newProd)).catch(() => {});
    }

    this.logAudit('PRODUCT_ADDED', `Προσθήκη προϊόντος στον τιμοκατάλογο: ${newProd.name} (€${newProd.price.toFixed(2)})`);
  }

  updateProduct(prodId: string, prodData: Partial<Product>) {
    const existing = this.products().find(p => p.id === prodId);
    if (!existing) return;

    let categoryName = existing.categoryName;
    if (prodData.categoryId && prodData.categoryId !== existing.categoryId) {
      const cat = this.categories().find(c => c.id === prodData.categoryId);
      categoryName = cat?.name || categoryName;
    }

    const updatedProd: Product = {
      ...existing,
      ...prodData,
      categoryName
    };

    const updatedList = this.products().map(p => p.id === prodId ? updatedProd : p);
    this.products.set(updatedList);

    if (this.db) {
      setDoc(doc(this.db, 'products', prodId), cleanUndefined(updatedProd), { merge: true }).catch(() => {});
    }

    this.logAudit('PRODUCT_UPDATED', `Ενημέρωση προϊόντος: ${updatedProd.name} (€${updatedProd.price.toFixed(2)})`);
  }

  deleteProduct(prodId: string) {
    const target = this.products().find(p => p.id === prodId);
    const updated = this.products().filter(p => p.id !== prodId);
    this.products.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'products', prodId)).catch(() => {});
    }

    this.logAudit('PRODUCT_DELETED', `Διαγραφή προϊόντος: ${target?.name || prodId}`);
  }

  addSpoilageEntry(spoilData: { itemName: string; quantity: number; unit: UnitOfMeasure; reason: string }) {
    const emp = this.currentEmployee() || { id: 'SYSTEM', name: 'Υπάλληλος' };

    const newLog: SpoilageLog = {
      id: `SPOIL-${Date.now()}`,
      itemId: `ITEM-${Date.now()}`,
      itemName: spoilData.itemName.trim(),
      quantityWasted: spoilData.quantity,
      unit: spoilData.unit,
      costLossNet: 0,
      reason: spoilData.reason.trim() || 'Φύρα',
      loggedByEmployeeId: emp.id,
      loggedByEmployeeName: emp.name,
      timestamp: new Date().toISOString()
    };

    const updated = [newLog, ...this.spoilageLogs()];
    this.spoilageLogs.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'spoilageLogs', newLog.id), cleanUndefined(newLog)).catch(() => {});
    }

    this.logAudit('SPOILAGE_LOGGED', `Καταγραφή ζημιάς/φύρας: ${newLog.itemName} (${spoilData.quantity} ${spoilData.unit}) - ${newLog.reason}`);
  }

  // --- FINANCIAL & REPORTS COMPUTED SIGNALS ---

  totalDailyCashInVaults = computed(() => {
    return this.allVaultSessions().reduce((acc, v) => acc + (v.cashCollected || 0), 0);
  });

  totalDailyCardInVaults = computed(() => {
    return this.allVaultSessions().reduce((acc, v) => acc + (v.cardCollected || 0), 0);
  });

  totalLiveFloorRevenue = computed(() => {
    return this.tables().reduce((acc, t) => {
      const isOccupied = t.status === 'OCCUPIED' || t.status === 'BILL_PRINTED';
      const orderTotal = t.activeOrder?.grandTotal || t.currentTotal || 0;
      return acc + (isOccupied ? orderTotal : 0);
    }, 0);
  });

  occupiedTables = computed(() => {
    return this.tables().filter(t => t.status === 'OCCUPIED' || t.status === 'BILL_PRINTED');
  });

  totalDailyStartingFloats = computed(() => {
    return this.allVaultSessions().reduce((acc, v) => acc + (v.startingFloat || 0), 0);
  });

  totalDailyGrossSales = computed(() => {
    const settledSalesTotal = this.salesHistory().reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    return settledSalesTotal + this.totalLiveFloorRevenue();
  });

  public getEmployeeActiveShift(employeeId: string): WorkShiftLog | undefined {
    return this.workShifts().find(s => s.employeeId === employeeId && s.status === 'WORKING');
  }

  vatBreakdown = computed(() => {
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

  closeDayAndGenerateZReport(): DailyZReportSnapshot {
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

  async resetDatabaseToDefaults(): Promise<void> {
    if (!this.db) return;

    try {
      const collectionsToWipe = ['tables', 'shifts', 'vaults', 'auditLogs', 'spoilageLogs', 'z_reports', 'sales'];

      for (const colName of collectionsToWipe) {
        const snap = await getDocs(collection(this.db, colName));
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(this.db, colName, docSnap.id));
        }
      }

      this.knownItemStatusMap.clear();
      this.isInitialTablesSync = true;
      this.unreadReadyNotifications.set([]);
      this.workShifts.set([]);
      this.allVaultSessions.set([]);
      this.activeVaultSessions.set([]);
      this.activeWorkShift.set(null);
      this.activeVaultSession.set(null);
      this.spoilageLogs.set([]);
      this.auditLogs.set([]);
      this.zReports.set([]);
      this.salesHistory.set([]);

      for (const table of INITIAL_TABLES) {
        await setDoc(doc(this.db, 'tables', table.id), cleanUndefined(table));
      }

      this.tables.set(INITIAL_TABLES);
      this.logAudit('MASTER_RESET', '🔥 Πλήρης Μηδενισμός Βάσης & Fresh Start');
    } catch (e) {
      console.error('Database reset warning:', e);
    }
  }

  public checkActiveShiftOrAutoKick(): void {
    const current = this.currentEmployee();
    if (!current) return;

    // Kitchen/Bar/Admin bypass
    if (current.role === 'ADMIN' || current.role === 'MANAGER') return;

    const activeShift = this.getEmployeeActiveShift(current.id);
    if (!activeShift || activeShift.status === 'COMPLETED') {
      this.logoutEmployee();
    }
  }

  public async registerEmployeeBiometrics(employee: Employee): Promise<{ success: boolean; message: string }> {
    if (!window.PublicKeyCredential) {
      return { success: false, message: 'Η συσκευή δεν υποστηρίζει βιομετρική ταυτοποίηση.' };
    }

    try {
      const encoder = new TextEncoder();
      const userIdBuffer = encoder.encode(employee.id);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
          rp: { name: 'Maranth Estiasi POS', id: window.location.hostname },
          user: {
            id: userIdBuffer,
            name: employee.name,
            displayName: employee.name
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (credential) {
        employee.biometricPublicKey = credential.id;
        await this.updateEmployee(employee);
        return { success: true, message: 'Το αποτύπωμα καταχωρήθηκε με επιτυχία!' };
      }

      return { success: false, message: 'Ακύρωση καταχώρησης.' };
    } catch (error: any) {
      console.error('Biometric registration error:', error);
      return { success: false, message: 'Αποτυχία καταχώρησης αποτυπώματος.' };
    }
  }

  public recordGoodsReceiving(data: {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
}): void {
  const materials = this.rawMaterials();
  const existing = materials.find(
    m => m.name.toLowerCase() === data.itemName.toLowerCase()
  );

  if (existing) {
    this.updateRawMaterial(existing.id, {
      currentStock: (existing.currentStock || 0) + data.quantity,
      costPerUnit: data.unitPrice > 0 ? data.unitPrice : existing.costPerUnit
    });
  } else {
    this.addRawMaterial({
      name: data.itemName,
      unit: data.unit as any,
      currentStock: data.quantity,
      minAlertStock: 2,
      costPerUnit: data.unitPrice
    });
  }
}

public logSpoilage(data: {
  itemName: string;
  quantityWasted: number;
  unit: UnitOfMeasure; // 👈 Updated from string to UnitOfMeasure
  reason: string;
}): void {
  const currentEmp = this.currentEmployee();
  
  const material = this.rawMaterials().find(
    m => m.name.toLowerCase() === data.itemName.toLowerCase()
  );

  const unitCost = material?.costPerUnit || 0;
  const calculatedCostLoss = Number((unitCost * data.quantityWasted).toFixed(2));

  if (material) {
    const updatedStock = Math.max(0, material.currentStock - data.quantityWasted);
    this.updateRawMaterial(material.id, { currentStock: updatedStock });
  }

  const newLog: SpoilageLog = {
    id: 'SPOIL-' + Date.now(),
    itemId: material?.id || 'CUSTOM-ITEM',
    itemName: data.itemName,
    quantityWasted: data.quantityWasted,
    unit: data.unit as UnitOfMeasure, // 👈 Explicit cast avoids ts(2322)
    costLossNet: calculatedCostLoss,
    reason: data.reason,
    loggedByEmployeeId: currentEmp?.id || 'EMP-SYSTEM',
    loggedByEmployeeName: currentEmp?.name || 'Συστήματος',
    timestamp: new Date().toISOString()
  };

  const currentLogs = this.spoilageLogs() || [];
  this.spoilageLogs.set([newLog, ...currentLogs]);
}

/**
 * 3. Master Fresh Start Reset
 */
public resetSystemData(): void {
  // Clear active table orders
  const resetTables = this.tables().map(t => ({
    ...t,
    status: 'FREE' as const,
    activeOrder: undefined,
    currentTotal: 0
  }));
  this.tables.set(resetTables);

  // Clear unread ready notifications
  this.unreadReadyNotifications.set([]);
  alert('✓ Το σύστημα επανήλθε σε αρχική κατάσταση!');
}

public closeWaiterVaultSession(closedSession: WaiterVaultSession): void {
    // 1. Update Vault Session State
    const currentSessions = this.activeVaultSessions() || [];
    const updatedVaults = currentSessions.map(s => s.id === closedSession.id ? closedSession : s);
    
    this.activeVaultSessions.set(updatedVaults);

    // Save closed vault state directly to Firestore
    if (this.db) {
      setDoc(doc(this.db, 'vaults', closedSession.id), cleanUndefined(closedSession), { merge: true }).catch(err => {
        console.error('Error updating vault in Firestore:', err);
      });
    }

    // 2. 🎯 AUTOMATICALLY CLOCK-OUT WORK SHIFT LOG
    const nowIso = new Date().toISOString();
    const currentWorkShifts = this.workShifts() || [];

    const updatedWorkShifts = currentWorkShifts.map((shift: WorkShiftLog) => {
      if (shift.employeeId === closedSession.waiterId && shift.status === 'WORKING') {
        const clockIn = new Date(shift.clockInTime).getTime();
        const clockOut = new Date(nowIso).getTime();
        const hours = Math.max(0, (clockOut - clockIn) / 3600000);

        const closedShift: WorkShiftLog = {
          ...shift,
          clockOutTime: nowIso,
          totalHoursWorked: Number(hours.toFixed(2)),
          earnedAmount: Number((hours * shift.hourlyRateAtShift).toFixed(2)),
          status: 'COMPLETED' as const
        };

        // Sync closed shift to Firestore
        if (this.db) {
          setDoc(doc(this.db, 'shifts', closedShift.id), cleanUndefined(closedShift), { merge: true }).catch(() => {});
        }

        return closedShift;
      }
      return shift;
    });

    this.workShifts.set(updatedWorkShifts);

    // 3. Log Audit Event to Firestore
    this.logAudit(
      'VAULT_CLOSED',
      `Κλείσιμο ταμείου & έξοδος βάρδιας (Clock-Out) - ${closedSession.waiterName}. Παραδόθηκαν: €${closedSession.cashHandedOver?.toFixed(2) || '0.00'}`
    );
  }

  /**
   * Helper method for compatibility accepting a full AuditLog object
   */
  public logAuditEvent(log: AuditLog): void {
    this.logAudit(log.action, log.details, log.tableNumber);
  }

  /**
   * Core Audit Logging method (Saves locally + Firestore)
   */
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