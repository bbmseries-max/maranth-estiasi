// src/app/core/services/inventory.service.ts

import { Injectable, signal, computed, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { TenantContextService } from './tenant-context.service';

// Barrel imports
import { 
  UnitOfMeasure, 
  GreekVatRate, 
  RawMaterial, 
  Category, 
  Product, 
  ModifierGroup, 
  ModifierOption,
  SpoilageLog, 
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
export class InventoryService {
  private tenantContext = inject(TenantContextService);
  private db: Firestore | null = null;
  private activeListeners: Unsubscribe[] = [];

  // Signals (Initialized empty to prevent data leakage before sync)
  public rawMaterials = signal<RawMaterial[]>([]);
  public categories = signal<Category[]>([]);
  public products = signal<Product[]>([]);
  public spoilageLogs = signal<SpoilageLog[]>([]);
  public modifierGroups = signal<ModifierGroup[]>([]);

  // Computations
  public lowStockMaterials = computed(() => 
    this.rawMaterials().filter(m => m.currentStock <= m.minAlertStock)
  );

  public totalInventoryValue = computed(() => 
    this.rawMaterials().reduce((acc, m) => acc + (m.currentStock * m.costPerUnit), 0)
  );

  /**
   * Dynamic Resolver for Tenant ID & Store ID
   */
  private getActiveTenantAndStore(): { tenantId: string; storeId: string } {
    const tenantId = 
      (this.tenantContext as any).currentTenantId?.() || 
      (this.tenantContext as any).tenantId?.() || 
      'coffee-shop-demo';

    const storeId = 
      (this.tenantContext as any).currentStoreId?.() || 
      (this.tenantContext as any).activeStoreId?.() || 
      (this.tenantContext as any).storeId?.() || 
      'store-1';

    return { tenantId, storeId };
  }

  /**
   * Attach Firebase Firestore database reference & start realtime listeners strictly isolated by storeId
   */
  public initFirestoreSync(dbInstance: Firestore | null, isDemoTenantCheck?: () => boolean): void {
    if (!dbInstance) return;
    this.db = dbInstance;

    // 1. Unsubscribe existing listeners cleanly
    this.stopFirestoreSync();

    // 2. If it's a demo tenant and should bypass remote Firestore sync, exit early
    if (isDemoTenantCheck && isDemoTenantCheck()) {
      return;
    }

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    // 1. Sync Categories (Filtered strictly by tenantId & storeId)
    const catQuery = query(
      collection(this.db, 'categories'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    const unsubCat = onSnapshot(catQuery, (snap) => {
      const cats: Category[] = [];
      snap.forEach(d => cats.push({ ...(d.data() as Category), id: d.id }));
      cats.sort((a, b) => ((a as any).sortOrder ?? (a as any).order ?? 0) - ((b as any).sortOrder ?? (b as any).order ?? 0));
      this.categories.set(cats);
    },
     (err) => console.error(`[InventorySync] Categories error for ${tenantId}:`, err));
    this.activeListeners.push(unsubCat);

    // 2. Sync Modifier Groups (Strict Multi-Tenant Scoping)
    const modQuery = query(
      collection(this.db, 'modifier_groups'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    const unsubMod = onSnapshot(modQuery, (snap) => {
      const groups: ModifierGroup[] = [];
      snap.forEach(d => groups.push({ ...(d.data() as ModifierGroup), id: d.id }));
      if ((this as any).modifierGroups?.set) {
        (this as any).modifierGroups.set(groups);
      }
    }, (err) => console.error(`[InventorySync] Modifier groups error for ${tenantId}:`, err));
    this.activeListeners.push(unsubMod);

    // 3. Sync Products (Filtered strictly by tenantId & storeId)
    const prodQuery = query(
      collection(this.db, 'products'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    const unsubProd = onSnapshot(prodQuery, (snap) => {
      const prods: Product[] = [];
      snap.forEach(d => prods.push({ ...(d.data() as Product), id: d.id }));
      this.products.set(prods);
    }, (err) => console.error(`[InventorySync] Products error for ${tenantId}:`, err));
    this.activeListeners.push(unsubProd);

    // 4. Sync Raw Materials (Filtered strictly by tenantId & storeId)
    const matQuery = query(
      collection(this.db, 'rawMaterials'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    const unsubMat = onSnapshot(matQuery, (snap) => {
      const mats: RawMaterial[] = [];
      snap.forEach(d => mats.push({ ...(d.data() as RawMaterial), id: d.id }));
      this.rawMaterials.set(mats);
    }, (err) => console.error(`[InventorySync] Raw materials error for ${tenantId}:`, err));
    this.activeListeners.push(unsubMat);

    // 5. Sync Spoilage Logs (Filtered strictly by tenantId & storeId)
    const spoilQuery = query(
      collection(this.db, 'spoilageLogs'),
      where('tenantId', '==', tenantId),
      where('storeId', '==', storeId)
    );
    const unsubSpoil = onSnapshot(spoilQuery, (snap) => {
      const logs: SpoilageLog[] = [];
      snap.forEach(d => logs.push({ ...(d.data() as SpoilageLog), id: d.id }));
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.spoilageLogs.set(logs);
    }, (err) => console.error(`[InventorySync] Spoilage logs error for ${tenantId}:`, err));
    this.activeListeners.push(unsubSpoil);
  }

  public stopFirestoreSync(): void {
    this.activeListeners.forEach(unsub => unsub());
    this.activeListeners = [];
  }

  // --- RAW MATERIALS MANAGEMENT ---

  public addRawMaterial(matData: { name: string; unit: UnitOfMeasure; currentStock: number; minAlertStock: number; costPerUnit: number }): { success: boolean; message: string; material?: RawMaterial } {
    if (!matData.name.trim()) {
      return { success: false, message: 'Το όνομα υλικού δεν μπορεί να είναι κενό.' };
    }

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    const newMat: RawMaterial = {
      id: `RM-${Date.now()}`,
      tenantId, // 🔒 Dynamic
      storeId,  // 🔒 Dynamic
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

    return { success: true, message: 'Η πρώτη ύλη καταχωρήθηκε επιτυχώς.', material: newMat };
  }

  public updateRawMaterial(id: string, matData: Partial<RawMaterial>): void {
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
  }

  // 1. Add new Modifier Group for this tenant
  public async addModifierGroup(groupData: {
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    options: ModifierOption[];
  }): Promise<{ success: boolean; group?: ModifierGroup }> {
    const { tenantId, storeId } = this.getActiveTenantAndStore();
    if (!this.db) return { success: false };

    const newGroup: ModifierGroup = {
      id: `${storeId}_modgrp_${Date.now()}`,
      tenantId,
      storeId,
      name: groupData.name.trim(),
      required: groupData.required,
      minSelect: groupData.minSelections,
      maxSelect: groupData.maxSelections,
      minSelections: groupData.minSelections,
      maxSelections: groupData.maxSelections,
      options: groupData.options.map((opt, idx) => ({
        ...opt,
        id: opt.id || `${storeId}_opt_${Date.now()}_${idx}`,
        tenantId,
        storeId,
        available: opt.available ?? true,
        priceExtra: Number(opt.priceExtra) || 0
      }))
    };

    try {
      await setDoc(doc(this.db, 'modifier_groups', newGroup.id), cleanUndefined(newGroup));
      return { success: true, group: newGroup };
    } catch (err) {
      console.error('[InventoryService] Error adding modifier group:', err);
      return { success: false };
    }
  }

  // 2. Update existing Modifier Group (e.g. changing prices or adding an extra option)
  public async updateModifierGroup(groupId: string, data: Partial<ModifierGroup>): Promise<void> {
    if (!this.db) return;
    const { tenantId, storeId } = this.getActiveTenantAndStore();

    try {
      await setDoc(
        doc(this.db, 'modifier_groups', groupId),
        cleanUndefined({ ...data, tenantId, storeId }),
        { merge: true }
      );
    } catch (err) {
      console.error('[InventoryService] Error updating modifier group:', err);
    }
  }

  // 3. Delete Modifier Group
  public async deleteModifierGroup(groupId: string): Promise<void> {
    if (!this.db) return;
    try {
      await deleteDoc(doc(this.db, 'modifier_groups', groupId));
    } catch (err) {
      console.error('[InventoryService] Error deleting modifier group:', err);
    }
  }

  public adjustRawMaterialStock(id: string, newStockCount: number, reason: string = 'Απογραφή'): void {
    const existing = this.rawMaterials().find(m => m.id === id);
    if (!existing) return;

    const updatedMat: RawMaterial = {
      ...existing,
      currentStock: Math.max(0, newStockCount)
    };

    const updatedList = this.rawMaterials().map(m => m.id === id ? updatedMat : m);
    this.rawMaterials.set(updatedList);

    if (this.db) {
      setDoc(doc(this.db, 'rawMaterials', id), cleanUndefined(updatedMat), { merge: true }).catch(() => {});
    }
  }

  public deleteRawMaterial(id: string): { success: boolean; message: string } {
    const target = this.rawMaterials().find(m => m.id === id);
    if (!target) return { success: false, message: 'Το υλικό δεν βρέθηκε.' };

    const updated = this.rawMaterials().filter(m => m.id !== id);
    this.rawMaterials.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'rawMaterials', id)).catch(() => {});
    }

    return { success: true, message: 'Η πρώτη ύλη διαγράφηκε επιτυχώς.' };
  }

  public recordGoodsReceiving(data: { itemName: string; quantity: number; unit: string; unitPrice: number; vatRate: number }): void {
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
        unit: data.unit as UnitOfMeasure,
        currentStock: data.quantity,
        minAlertStock: 2,
        costPerUnit: data.unitPrice
      });
    }
  }

  // --- AUTOMATIC RECIPE DEDUCTION ON ORDERS ---

  public deductRecipeIngredients(product: Product, multiplier: number = 1): void {
    if (!product.recipeIngredients || product.recipeIngredients.length === 0) return;

    const materials = [...this.rawMaterials()];

    for (const ing of product.recipeIngredients) {
      const matIndex = materials.findIndex(m => m.id === ing.rawMaterialId);
      if (matIndex >= 0) {
        const mat = materials[matIndex];
        const consumed = ing.quantityUsed * multiplier;
        const newStock = Math.max(0, mat.currentStock - consumed);

        materials[matIndex] = {
          ...mat,
          currentStock: newStock
        };

        if (this.db) {
          setDoc(doc(this.db, 'rawMaterials', mat.id), cleanUndefined(materials[matIndex]), { merge: true }).catch(() => {});
        }
      }
    }

    this.rawMaterials.set(materials);
  }

  // --- SPOILAGE LOGGING ---

  public logSpoilage(data: { itemName: string; quantityWasted: number; unit: UnitOfMeasure; reason: string }, currentEmp?: Employee | null): void {
    const material = this.rawMaterials().find(
      m => m.name.toLowerCase() === data.itemName.toLowerCase()
    );

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    const unitCost = material?.costPerUnit || 0;
    const calculatedCostLoss = Number((unitCost * data.quantityWasted).toFixed(2));

    if (material) {
      const updatedStock = Math.max(0, material.currentStock - data.quantityWasted);
      this.updateRawMaterial(material.id, { currentStock: updatedStock });
    }

    const newLog: SpoilageLog = {
      id: `SPOIL-${Date.now()}`,
      tenantId: currentEmp?.tenantId || tenantId, // 🔒 Dynamic fallback
      storeId: currentEmp?.storeId || storeId,   // 🔒 Dynamic fallback
      itemId: material?.id || 'CUSTOM-ITEM',
      itemName: data.itemName,
      quantityWasted: data.quantityWasted,
      unit: data.unit,
      costLossNet: calculatedCostLoss,
      reason: data.reason,
      loggedByEmployeeId: currentEmp?.id || 'EMP-SYSTEM',
      loggedByEmployeeName: currentEmp?.name || 'Συστήματος',
      timestamp: new Date().toISOString()
    };

    const currentLogs = this.spoilageLogs() || [];
    this.spoilageLogs.set([newLog, ...currentLogs]);

    if (this.db) {
      setDoc(doc(this.db, 'spoilageLogs', newLog.id), cleanUndefined(newLog)).catch(() => {});
    }
  }

  // --- CATEGORY & PRODUCT CATALOG MANAGEMENT ---

  public addCategory(name: string, icon: string = '📁'): { success: boolean; message: string; category?: Category } {
    if (!name.trim()) {
      return { success: false, message: 'Το όνομα κατηγορίας δεν μπορεί να είναι κενό.' };
    }

    const { tenantId, storeId } = this.getActiveTenantAndStore();

    const newCat: Category = {
      id: `CAT-${Date.now()}`,
      tenantId, // 🔒 Dynamic
      storeId,  // 🔒 Dynamic
      name: name.trim(),
      icon: icon || '📁',
      sortOrder: this.categories().length + 1,
      isActive: true
    };

    const updated = [...this.categories(), newCat];
    this.categories.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'categories', newCat.id), cleanUndefined(newCat)).catch(() => {});
    }

    return { success: true, message: 'Η κατηγορία δημιουργήθηκε επιτυχώς', category: newCat };
  }

  public deleteCategory(catId: string): void {
    const updated = this.categories().filter(c => c.id !== catId);
    this.categories.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'categories', catId)).catch(() => {});
    }
  }

  public addProduct(prodData: { name: string; categoryId: string; price: number; purchasePrice?: number; taxRate: GreekVatRate; isPinnedToPOS?: boolean }): void {
    const category = this.categories().find(c => c.id === prodData.categoryId);
    const { tenantId, storeId } = this.getActiveTenantAndStore();

    const newProd: Product = {
      id: `PRD-${Date.now()}`,
      tenantId, // 🔒 Dynamic
      storeId,  // 🔒 Dynamic
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
  }

  public updateProduct(prodId: string, prodData: Partial<Product>): void {
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
  }

  public deleteProduct(prodId: string): void {
    const updated = this.products().filter(p => p.id !== prodId);
    this.products.set(updated);

    if (this.db) {
      deleteDoc(doc(this.db, 'products', prodId)).catch(() => {});
    }
  }
}