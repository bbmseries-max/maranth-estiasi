// src/app/core/services/store-onboarding.service.ts

import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Employee, Table, Category } from '../modals';

export interface NewStoreConfig {
  tenantId: string;      // e.g., 'el-greco-taverna'
  storeId: string;       // e.g., 'main-branch'
  storeName: string;     // e.g., 'El Greco Taverna'
  adminName: string;     // e.g., 'Giannis Manager'
  adminPin: string;      // e.g., '9876'
  phone?: string;
  vatNumber?: string;    // ΑΦΜ for Greek tax compliance
}

@Injectable({
  providedIn: 'root'
})
export class StoreOnboardingService {
  private db = inject(Firestore);

  /**
   * Provision a brand-new, isolated store account in under 5 seconds
   */
  public async provisionNewStore(config: NewStoreConfig): Promise<{ success: boolean; message: string }> {
    try {
      const batch = writeBatch(this.db);
      const now = new Date().toISOString();

      // 1. Create Default Store Profile
      const storeRef = doc(this.db, 'stores', `${config.tenantId}_${config.storeId}`);
      batch.set(storeRef, {
        id: `${config.tenantId}_${config.storeId}`,
        tenantId: config.tenantId,
        storeId: config.storeId,
        storeName: config.storeName,
        vatNumber: config.vatNumber || '',
        phone: config.phone || '',
        createdAt: now,
        isActive: true
      });

      // 2. Create Owner/Manager Superuser Employee
      const managerRef = doc(this.db, 'employees', `${config.storeId}_manager`);
      const managerEmp: Employee = {
        id: `${config.storeId}_manager`,
        name: config.adminName,
        pin: config.adminPin,
        pinCode: config.adminPin,
        role: 'MANAGER',
        hourlyRate: 12.0,
        isActive: true,
        active: true,
        tenantId: config.tenantId,
        storeId: config.storeId,
        createdAt: now
      };
      batch.set(managerRef, managerEmp);

      // 3. Create Basic Category Structure (Food & Drinks)
      const defaultCategories: Category[] = [
        { id: `CAT_${config.storeId}_1`, tenantId: config.tenantId, storeId: config.storeId, name: 'Καφέδες & Ροφήματα', icon: '☕', sortOrder: 1, isActive: true },
        { id: `CAT_${config.storeId}_2`, tenantId: config.tenantId, storeId: config.storeId, name: 'Φαγητό & Σνακ', icon: '🥪', sortOrder: 2, isActive: true },
        { id: `CAT_${config.storeId}_3`, tenantId: config.tenantId, storeId: config.storeId, name: 'Αναψυκτικά & Ποτά', icon: '🥤', sortOrder: 3, isActive: true }
      ];

      defaultCategories.forEach(cat => {
        const catRef = doc(this.db, 'categories', cat.id);
        batch.set(catRef, cat);
      });

      // 4. Create Standard Initial Floor Plan (6 Tables + Takeaway)
      const defaultTables: Table[] = [
        { id: `${config.storeId}_t1`, tenantId: config.tenantId, storeId: config.storeId, number: 1, tableNumber: 1, seats: 4, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
        { id: `${config.storeId}_t2`, tenantId: config.tenantId, storeId: config.storeId, number: 2, tableNumber: 2, seats: 2, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
        { id: `${config.storeId}_t3`, tenantId: config.tenantId, storeId: config.storeId, number: 3, tableNumber: 3, seats: 6, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
        { id: `${config.storeId}_t4`, tenantId: config.tenantId, storeId: config.storeId, number: 4, tableNumber: 4, seats: 4, section: 'OUTDOOR', zone: 'Αυλή', status: 'FREE', currentTotal: 0 },
        { id: `${config.storeId}_takeaway`, tenantId: config.tenantId, storeId: config.storeId, number: 99, tableNumber: 99, seats: 1, section: 'TAKEAWAY', zone: 'Παραλαβή', status: 'FREE', currentTotal: 0 }
      ];

      defaultTables.forEach(table => {
        const tableRef = doc(this.db, 'tables', table.id);
        batch.set(tableRef, table);
      });

      // Commit provisioning batch to Firestore atomically
      await batch.commit();

      return {
        success: true,
        message: `Store "${config.storeName}" provisioned successfully with Admin PIN: ${config.adminPin}`
      };
    } catch (error: any) {
      console.error('Store Onboarding Error:', error);
      return { success: false, message: error.message || 'Failed to provision store.' };
    }
  }
}