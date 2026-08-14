// src/app/core/services/database-seeder.service.ts

import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Product, Category, Table, RawMaterial } from '../modals';

@Injectable({
  providedIn: 'root'
})
export class DatabaseSeederService {
  private db = inject(Firestore);

  private tenantId = 'coffee-shop-demo';
  private storeId = 'store-1';

  // --- CLIENT SEED DATA ---

  private seedCategories: Category[] = [
    { id: 'CAT-1', tenantId: this.tenantId, storeId: this.storeId, name: 'Καφέδες & Ροφήματα', icon: '☕', sortOrder: 1, isActive: true },
    { id: 'CAT-2', tenantId: this.tenantId, storeId: this.storeId, name: 'Τσάι & Χυμοί', icon: '🍹', sortOrder: 2, isActive: true },
    { id: 'CAT-3', tenantId: this.tenantId, storeId: this.storeId, name: 'Σάντουιτς & Snacks', icon: '🥪', sortOrder: 3, isActive: true },
    { id: 'CAT-4', tenantId: this.tenantId, storeId: this.storeId, name: 'Γλυκά & Περιποίησης', icon: '🥐', sortOrder: 4, isActive: true }
  ];

  private seedProducts: Product[] = [
    {
      id: 'PRD-1',
      tenantId: this.tenantId,
      storeId: this.storeId,
      name: 'Freddo Espresso',
      categoryId: 'CAT-1',
      categoryName: 'Καφέδες & Ροφήματα',
      price: 2.20,
      purchasePrice: 0.35,
      costPrice: 0.35,
      taxRate: 13,
      isPinnedToPOS: true,
      isActive: true
    },
    {
      id: 'PRD-2',
      tenantId: this.tenantId,
      storeId: this.storeId,
      name: 'Freddo Cappuccino',
      categoryId: 'CAT-1',
      categoryName: 'Καφέδες & Ροφήματα',
      price: 2.50,
      purchasePrice: 0.45,
      costPrice: 0.45,
      taxRate: 13,
      isPinnedToPOS: true,
      isActive: true
    },
    {
      id: 'PRD-3',
      tenantId: this.tenantId,
      storeId: this.storeId,
      name: 'Espresso Single',
      categoryId: 'CAT-1',
      categoryName: 'Καφέδες & Ροφήματα',
      price: 1.80,
      purchasePrice: 0.25,
      costPrice: 0.25,
      taxRate: 13,
      isPinnedToPOS: true,
      isActive: true
    },
    {
      id: 'PRD-4',
      tenantId: this.tenantId,
      storeId: this.storeId,
      name: 'Φρέσκος Χυμός Πορτοκάλι',
      categoryId: 'CAT-2',
      categoryName: 'Τσάι & Χυμοί',
      price: 3.50,
      purchasePrice: 0.80,
      costPrice: 0.80,
      taxRate: 13,
      isPinnedToPOS: true,
      isActive: true
    },
    {
      id: 'PRD-5',
      tenantId: this.tenantId,
      storeId: this.storeId,
      name: 'Club Sandwich Γαλοπούλα',
      categoryId: 'CAT-3',
      categoryName: 'Σάντουιτς & Snacks',
      price: 5.80,
      purchasePrice: 1.90,
      costPrice: 1.90,
      taxRate: 13,
      isPinnedToPOS: true,
      isActive: true
    },
    {
      id: 'PRD-6',
      tenantId: this.tenantId,
      storeId: this.storeId,
      name: 'Κρουασάν Βουτύρου',
      categoryId: 'CAT-4',
      categoryName: 'Γλυκά & Περιποίησης',
      price: 2.00,
      purchasePrice: 0.60,
      costPrice: 0.60,
      taxRate: 13,
      isPinnedToPOS: true,
      isActive: true
    }
  ];

  private seedTables: Table[] = [
    { id: 't1', tenantId: this.tenantId, storeId: this.storeId, number: 1, tableNumber: 1, seats: 4, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
    { id: 't2', tenantId: this.tenantId, storeId: this.storeId, number: 2, tableNumber: 2, seats: 2, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
    { id: 't3', tenantId: this.tenantId, storeId: this.storeId, number: 3, tableNumber: 3, seats: 6, section: 'INDOOR', zone: 'Σάλα', status: 'FREE', currentTotal: 0 },
    { id: 't4', tenantId: this.tenantId, storeId: this.storeId, number: 4, tableNumber: 4, seats: 4, section: 'OUTDOOR', zone: 'Αυλή', status: 'FREE', currentTotal: 0 },
    { id: 't5', tenantId: this.tenantId, storeId: this.storeId, number: 5, tableNumber: 5, seats: 4, section: 'OUTDOOR', zone: 'Αυλή', status: 'FREE', currentTotal: 0 },
    { id: 't6', tenantId: this.tenantId, storeId: this.storeId, number: 6, tableNumber: 6, seats: 2, section: 'BAR', zone: 'Bar', status: 'FREE', currentTotal: 0 },
    { id: 'takeaway-counter', tenantId: this.tenantId, storeId: this.storeId, number: 99, tableNumber: 99, seats: 1, section: 'TAKEAWAY', zone: 'Παραλαβή', status: 'FREE', currentTotal: 0 }
  ];

  private seedRawMaterials: RawMaterial[] = [
    { id: 'RM-1', tenantId: this.tenantId, storeId: this.storeId, name: 'Espresso Beans (Specialty)', unit: 'KG', currentStock: 15.0, minAlertStock: 3.0, costPerUnit: 18.5 },
    { id: 'RM-2', tenantId: this.tenantId, storeId: this.storeId, name: 'Φρέσκο Γάλα 3.7%', unit: 'LITER', currentStock: 30.0, minAlertStock: 6.0, costPerUnit: 1.2 },
    { id: 'RM-3', tenantId: this.tenantId, storeId: this.storeId, name: 'Ψωμί Brioche', unit: 'PCS', currentStock: 50.0, minAlertStock: 15.0, costPerUnit: 0.6 }
  ];

  /**
   * Pushes initial client seed data directly into Firestore
   */
  public async seedDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      const batch = writeBatch(this.db);

      // 1. Categories
      for (const cat of this.seedCategories) {
        batch.set(doc(this.db, 'categories', cat.id), cat);
      }

      // 2. Products
      for (const prod of this.seedProducts) {
        batch.set(doc(this.db, 'products', prod.id), prod);
      }

      // 3. Tables
      for (const table of this.seedTables) {
        batch.set(doc(this.db, 'tables', table.id), table);
      }

      // 4. Raw Materials
      for (const rm of this.seedRawMaterials) {
        batch.set(doc(this.db, 'rawMaterials', rm.id), rm);
      }

      await batch.commit();
      console.log('✅ Client seed data successfully written to Firestore!');
      return { success: true, message: 'Τα αρχικά δεδομένα πελάτη δημιουργήθηκαν επιτυχώς στο Firestore!' };
    } catch (error: any) {
      console.error('❌ Firestore Seeding Error:', error);
      return { success: false, message: `Σφάλμα seeding: ${error?.message || error}` };
    }
  }
}