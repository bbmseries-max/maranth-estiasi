import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';

import {
  Employee,
  EmployeeRole,
  WorkShiftLog,
  WaiterVaultSession,
  RestaurantTable,
  TableOrderItem,
  Product,
  Category,
  OrderModifier,
  PaymentMethod,
  AuditActionType,
  AuditLog,
  GreekVatRate,
  GREEK_VAT_TIERS
} from '../models/restaurant-pos.models';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDnixK-3v_bAjCFhvB6diDNp6eXoC2V4_c",
  authDomain: "maranth-estiasi.firebaseapp.com",
  projectId: "maranth-estiasi",
  storageBucket: "maranth-estiasi.firebasestorage.app",
  messagingSenderId: "927547122917",
  appId: "1:927547122917:web:7f6ab240c6e2f58967e00c"
};

@Injectable({
  providedIn: 'root'
})
export class RestaurantPosService {
  private app!: FirebaseApp;
  public db!: Firestore;
  private router = inject(Router);

  public employees = signal<Employee[]>([]);
  public currentEmployee = signal<Employee | null>(null);
  public activeWorkShift = signal<WorkShiftLog | null>(null);
  public activeVaultSession = signal<WaiterVaultSession | null>(null);

  public tables = signal<RestaurantTable[]>([]);
  public products = signal<Product[]>([]);
  public categories = signal<Category[]>([]);
  public auditLogs = signal<AuditLog[]>([]);

  public occupiedTables = computed(() => 
    this.tables().filter(t => t.status === 'OCCUPIED' || t.status === 'BILL_PRINTED')
  );

  public availableTables = computed(() => 
    this.tables().filter(t => t.status === 'AVAILABLE')
  );

  public totalLiveFloorRevenue = computed(() => {
    return this.occupiedTables().reduce((total, table) => {
      return total + (table.activeOrder?.grandTotal || 0);
    }, 0);
  });

  constructor() {
    this.employees.set(this.getInitialDefaultEmployees());
    this.tables.set(this.getInitialDefaultTables());
    this.products.set(this.getInitialDefaultProducts());
    this.categories.set(this.getInitialDefaultCategories());

    this.initializeFirebase();
    this.loadActiveSessionFromStorage();
  }

  private initializeFirebase(): void {
    if (typeof window === 'undefined') return;

    try {
      this.app = initializeApp(FIREBASE_CONFIG);
      this.db = getFirestore(this.app);

      // 1. Synchronize Tables
      onSnapshot(
        collection(this.db, 'tables'), 
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteTables = snapshot.docs.map(d => d.data() as RestaurantTable);
            this.tables.update(current => {
              const tableMap = new Map(current.map(item => [item.id, item]));
              remoteTables.forEach(item => tableMap.set(item.id, item));
              const merged = Array.from(tableMap.values());
              merged.sort((a, b) => a.tableNumber - b.tableNumber);
              return merged;
            });
          }
        },
        (error) => console.warn('Firestore tables sync offline/blocked:', error.message)
      );

      // 2. Synchronize Employees & PINs
      onSnapshot(
        collection(this.db, 'employees'), 
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteEmp = snapshot.docs.map(d => d.data() as Employee);
            this.employees.update(current => {
              const empMap = new Map(current.map(e => [e.id, e]));
              remoteEmp.forEach(e => empMap.set(e.id, e));
              return Array.from(empMap.values());
            });
          }
        },
        (error) => console.warn('Firestore employees sync offline:', error.message)
      );

      // 3. Synchronize Menu Products
      onSnapshot(
        collection(this.db, 'products'), 
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteProds = snapshot.docs.map(d => d.data() as Product);
            this.products.update(current => {
              const prodMap = new Map(current.map(p => [p.id, p]));
              remoteProds.forEach(p => prodMap.set(p.id, p));
              return Array.from(prodMap.values());
            });
          }
        },
        (error) => console.warn('Firestore products sync offline:', error.message)
      );

      // 4. Synchronize Categories
      onSnapshot(
        collection(this.db, 'categories'), 
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteCats = snapshot.docs.map(d => d.data() as Category);
            this.categories.update(current => {
              const catMap = new Map(current.map(c => [c.id, c]));
              remoteCats.forEach(c => catMap.set(c.id, c));
              const merged = Array.from(catMap.values());
              merged.sort((a, b) => a.sortOrder - b.sortOrder);
              return merged;
            });
          }
        },
        (error) => console.warn('Firestore categories sync offline:', error.message)
      );

      // 5. Synchronize Security Audit Trail
      const auditQuery = query(collection(this.db, 'auditLogs'), orderBy('timestamp', 'desc'));
      onSnapshot(
        auditQuery, 
        (snapshot) => {
          const logs = snapshot.docs.map(d => d.data() as AuditLog);
          this.auditLogs.set(logs);
        },
        (error) => console.warn('Firestore audit logs sync offline:', error.message)
      );

    } catch (error) {
      console.warn('Firebase Initialization Deferred:', error);
    }
  }

  public loginWithPin(pin: string): { success: boolean; message: string } {
    const cleanPin = pin.trim();
    const matchedEmployee = this.employees().find(e => e.pinCode === cleanPin && e.isActive);

    if (!matchedEmployee) {
      return { success: false, message: 'Μη έγκυρος κωδικός PIN ή ανενεργός υπάλληλος' };
    }

    this.currentEmployee.set(matchedEmployee);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('estiasi_active_employee_id', matchedEmployee.id);
    }

    this.logAudit('CLOCK_IN', `Είσοδος στο σύστημα: ${matchedEmployee.name}`);
    return { success: true, message: `Καλώς ήρθατε, ${matchedEmployee.name}` };
  }

  public logoutEmployee(): void {
    const emp = this.currentEmployee();
    if (emp) {
      this.logAudit('CLOCK_OUT', `Έξοδος από το σύστημα: ${emp.name}`);
    }
    this.currentEmployee.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('estiasi_active_employee_id');
    }
    this.router.navigate(['/login']);
  }

  public addEmployee(employeeData: {
    name: string;
    pinCode: string;
    role: EmployeeRole;
    hourlyRate: number;
    phone?: string;
  }): { success: boolean; message: string; employee?: Employee } {
    const cleanPin = employeeData.pinCode.trim();
    
    // Check if PIN code is already used by another staff member
    const pinExists = this.employees().some(e => e.pinCode === cleanPin);
    if (pinExists) {
      return { success: false, message: 'Το 4-ψήφιο PIN χρησιμοποιείται ήδη από άλλον υπάλληλο!' };
    }

    const newEmp: Employee = {
      id: `EMP-${Date.now().toString().slice(-4)}`,
      name: employeeData.name.trim(),
      pinCode: cleanPin,
      role: employeeData.role,
      hourlyRate: employeeData.hourlyRate || 0,
      isActive: true,
      phone: employeeData.phone || '',
      createdAt: new Date().toISOString()
    };

    this.employees.update(list => [...list, newEmp]);
    this.safeFirestoreSet('employees', newEmp.id, newEmp);
    this.logAudit('CLOCK_IN', `Προσθήκη νέου στελέχους: ${newEmp.name} (${newEmp.role}) - PIN: ${newEmp.pinCode}`);

    return { success: true, message: `Ο/Η ${newEmp.name} καταχωρήθηκε επιτυχώς!`, employee: newEmp };
  }

  public toggleEmployeeActiveStatus(employeeId: string, isActive: boolean): void {
    const employee = this.employees().find(e => e.id === employeeId);
    if (!employee) return;

    const updatedEmployee: Employee = {
      ...employee,
      isActive: isActive
    };

    this.employees.update(list => list.map(e => e.id === employeeId ? updatedEmployee : e));
    this.safeFirestoreSet('employees', employeeId, updatedEmployee);

    const actionText = isActive ? 'Επαναφορά / Ενεργοποίηση' : 'Αποδέσμευση / Απομάκρυνση (Απόλυση)';
    this.logAudit('CLOCK_OUT', `Αλλαγή κατάστασης προσωπικού: ${employee.name} -> ${actionText}`);
  }

  public clockInShift(notes?: string): WorkShiftLog | null {
    const emp = this.currentEmployee();
    if (!emp) return null;

    const newShift: WorkShiftLog = {
      id: `SHIFT-${Date.now()}-${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      clockInTime: new Date().toISOString(),
      hourlyRateAtShift: emp.hourlyRate || 0,
      notes: notes || 'Έναρξη βάρδιας',
      status: 'WORKING'
    };

    this.activeWorkShift.set(newShift);
    this.safeFirestoreSet('shifts', newShift.id, newShift);
    this.logAudit('CLOCK_IN', `Έναρξη ωρομετρητή βάρδιας για ${emp.name}`);
    return newShift;
  }

  public openWaiterVault(startingFloat: number): WaiterVaultSession | null {
    const emp = this.currentEmployee();
    const shift = this.activeWorkShift();
    if (!emp) return null;

    const newVault: WaiterVaultSession = {
      id: `VAULT-${Date.now()}-${emp.id}`,
      shiftLogId: shift?.id || `SHIFT-${Date.now()}`,
      waiterId: emp.id,
      waiterName: emp.name,
      openedAt: new Date().toISOString(),
      startingFloat: startingFloat,
      cashCollected: 0,
      cardCollected: 0,
      status: 'OPEN'
    };

    this.activeVaultSession.set(newVault);
    this.safeFirestoreSet('vaults', newVault.id, newVault);
    return newVault;
  }

  public addOrderItemToTable(
    tableId: string, 
    product: Product, 
    selectedModifiers: OrderModifier[] = [], 
    itemNotes?: string
  ): void {
    const emp = this.currentEmployee();
    if (!emp) return;

    const table = this.tables().find(t => t.id === tableId);
    if (!table) return;

    const modifierExtraTotal = selectedModifiers.reduce((sum, mod) => sum + mod.priceExtra, 0);
    const unitPriceFinal = product.price + modifierExtraTotal;

    const newItem: TableOrderItem = {
      id: `ITEM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 1,
      taxRate: product.taxRate,
      modifiers: selectedModifiers,
      finalItemPrice: unitPriceFinal,
      itemNotes: itemNotes || '',
      orderedByWaiterId: emp.id,
      orderedByWaiterName: emp.name,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };

    const currentOrder = table.activeOrder || {
      orderId: `ORD-${Date.now()}-${table.tableNumber}`,
      openedAt: new Date().toISOString(),
      items: [],
      subtotalNet: 0,
      totalTax: 0,
      grandTotal: 0
    };

    const updatedItems = [...currentOrder.items, newItem];
    const totals = this.calculateOrderTotals(updatedItems);

    const updatedTable: RestaurantTable = {
      ...table,
      status: 'OCCUPIED',
      assignedWaiterId: emp.id,
      assignedWaiterName: emp.name,
      activeOrder: {
        ...currentOrder,
        items: updatedItems,
        ...totals
      }
    };

    this.updateLocalTable(updatedTable);
    this.safeFirestoreSet('tables', table.id, updatedTable);
    this.logAudit('ITEM_ADDED', `Προσθήκη ${product.name} στο Τραπέζι ${table.tableNumber}`, table.tableNumber);
  }

  public sendOrderToKitchen(tableId: string): void {
    const table = this.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const updatedItems = table.activeOrder.items.map(item => ({
      ...item,
      status: item.status === 'PENDING' ? ('SENT_TO_KITCHEN' as const) : item.status
    }));

    const updatedTable: RestaurantTable = {
      ...table,
      activeOrder: {
        ...table.activeOrder,
        items: updatedItems
      }
    };

    this.updateLocalTable(updatedTable);
    this.safeFirestoreSet('tables', table.id, updatedTable);
    this.logAudit('ORDER_CREATED', `Αποστολή παραγγελίας στην κουζίνα - Τραπέζι ${table.tableNumber}`, table.tableNumber);
  }

  public transferTable(fromTableId: string, toTableId: string): boolean {
    const fromTable = this.tables().find(t => t.id === fromTableId);
    const toTable = this.tables().find(t => t.id === toTableId);

    if (!fromTable || !toTable || !fromTable.activeOrder || toTable.status !== 'AVAILABLE') {
      return false;
    }

    const updatedToTable: RestaurantTable = {
      ...toTable,
      status: 'OCCUPIED',
      assignedWaiterId: fromTable.assignedWaiterId,
      assignedWaiterName: fromTable.assignedWaiterName,
      activeOrder: { ...fromTable.activeOrder }
    };

    const resetFromTable: RestaurantTable = {
      ...fromTable,
      status: 'AVAILABLE',
      assignedWaiterId: undefined,
      assignedWaiterName: undefined,
      activeOrder: undefined
    };

    this.updateLocalTable(updatedToTable);
    this.updateLocalTable(resetFromTable);

    this.safeFirestoreSet('tables', toTable.id, updatedToTable);
    this.safeFirestoreSet('tables', fromTable.id, resetFromTable);

    this.logAudit('TABLE_TRANSFERRED', `Μεταφορά παραγγελίας από Τραπέζι #${fromTable.tableNumber} στο Τραπέζι #${toTable.tableNumber}`);
    return true;
  }

  public settleTablePayment(tableId: string, paymentMethod: PaymentMethod): void {
    const table = this.tables().find(t => t.id === tableId);
    if (!table || !table.activeOrder) return;

    const grandTotal = table.activeOrder.grandTotal;

    const vault = this.activeVaultSession();
    if (vault) {
      const updatedVault: WaiterVaultSession = {
        ...vault,
        cashCollected: paymentMethod === 'CASH' ? vault.cashCollected + grandTotal : vault.cashCollected,
        cardCollected: paymentMethod === 'CARD' ? vault.cardCollected + grandTotal : vault.cardCollected
      };
      this.activeVaultSession.set(updatedVault);
      this.safeFirestoreSet('vaults', vault.id, updatedVault);
    }

    const clearedTable: RestaurantTable = {
      ...table,
      status: 'AVAILABLE',
      assignedWaiterId: undefined,
      assignedWaiterName: undefined,
      activeOrder: undefined
    };

    this.updateLocalTable(clearedTable);
    this.safeFirestoreSet('tables', table.id, clearedTable);
    this.logAudit('PAYMENT_RECEIVED', `Εξόφληση €${grandTotal.toFixed(2)} (${paymentMethod}) - Τραπέζι #${table.tableNumber}`, table.tableNumber);
  }

  public addProduct(productData: {
    name: string;
    categoryId: string;
    price: number;
    purchasePrice: number;
    taxRate: GreekVatRate;
    isPinnedToPOS?: boolean;
  }): Product {
    const cat = this.categories().find(c => c.id === productData.categoryId);

    const newProduct: Product = {
      id: `PRD-${Date.now()}`,
      name: productData.name.trim(),
      categoryId: productData.categoryId,
      categoryName: cat?.name || 'Γενικά',
      price: productData.price,
      purchasePrice: productData.purchasePrice,
      taxRate: productData.taxRate,
      isWeighted: false,
      isPinnedToPOS: productData.isPinnedToPOS ?? true,
      isActive: true
    };

    this.products.update(list => [...list, newProduct]);
    this.safeFirestoreSet('products', newProduct.id, newProduct);
    this.logAudit('GOODS_RECEIVED', `Προσθήκη νέου προϊόντος: ${newProduct.name} (€${newProduct.price.toFixed(2)})`);
    return newProduct;
  }

  public addCategory(categoryName: string, colorCode: string = '#3b82f6'): Category {
    const newCategory: Category = {
      id: `CAT-${Date.now()}`,
      name: categoryName.trim(),
      sortOrder: this.categories().length + 1,
      colorCode: colorCode
    };

    this.categories.update(list => [...list, newCategory]);
    this.safeFirestoreSet('categories', newCategory.id, newCategory);
    return newCategory;
  }

  private updateLocalTable(updatedTable: RestaurantTable): void {
    this.tables.update(list => 
      list.map(t => t.id === updatedTable.id ? updatedTable : t)
    );
  }

  private calculateOrderTotals(items: TableOrderItem[]) {
    let subtotalNet = 0;
    let totalTax = 0;

    items.forEach(item => {
      if (item.status === 'VOIDED') return;
      
      const lineGross = item.finalItemPrice * item.quantity;
      const vatTier = GREEK_VAT_TIERS[item.taxRate as keyof typeof GREEK_VAT_TIERS] || GREEK_VAT_TIERS[24];
      const lineNet = lineGross / vatTier.divisor;
      const lineTax = lineGross - lineNet;

      subtotalNet += lineNet;
      totalTax += lineTax;
    });

    return {
      subtotalNet: parseFloat(subtotalNet.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal: parseFloat((subtotalNet + totalTax).toFixed(2))
    };
  }

  public logAudit(action: AuditActionType, details: string, tableNumber?: number): void {
    const emp = this.currentEmployee() || { id: 'SYSTEM', name: 'Σύστημα' };
    const log: AuditLog = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      employeeId: emp.id,
      employeeName: emp.name,
      action: action,
      ...(tableNumber !== undefined ? { tableNumber } : {}),
      details: details
    };

    this.auditLogs.update(logs => [log, ...logs]);
    this.safeFirestoreSet('auditLogs', log.id, log);
  }

  private safeFirestoreSet(collectionName: string, docId: string, data: any): void {
    if (this.db) {
      const sanitizedData = JSON.parse(JSON.stringify(data));
      setDoc(doc(this.db, collectionName, docId), sanitizedData).catch(err => {
        console.warn(`Firestore write to ${collectionName}/${docId} deferred (offline or adblocker):`, err.message);
      });
    }
  }

  private loadActiveSessionFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    const empId = localStorage.getItem('estiasi_active_employee_id');
    if (empId) {
      const match = this.employees().find(e => e.id === empId);
      if (match) this.currentEmployee.set(match);
    }
  }

  private getInitialDefaultEmployees(): Employee[] {
    return [
      { id: 'EMP-01', name: 'Νίκος (Manager)', pinCode: '1111', role: 'MANAGER', hourlyRate: 8.50, isActive: true, createdAt: new Date().toISOString() },
      { id: 'EMP-02', name: 'Μαρία (Σερβιτόρος)', pinCode: '2222', role: 'WAITER', hourlyRate: 6.50, isActive: true, createdAt: new Date().toISOString() },
      { id: 'EMP-03', name: 'Γιώργος (Barista)', pinCode: '3333', role: 'BARISTA', hourlyRate: 7.00, isActive: true, createdAt: new Date().toISOString() }
    ];
  }

  private getInitialDefaultTables(): RestaurantTable[] {
    return [
      { id: 'T-01', tableNumber: 1, zone: 'Σάλα', status: 'AVAILABLE', capacity: 4 },
      { id: 'T-02', tableNumber: 2, zone: 'Σάλα', status: 'AVAILABLE', capacity: 2 },
      { id: 'T-03', tableNumber: 3, zone: 'Σάλα', status: 'AVAILABLE', capacity: 6 },
      { id: 'T-04', tableNumber: 4, zone: 'Βεράντα', status: 'AVAILABLE', capacity: 4 },
      { id: 'T-05', tableNumber: 5, zone: 'Βεράντα', status: 'AVAILABLE', capacity: 4 },
      { id: 'T-06', tableNumber: 6, zone: 'Μπαρ', status: 'AVAILABLE', capacity: 2 }
    ];
  }

  private getInitialDefaultCategories(): Category[] {
    return [
      { id: 'CAT-COFFEE', name: 'Καφέδες & Ροφήματα', sortOrder: 1, colorCode: '#3b82f6' },
      { id: 'CAT-DRINKS', name: 'Αναψυκτικά & Ποτά', sortOrder: 2, colorCode: '#10b981' },
      { id: 'CAT-FOOD', name: 'Σάντουιτς & Σνακ', sortOrder: 3, colorCode: '#f59e0b' }
    ];
  }

  private getInitialDefaultProducts(): Product[] {
    return [
      { id: 'PRD-01', name: 'Φρέντο Εσπρέσο', categoryId: 'CAT-COFFEE', categoryName: 'Καφέδες & Ροφήματα', price: 2.20, purchasePrice: 0.40, taxRate: 13, isWeighted: false, isPinnedToPOS: true, isActive: true },
      { id: 'PRD-02', name: 'Φρέντο Καπουτσίνο', categoryId: 'CAT-COFFEE', categoryName: 'Καφέδες & Ροφήματα', price: 2.50, purchasePrice: 0.50, taxRate: 13, isWeighted: false, isPinnedToPOS: true, isActive: true },
      { id: 'PRD-03', name: 'Φυσικός Χυμός Πορτοκάλι', categoryId: 'CAT-DRINKS', categoryName: 'Αναψυκτικά & Ποτά', price: 3.00, purchasePrice: 0.60, taxRate: 13, isWeighted: false, isPinnedToPOS: true, isActive: true },
      { id: 'PRD-04', name: 'Κλαμπ Σάντουιτς Γαλοπούλα', categoryId: 'CAT-FOOD', categoryName: 'Σάντουιτς & Σνακ', price: 5.50, purchasePrice: 1.80, taxRate: 13, isWeighted: false, isPinnedToPOS: true, isActive: true }
    ];
  }
}