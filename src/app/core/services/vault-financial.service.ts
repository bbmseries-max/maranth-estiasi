// src/app/core/services/vault-financial.service.ts

import { Injectable, signal, computed, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot,
  query,
  where,
  Unsubscribe 
} from 'firebase/firestore';
import { TenantContextService } from './tenant-context.service';

// 👈 Central barrel export
import { 
  WaiterVaultSession, 
  DailyZReportSnapshot, 
  SaleRecord, 
  Employee 
} from '../modals';

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
export class VaultFinancialService {
  private tenantContext = inject(TenantContextService);
  private db: Firestore | null = null;

  // Lifecycle listeners
  private vaultsUnsub: Unsubscribe | null = null;
  private salesUnsub: Unsubscribe | null = null;
  private zReportsUnsub: Unsubscribe | null = null;

  // Signals
  public allVaultSessions = signal<WaiterVaultSession[]>([]);
  public activeVaultSessions = signal<WaiterVaultSession[]>([]);
  public activeVaultSession = signal<WaiterVaultSession | null>(null);
  public salesHistory = signal<SaleRecord[]>([]);
  public zReports = signal<DailyZReportSnapshot[]>([]);

  // Financial Calculations
  public totalDailyCashInVaults = computed(() => 
    this.allVaultSessions().reduce((acc, v) => acc + (v.cashCollected || 0), 0)
  );

  public totalDailyCardInVaults = computed(() => 
    this.allVaultSessions().reduce((acc, v) => acc + (v.cardCollected || 0), 0)
  );

  public totalDailyStartingFloats = computed(() => 
    this.allVaultSessions().reduce((acc, v) => acc + (v.startingFloat || 0), 0)
  );

  public totalDailyGrossSales = computed(() => {
    return this.salesHistory().reduce((acc, s) => acc + (s.grandTotal || 0), 0);
  });

  public vatBreakdown = computed(() => {
    const totalGross = this.salesHistory().reduce((acc, s) => acc + (s.grandTotal || 0), 0);
    const totalNet = totalGross / 1.13;
    const totalVat = totalGross - totalNet;

    return {
      totalGross: Number(totalGross.toFixed(2)),
      net13: Number(totalNet.toFixed(2)),
      vat13: Number(totalVat.toFixed(2)),
      net24: 0,
      vat24: 0,
      totalNet: Number(totalNet.toFixed(2)),
      totalVat: Number(totalVat.toFixed(2))
    };
  });

  private getActiveTenantAndStore(): { tenantId: string; storeId: string } {
    const tenantId = 
      localStorage.getItem('active_tenant_id') || 
      (this.tenantContext as any).currentTenantId?.() || 
      'coffee-shop-demo';
    const storeId = 
      localStorage.getItem('active_store_id') || 
      (this.tenantContext as any).currentStoreId?.() || 
      'store-1';
    return { tenantId, storeId };
  }

  /**
   * Real-time listeners for Vaults, Sales, and Z-Reports strictly store-scoped
   */
  public initFirestoreSync(dbInstance: Firestore | null, currentEmpSupplier?: () => Employee | null): void {
    if (!dbInstance) return;
    this.db = dbInstance;

    if (this.vaultsUnsub) this.vaultsUnsub();
    if (this.salesUnsub) this.salesUnsub();
    if (this.zReportsUnsub) this.zReportsUnsub();

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    // 1. Vaults Sync (Store-Scoped)
    const vaultsQuery = query(
      collection(this.db, 'vaults'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    this.vaultsUnsub = onSnapshot(vaultsQuery, (snap) => {
      const vaultList: WaiterVaultSession[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => vaultList.push(docSnap.data() as WaiterVaultSession));
      }

      vaultList.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

      this.allVaultSessions.set(vaultList);

      const activeOnly = vaultList.filter(v => v.status === 'OPEN');
      this.activeVaultSessions.set(activeOnly);

      const emp = currentEmpSupplier ? currentEmpSupplier() : null;
      if (emp) {
        const myActiveVault = activeOnly.find(v => v.waiterId === emp.id);
        this.activeVaultSession.set(myActiveVault || null);
      } else {
        this.activeVaultSession.set(null);
      }
    });

    // 2. Sales History Sync (Store-Scoped)
    const salesQuery = query(
      collection(this.db, 'sales'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    this.salesUnsub = onSnapshot(salesQuery, (snap) => {
      const sales: SaleRecord[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => sales.push(docSnap.data() as SaleRecord));
        sales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      this.salesHistory.set(sales);
    });

    // 3. Z-Reports Sync (Store-Scoped)
    const zReportsQuery = query(
      collection(this.db, 'z_reports'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    this.zReportsUnsub = onSnapshot(zReportsQuery, (snap) => {
      const reports: DailyZReportSnapshot[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => reports.push(docSnap.data() as DailyZReportSnapshot));
        reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      this.zReports.set(reports);
    });
  }

  // --- VAULT OPERATIONS ---

  public openWaiterVault(emp: Employee, startingFloat: number = 50): void {
    if (!emp) return;

    const { tenantId, storeId } = this.getActiveTenantAndStore();
    const cleanFloat = Math.max(0, startingFloat);
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

    this.activeVaultSessions.update(list => list.filter(s => s.id !== closedVault.id));
    this.allVaultSessions.update(list => list.map(s => s.id === closedVault.id ? closedVault : s));

    if (this.activeVaultSession()?.id === closedVault.id) {
      this.activeVaultSession.set(null);
    }

    if (this.db) {
      setDoc(doc(this.db, 'vaults', closedVault.id), cleanUndefined(closedVault), { merge: true }).catch(err => {
        console.error('Error closing vault in Firestore:', err);
      });
    }
  }

  // --- REPORTING ---

  public generateZReport(closedBy: Employee): DailyZReportSnapshot {
    const vat = this.vatBreakdown();
    const { tenantId, storeId } = this.getActiveTenantAndStore();
    const todayStr = new Date().toLocaleDateString('el-GR');

    const snapshot: DailyZReportSnapshot = {
      id: `Z-REPORT-${Date.now()}`,
      tenantId: closedBy.tenantId || tenantId,
      storeId: closedBy.storeId || storeId,
      dateStr: todayStr,
      timestamp: new Date().toISOString(),
      closedByEmployeeId: closedBy.id,
      closedByEmployeeName: closedBy.name,
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
    return snapshot;
  }
}