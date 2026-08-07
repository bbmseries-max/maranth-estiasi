// src/app/core/services/vault-financial.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { Firestore, doc, setDoc } from 'firebase/firestore';
import { WaiterVaultSession, DailyZReportSnapshot, SaleRecord, WorkShiftLog } from '../models/restaurant-pos.models';

@Injectable({
  providedIn: 'root'
})
export class VaultFinancialService {
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
}