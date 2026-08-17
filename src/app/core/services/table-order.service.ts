// src/app/core/services/table-order.service.ts

import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  deleteField, 
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { TenantContextService } from './tenant-context.service';

import { 
  Table, 
  ActiveOrder, 
  TableOrderItem,
  ItemPreparationStatus, 
  TableReservationInfo,
  Product, 
  OrderModifier, 
  SaleRecord, 
  ReadyNotification,
  SelectedModifier,  
  Employee 
} from '../modals';

export interface CartItem {
  product: Product;
  selectedModifiers: SelectedModifier[];
  price: number;
  quantity: number;
}

function normalizeKey(val?: string | null): string {
  if (!val) return '';
  return String(val).trim().toLowerCase().replace(/[\s_-]+/g, '');
}

// 🛡️ Bulletproof payload sanitizer that preserves deleteField() and catches NaN errors
function safeFirestorePayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'number') return isNaN(obj) ? 0 : obj;
  if (typeof obj !== 'object') return obj;
  
  // Preserve Firestore FieldValue operations (like deleteField)
  if (obj && typeof obj === 'object' && obj.constructor?.name === 'FieldValue') {
    return obj;
  }
  
  if (Array.isArray(obj)) return obj.map(safeFirestorePayload).filter(v => v !== undefined);
  
  const copy: any = {};
  for (const key of Object.keys(obj)) {
    const val = safeFirestorePayload(obj[key]);
    if (val !== undefined) {
      copy[key] = val;
    }
  }
  return copy;
}

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
export class TableOrderService {
  private tenantContext = inject(TenantContextService);
  private router = inject(Router);
  private db: Firestore | null = null;
  private activeTablesUnsub: Unsubscribe | null = null;

  public cartItems = signal<CartItem[]>([]);

  // Signals
  public tables = signal<Table[]>([]);
  public activeOrders = signal<ActiveOrder[]>([]);
  public unreadReadyNotifications = signal<ReadyNotification[]>([]);

  // Internal Tracking Maps
  private knownItemStatusMap = new Map<string, ItemPreparationStatus>();
  private isInitialTablesSync = true;

  // --- SAFE OCCUPIED TABLES COMPUTATION ---
  public occupiedTables = computed(() => 
    this.tables().filter(t => {
      const hasActiveItems = Boolean(
        t.activeOrder?.items && 
        t.activeOrder.items.some(i => (i as any).status !== 'VOIDED')
      );
      const isMarkedOccupied = t.status === 'OCCUPIED' || t.status === 'BILL_PRINTED';
      const hasTotal = Number(t.currentTotal || t.activeOrder?.grandTotal || 0) > 0;

      return (isMarkedOccupied || hasActiveItems || hasTotal) && t.status !== 'FREE';
    })
  );

  // --- SAFE TOTAL LIVE FLOOR REVENUE COMPUTATION ---
  public totalLiveFloorRevenue = computed(() => 
    this.tables().reduce((acc, t) => {
      const items = t.activeOrder?.items || [];
      const calculatedItemsTotal = items
        .filter(i => (i as any).status !== 'VOIDED')
        .reduce((sum, i) => {
          const itemPrice = Number(i.finalItemPrice || (i as any).unitPrice || (i as any).price || 0);
          const qty = Number(i.quantity || 1);
          return sum + (itemPrice * qty);
        }, 0);

      const orderTotal = calculatedItemsTotal > 0 
        ? calculatedItemsTotal 
        : Number(t.activeOrder?.grandTotal || t.currentTotal || 0);

      const hasItems = items.length > 0;
      const isOccupied = t.status === 'OCCUPIED' || t.status === 'BILL_PRINTED' || hasItems || orderTotal > 0;

      return acc + (isOccupied && t.status !== 'FREE' ? orderTotal : 0);
    }, 0)
  );

  public getActiveTenantAndStore(): { tenantId: string; storeId: string } {
    const tenantId = 
      localStorage.getItem('active_tenant_id') ||
      (this.tenantContext as any).currentTenantId?.() || 
      (this.tenantContext as any).tenantId?.() || 
      'coffee-shop-demo';

    const storeId = 
      localStorage.getItem('active_store_id') ||
      (this.tenantContext as any).currentStoreId?.() || 
      (this.tenantContext as any).activeStoreId?.() || 
      (this.tenantContext as any).storeId?.() || 
      'store-1';

    return { tenantId, storeId };
  }

  public getInitialDefaultTables(tenantId: string, storeId: string): Table[] {
    return [
      { id: `${storeId}_t1`, tenantId, storeId, number: 1, tableNumber: 1, seats: 4, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
      { id: `${storeId}_t2`, tenantId, storeId, number: 2, tableNumber: 2, seats: 2, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
      { id: `${storeId}_t3`, tenantId, storeId, number: 3, tableNumber: 3, seats: 6, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
      { id: `${storeId}_t4`, tenantId, storeId, number: 4, tableNumber: 4, seats: 4, section: 'OUTDOOR', zone: 'Αυλή', status: 'FREE', currentTotal: 0 },
      { id: `${storeId}_t5`, tenantId, storeId, number: 5, tableNumber: 5, seats: 4, section: 'OUTDOOR', zone: 'Αυλή', status: 'FREE', currentTotal: 0 },
      { id: `${storeId}_t6`, tenantId, storeId, number: 6, tableNumber: 6, seats: 2, section: 'BAR', zone: 'Bar', status: 'FREE', currentTotal: 0 },
      { id: `${storeId}_takeaway-counter`, tenantId, storeId, number: 99, tableNumber: 99, seats: 1, section: 'TAKEAWAY', zone: 'Takeaway', status: 'FREE', currentTotal: 0 }
    ];
  }

  public initFirestoreSync(dbInstance: Firestore | null, getCurrentEmployeeFn: () => Employee | null): void {
    if (!dbInstance) return;
    this.db = dbInstance;

    if (this.activeTablesUnsub) {
      this.activeTablesUnsub();
    }

    this.activeTablesUnsub = onSnapshot(collection(this.db, 'tables'), async (snap) => {
      const activeEmp = getCurrentEmployeeFn();
      const currentTenant = activeEmp?.tenantId || this.getActiveTenantAndStore().tenantId;
      const currentStore = activeEmp?.storeId || this.getActiveTenantAndStore().storeId;

      const targetTenant = normalizeKey(currentTenant);
      const targetStore = normalizeKey(currentStore);

      const cloudTableMap = new Map<string, Table>();
      const newlyServedItems: { tableId: string; tableNumber: number; zone: string; itemSummary: string }[] = [];
      const extractedActiveOrders: ActiveOrder[] = [];

      snap.forEach(docSnap => {
        const rawTable = docSnap.data() as any;
        const tableId = docSnap.id;
        
        const docTenant = normalizeKey(rawTable.tenantId);
        const docStore = normalizeKey(rawTable.storeId);

        // Allow match if tenant matches OR if legacy table without explicit tenant
        const matchesTenant = !docTenant || docTenant === targetTenant;
        const matchesStore = !docStore || docStore === targetStore || docStore === 'all';

        if (matchesTenant && matchesStore) {
          const hasActiveOrderItems = Boolean(
            rawTable.activeOrder?.items && 
            rawTable.activeOrder.items.length > 0
          );
          const hasPositiveTotal = Number(rawTable.currentTotal || rawTable.activeOrder?.grandTotal || 0) > 0;
          const isExplicitlyFree = rawTable.status === 'FREE' && !hasActiveOrderItems && !hasPositiveTotal;

          const activeStatus = isExplicitlyFree 
            ? 'FREE' 
            : (rawTable.status === 'BILL_PRINTED' ? 'BILL_PRINTED' : 'OCCUPIED');

          const t: Table = {
            ...rawTable,
            id: tableId,
            tenantId: rawTable.tenantId || currentTenant,
            storeId: rawTable.storeId || currentStore,
            number: rawTable.number || rawTable.tableNumber || 1,
            tableNumber: rawTable.number || rawTable.tableNumber || 1,
            status: activeStatus,
            currentTotal: isExplicitlyFree ? 0 : Number(rawTable.currentTotal || rawTable.activeOrder?.grandTotal || 0),
            activeOrder: isExplicitlyFree ? undefined : rawTable.activeOrder,
            activeOrderId: isExplicitlyFree ? undefined : rawTable.activeOrderId,
            waiterId: isExplicitlyFree ? undefined : rawTable.waiterId,
            waiterName: isExplicitlyFree ? undefined : rawTable.waiterName,
            assignedWaiterId: isExplicitlyFree ? undefined : rawTable.assignedWaiterId,
            assignedWaiterName: isExplicitlyFree ? undefined : rawTable.assignedWaiterName
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
        }
      });

      let mergedList: Table[] = [];
      if (cloudTableMap.size > 0) {
        cloudTableMap.forEach(cloudTable => mergedList.push(cloudTable));
      } else {
        // Auto-seed default tables to Firestore so newly switched stores are never empty
        const defaultTables = this.getInitialDefaultTables(currentTenant, currentStore);
        mergedList = [...defaultTables];
        
        if (this.db) {
          for (const tbl of defaultTables) {
            await setDoc(doc(this.db, 'tables', tbl.id), safeFirestorePayload(tbl), { merge: true }).catch(() => {});
          }
        }
      }

      mergedList.sort((a, b) => {
        const valA = String(a.number ?? a.tableNumber ?? '');
        const valB = String(b.number ?? b.tableNumber ?? '');
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      });

      this.tables.set(mergedList);
      this.activeOrders.set(extractedActiveOrders);

      if (this.isInitialTablesSync) {
        this.isInitialTablesSync = false;
      } else if (newlyServedItems.length > 0 && getCurrentEmployeeFn()) {
        for (const notif of newlyServedItems) {
          this.addReadyNotification(notif);
        }
      }
    }, (err) => console.error('Tables sync warning:', err));
  }

  private addReadyNotification(notif: { tableId: string; tableNumber: number; zone: string; itemSummary: string }): void {
    const { storeId } = this.getActiveTenantAndStore();

    const fullNotif: ReadyNotification = {
      ...notif,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      storeId,
      readyAt: new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
    };

    this.unreadReadyNotifications.update(list => [fullNotif, ...list]);

    setTimeout(() => {
      this.dismissNotification(fullNotif.id);
    }, 3000);
  }

  public clearAllNotifications(): void {
    this.unreadReadyNotifications.set([]);
  }

  public dismissNotification(idOrIndex: string | number): void {
    this.unreadReadyNotifications.update(list =>
      list.filter((item, index) => item.id !== idOrIndex && index !== idOrIndex)
    );
  }

  public addTable(data: { number: string | number; seats?: number; section?: string; zone?: string }): { success: boolean; message: string; table?: Table } {
    const num = Number(data.number);
    if (!num || num <= 0) {
      return { success: false, message: 'Ο αριθμός τραπεζιού πρέπει να είναι θετικός ακέραιος.' };
    }

    const existing = this.tables().find(t => (t.number === num || t.tableNumber === num) && t.id !== 'takeaway-counter');
    if (existing) {
      return { success: false, message: `Υπάρχει ήδη τραπέζι με αριθμό #${num}!` };
    }

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    const newTable: Table = {
      id: `t_${storeId}_${Date.now()}`,
      tenantId,
      storeId,
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

    const updated = [...this.tables(), newTable].sort((a, b) => {
      const valA = String(a.number ?? a.tableNumber ?? '');
      const valB = String(b.number ?? b.tableNumber ?? '');
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });
    this.tables.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'tables', newTable.id), safeFirestorePayload(newTable)).catch(err => console.error(err));
    }

    return { success: true, message: 'Το τραπέζι δημιουργήθηκε επιτυχώς', table: newTable };
  }

  public updateTable(tableId: string, data: Partial<Table>): void {
    const existing = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
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

    const updatedList = this.tables().map(t => t.id === existing.id ? updatedTable : t);
    this.tables.set(updatedList);

    if (this.db) {
      setDoc(doc(this.db, 'tables', existing.id), safeFirestorePayload(updatedTable), { merge: true }).catch(err => console.error(err));
    }
  }

  public deleteTable(tableId: string): { success: boolean; message: string } {
    const target = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
    if (!target) return { success: false, message: 'Το τραπέζι δεν βρέθηκε.' };

    if (target.status === 'OCCUPIED' || target.status === 'BILL_PRINTED') {
      return { success: false, message: 'Δεν μπορείτε να διαγράψετε τραπέζι με ενεργή παραγγελία!' };
    }

    const updated = this.tables().filter(t => t.id !== target.id);
    this.tables.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'tables', target.id)).catch(err => console.error(err));
    }

    return { success: true, message: 'Το τραπέζι διαγράφηκε επιτυχώς.' };
  }

  // --- ORDER MANAGEMENT ---

  public addOrderItemToTable(
    tableId: string, 
    product: Product, 
    modifiers: OrderModifier[] = [], 
    notes: string = '', 
    waiter?: Employee | null
  ): void {
    const { tenantId, storeId } = this.getActiveTenantAndStore();

    const table = this.tables().find(t => t.id === tableId || String(t.number) === String(tableId) || String(t.tableNumber) === String(tableId));
    if (!table) {
      console.error('Table match failed for tableId:', tableId);
      return;
    }

    const actualModifiers = modifiers.length > 0 ? modifiers : ((product as any).selectedModifiers || []);
    
    const pPrice = Number(product.price) || 0;
    const extraCost = actualModifiers.reduce((acc: number, m: any) => acc + (Number(m.priceExtra) || 0), 0);
    const finalPrice = Number((pPrice + extraCost).toFixed(2));

    const fallbackWaiter: Employee = {
      id: 'EMP-SYSTEM',
      name: 'Σερβιτόρος',
      pin: '0000',
      role: 'WAITER',
      hourlyRate: 0,
      isActive: true,
      tenantId,
      storeId
    };

    const activeWaiter = waiter || fallbackWaiter;

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
      unitPrice: pPrice,
      quantity: 1,
      taxRate: product.taxRate || 13,
      modifiers: actualModifiers,
      finalItemPrice: finalPrice,
      itemNotes: notes,
      orderedByWaiterId: activeWaiter.id,
      orderedByWaiterName: activeWaiter.name,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };

    const updatedItems = [...existingOrder.items, newItem];
    const activeItems = updatedItems.filter(i => i.status !== 'VOIDED');
    
    const grandTotal = Number(activeItems.reduce((acc, i) => acc + (Number(i.finalItemPrice) * Number(i.quantity)), 0).toFixed(2));
    const subtotalNet = Number((grandTotal / 1.13).toFixed(2));
    const totalTax = Number((grandTotal - subtotalNet).toFixed(2));

    const updatedT: Table = {
      ...table,
      status: 'OCCUPIED',
      waiterId: activeWaiter.id,
      assignedWaiterId: activeWaiter.id,
      waiterName: activeWaiter.name,
      assignedWaiterName: activeWaiter.name,
      currentTotal: grandTotal,
      activeOrder: { ...existingOrder, items: updatedItems, subtotalNet, totalTax, grandTotal }
    };

    const updatedTables = this.tables().map(t => t.id === table.id ? updatedT : t);
    this.tables.set(updatedTables);

    if (this.db) {
      setDoc(doc(this.db, 'tables', table.id), safeFirestorePayload(updatedT))
        .catch(err => console.error('Firebase Save Error in addOrderItemToTable:', err));
    }
  }

  public async updateTableOrderItemQuantity(tableId: string, itemId: string, delta: number): Promise<void> {
    const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
    if (!table || !table.activeOrder) return;

    const existingItems = table.activeOrder.items;
    const targetItem = existingItems.find(i => i.id === itemId);
    if (!targetItem) return;

    const newQty = Number(targetItem.quantity) + delta;

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
    const grandTotal = Number(activeItems.reduce((acc, i) => acc + (Number(i.finalItemPrice) * Number(i.quantity)), 0).toFixed(2));
    const subtotalNet = Number((grandTotal / 1.13).toFixed(2));
    const totalTax = Number((grandTotal - subtotalNet).toFixed(2));

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

    const updatedTables = this.tables().map(t => t.id === table.id ? updatedTable : t);
    this.tables.set(updatedTables);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', table.id), safeFirestorePayload(updatedTable));
      } catch (e) { console.error('Save Error updateTableOrderItemQuantity:', e); }
    }
  }

  public removeOrderItem(tableId: string, itemId: string): void {
    const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
    if (!table || !table.activeOrder) return;

    const updatedItems = table.activeOrder.items.filter(item => item.id !== itemId);
    
    const activeItems = updatedItems.filter(i => i.status !== 'VOIDED');
    const grandTotal = Number(activeItems.reduce((acc, i) => acc + (Number(i.finalItemPrice) * Number(i.quantity)), 0).toFixed(2));
    const subtotalNet = Number((grandTotal / 1.13).toFixed(2));
    const totalTax = Number((grandTotal - subtotalNet).toFixed(2));

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

    const updatedTables = this.tables().map(t => t.id === table.id ? updatedTable : t);
    this.tables.set(updatedTables);

    if (this.db) {
      setDoc(doc(this.db, 'tables', table.id), safeFirestorePayload(updatedTable)).catch(e => console.error(e));
    }
  }

  public async voidTableOrderItem(tableId: string, itemId: string, reason: string = 'Ακύρωση από σερβιτόρο'): Promise<void> {
    const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
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
    const grandTotal = Number(activeItems.reduce((acc, i) => acc + (Number(i.finalItemPrice) * Number(i.quantity)), 0).toFixed(2));
    const subtotalNet = Number((grandTotal / 1.13).toFixed(2));
    const totalTax = Number((grandTotal - subtotalNet).toFixed(2));

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

    const updatedTables = this.tables().map(t => t.id === table.id ? updatedTable : t);
    this.tables.set(updatedTables);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', table.id), safeFirestorePayload(updatedTable));
      } catch (e) { console.error('Save Error voidTableOrderItem:', e); }
    }
  }

  public sendOrderToKitchen(tableId: string): void {
    const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
    if (!table || !table.activeOrder) return;

    const updatedItems = table.activeOrder.items.map(i => 
      i.status === 'PENDING' ? { ...i, status: 'SENT_TO_KITCHEN' as const } : i
    );

    const updatedT: Table = { ...table, status: 'OCCUPIED', activeOrder: { ...table.activeOrder, items: updatedItems } };
    const updatedTables = this.tables().map(t => t.id === table.id ? updatedT : t);
    this.tables.set(updatedTables);

    if (this.db) {
      setDoc(doc(this.db, 'tables', table.id), safeFirestorePayload(updatedT)).catch(e => console.error(e));
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
        await setDoc(doc(this.db, 'tables', targetTable.id), safeFirestorePayload(updatedTable), { merge: true });
      } catch (e) { console.error(e); }
    }
  }

  public bumpOrderItemStatus(tableId: string, itemId: string): void {
    const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
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
    const updatedTables = this.tables().map(t => t.id === table.id ? updatedT : t);
    this.tables.set(updatedTables);

    if (this.db) {
      setDoc(doc(this.db, 'tables', table.id), safeFirestorePayload(updatedT)).catch(e => console.error(e));
    }
  }

  public async markTableBillPrinted(tableId: string): Promise<void> {
    const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
    if (!table) return;

    const updatedT: Table = { ...table, status: 'BILL_PRINTED' };
    const updated = this.tables().map(t => t.id === table.id ? updatedT : t);
    this.tables.set(updated);

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', table.id), {
          status: 'BILL_PRINTED',
          updatedAt: Timestamp.now()
        }, { merge: true });
      } catch (e) { console.error(e); }
    }
  }

 public async settleTablePayment(
    tableId: string, 
    paymentMethod: 'CASH' | 'CARD' | 'DEBT', 
    currentEmp: Employee | null, 
    onPaymentSuccessFn: (saleRecord: SaleRecord) => void
  ): Promise<void> {
    const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
    if (!table) return;

    if (table.activeOrder && table.activeOrder.items) {
      const unsentItems = table.activeOrder.items.filter(item => item.status === 'PENDING');
      if (unsentItems.length > 0) {
        alert(
          `⚠️ Υπάρχουν ${unsentItems.length} εκκρεμή προϊόντα που δεν έχουν σταλεί στην κουζίνα!\n\nΠαρακαλώ πατήστε "Αποστολή" στην κουζίνα πριν την εξόφληση.`
        );
        return;
      }
    }

    const { tenantId, storeId } = this.getActiveTenantAndStore();
    const grandTotal = Number(table.activeOrder?.grandTotal || table.currentTotal || 0);
    const tableNum = Number(table.number || table.tableNumber || 0);

    const fallbackWaiter: Employee = {
      id: 'EMP-SYSTEM',
      name: 'Σερβιτόρος',
      pin: '0000',
      role: 'WAITER',
      hourlyRate: 0,
      isActive: true,
      tenantId,
      storeId
    };

    const waiter = currentEmp || fallbackWaiter;

    const saleRecord: SaleRecord = {
      id: `SALE-${Date.now()}`,
      tenantId: currentEmp?.tenantId || table.tenantId || tenantId,
      storeId: currentEmp?.storeId || table.storeId || storeId,
      orderId: table.activeOrder?.orderId || `ORD-${Date.now()}`,
      tableId: table.id,
      tableNumber: tableNum,
      waiterId: waiter.id,
      waiterName: waiter.name,
      paymentMethod,
      items: table.activeOrder?.items || [],
      subtotalNet: Number((table.activeOrder?.subtotalNet || (grandTotal / 1.13)).toFixed(2)),
      totalTax: Number((table.activeOrder?.totalTax || (grandTotal - (grandTotal / 1.13))).toFixed(2)),
      grandTotal,
      timestamp: new Date().toISOString()
    };

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'sales', saleRecord.id), safeFirestorePayload(saleRecord));
      } catch (e) {
        console.warn('Error writing sale record:', e);
      }
    }

    onPaymentSuccessFn(saleRecord);

    // 🛡️ Explicit clean state object: null out all order properties
    const cleanFreedTableData = {
      id: table.id,
      number: table.number || table.tableNumber || 1,
      tableNumber: table.number || table.tableNumber || 1,
      name: table.name || `Τραπέζι ${table.number || table.tableNumber}`,
      seats: table.seats || table.capacity || 4,
      capacity: table.seats || table.capacity || 4,
      section: table.section || 'INDOOR',
      zone: table.zone || 'Σάλα',
      tenantId: table.tenantId || tenantId,
      storeId: table.storeId || storeId,
      status: 'FREE' as const,
      currentTotal: 0,
      activeOrder: null,
      activeOrderId: null,
      waiterId: null,
      waiterName: null,
      assignedWaiterId: null,
      assignedWaiterName: null
    };

    // Update local Signal
    const updatedTables = this.tables().map(t => t.id === table.id ? (cleanFreedTableData as any) : t);
    this.tables.set(updatedTables);

    // 🛡️ Direct Firestore overwrite (DO NOT merge with old order fields)
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'tables', table.id), cleanFreedTableData);
      } catch (e) {
        console.error('🔥 Error clearing table in Firestore:', e);
      }
    }
  }

  public async reserveTable(tableId: string, info: TableReservationInfo): Promise<void> {
  const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
  if (!table) return;

  const updated: Table = {
    ...table,
    status: 'RESERVED',
    reservation: info
  };

  this.tables.update(list => list.map(t => t.id === table.id ? updated : t));

  if (this.db) {
    await setDoc(doc(this.db, 'tables', table.id), safeFirestorePayload(updated), { merge: true });
  }
}

public async cancelReservation(tableId: string): Promise<void> {
  const table = this.tables().find(t => t.id === tableId || String(t.number) === tableId);
  if (!table) return;

  const updated: Table = {
    ...table,
    status: 'FREE',
    reservation: undefined
  };

  this.tables.update(list => list.map(t => t.id === table.id ? updated : t));

  if (this.db) {
    await setDoc(doc(this.db, 'tables', table.id), {
      status: 'FREE',
      reservation: null
    }, { merge: true });
  }
}

// 1. MOVE / MERGE TABLE
// 🔄 PERSISTENT TABLE MOVE / MERGE
public async moveOrMergeTable(
  sourceTableId: string, 
  targetTableId: string, 
  currentEmp?: Employee | null
): Promise<{ success: boolean; message: string }> {
  const allTables = this.tables();
  const source = allTables.find(t => t.id === sourceTableId);
  const target = allTables.find(t => t.id === targetTableId);

  if (!source || !target || !source.activeOrder) {
    return { success: false, message: 'Μη έγκυρο τραπέζι πηγής ή προορισμού.' };
  }

  const sourceItems = source.activeOrder.items || [];
  if (sourceItems.length === 0) {
    return { success: false, message: 'Το αρχικό τραπέζι δεν έχει ενεργά προϊόντα.' };
  }

  // 1. Prepare Target Items (Existing + Source items, avoiding duplicate IDs)
  const existingTargetItems = target.activeOrder?.items || [];
  const mergedItems = [...existingTargetItems, ...sourceItems];

  const subtotalNet = mergedItems.reduce((acc, i) => i.status !== 'VOIDED' ? acc + (i.unitPrice * i.quantity) : acc, 0);
  const grandTotal = mergedItems.reduce((acc, i) => i.status !== 'VOIDED' ? acc + (i.finalItemPrice * i.quantity) : acc, 0);
  const totalTax = grandTotal - subtotalNet;

  const baseActiveOrder = target.activeOrder || source.activeOrder!;
  const targetTableNum = target.number ?? target.tableNumber ?? target.id;
  const sourceTableNum = source.number ?? source.tableNumber ?? source.id;

  // 2. Build Updated Target Table Object
  const updatedTargetTable: Table = {
    ...target,
    status: 'OCCUPIED',
    currentTotal: grandTotal,
    assignedWaiterName: target.assignedWaiterName || source.assignedWaiterName || currentEmp?.name,
    activeOrder: {
      ...baseActiveOrder,
      orderId: baseActiveOrder.orderId || `ord_${Date.now()}`,
      openedAt: baseActiveOrder.openedAt || new Date().toISOString(),
      tableId: targetTableId,
      tableNumber: targetTableNum,
      items: mergedItems,
      subtotalNet,
      totalTax,
      grandTotal,
      status: 'OPEN'
    } as any
  };

  // 3. Build Cleared Source Table Object
  const clearedSourceTable: Table = {
    ...source,
    status: 'FREE',
    currentTotal: 0,
    activeOrder: undefined,
    assignedWaiterName: undefined
  };

  // 4. Update Local Memory State
  this.tables.update((list: Table[]) =>
    list.map((tbl: Table): Table => {
      if (tbl.id === sourceTableId) return clearedSourceTable;
      if (tbl.id === targetTableId) return updatedTargetTable;
      return tbl;
    })
  );

  // 5. 🔑 CRITICAL: Persist BOTH tables to Firestore so Firebase listeners do NOT roll back
  if (this.db) {
    try {
      await Promise.all([
        setDoc(doc(this.db, 'tables', sourceTableId), cleanUndefined(clearedSourceTable), { merge: false }),
        setDoc(doc(this.db, 'tables', targetTableId), cleanUndefined(updatedTargetTable), { merge: true })
      ]);
    } catch (err) {
      console.error('Error persisting table move/merge to Firestore:', err);
    }
  }

  return { 
    success: true, 
    message: `Επιτυχής μεταφορά από #${sourceTableNum} στο #${targetTableNum}` 
  };
}

// 2. SETTLE PARTIAL BILL
public async settlePartialItems(
  tableId: string, 
  itemIdsToSettle: string[], 
  method: 'CASH' | 'CARD',
  currentEmp: any = null
): Promise<{ success: boolean; remainingTotal: number }> {
  const table = this.tables().find(t => t.id === tableId);
  if (!table || !table.activeOrder) return { success: false, remainingTotal: 0 };

  const allItems = table.activeOrder.items || [];
  const remainingItems = allItems.filter(i => !itemIdsToSettle.includes(i.id));

  // If all items were paid, execute full settlement
  if (remainingItems.length === 0 || remainingItems.every(i => i.status === 'VOIDED')) {
    await this.settleTablePayment(tableId, method, currentEmp, undefined as any);
    return { success: true, remainingTotal: 0 };
  }

  const subtotalNet = remainingItems.reduce((acc, i) => i.status !== 'VOIDED' ? acc + (i.unitPrice * i.quantity) : acc, 0);
  const grandTotal = remainingItems.reduce((acc, i) => i.status !== 'VOIDED' ? acc + (i.finalItemPrice * i.quantity) : acc, 0);
  const totalTax = grandTotal - subtotalNet;

  this.tables.update((list: Table[]) =>
    list.map((tbl: Table): Table => 
      tbl.id === tableId ? ({
        ...tbl,
        currentTotal: grandTotal,
        activeOrder: {
          ...tbl.activeOrder!,
          items: remainingItems,
          subtotalNet,
          totalTax,
          grandTotal
        } as any
      } as Table) : tbl
    )
  );

  return { success: true, remainingTotal: grandTotal };
}
}