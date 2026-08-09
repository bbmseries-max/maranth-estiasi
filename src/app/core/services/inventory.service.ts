import { Injectable, signal, computed, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

import { 
  UnitOfMeasure, 
  GreekVatRate, 
  RawMaterial, 
  Category, 
  Product, 
  SpoilageLog, 
  Employee 
} from '../models/restaurant-pos.models';

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

const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  { id: 'RM-1', name: 'Espresso Beans (Specialty)', unit: 'KG', currentStock: 12.5, minAlertStock: 3.0, costPerUnit: 18.5 },
  { id: 'RM-2', name: 'Φρέσκο Γάλα 3.7%', unit: 'LITER', currentStock: 24.0, minAlertStock: 6.0, costPerUnit: 1.2 },
  { id: 'RM-3', name: 'Γάλα Βρώμης (Barista)', unit: 'LITER', currentStock: 10.0, minAlertStock: 3.0, costPerUnit: 2.1 },
  { id: 'RM-4', name: 'Ψωμί Brioche', unit: 'PCS', currentStock: 45.0, minAlertStock: 15.0, costPerUnit: 0.6 }
];

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private db: Firestore | null = null;

  // Signals
  public rawMaterials = signal<RawMaterial[]>([]);
  public categories = signal<Category[]>([]);
  public products = signal<Product[]>([]);
  public spoilageLogs = signal<SpoilageLog[]>([]);

  // Computations
  public lowStockMaterials = computed(() => 
    this.rawMaterials().filter(m => m.currentStock <= m.minAlertStock)
  );

  public totalInventoryValue = computed(() => 
    this.rawMaterials().reduce((acc, m) => acc + (m.currentStock * m.costPerUnit), 0)
  );

  /**
   * Attach Firebase Firestore database reference & start realtime listeners
   */
  public initFirestoreSync(dbInstance: Firestore | null): void {
    if (!dbInstance) return;
    this.db = dbInstance;

    // 1. Sync Raw Materials
    onSnapshot(collection(this.db, 'rawMaterials'), (snap) => {
      const list: RawMaterial[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as RawMaterial));
      }
      this.rawMaterials.set(list.length > 0 ? list : INITIAL_RAW_MATERIALS);
    });

    // 2. Sync Categories
    onSnapshot(collection(this.db, 'categories'), (snap) => {
      const list: Category[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as Category));
        list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      }
      this.categories.set(list);
    });

    // 3. Sync Products
    onSnapshot(collection(this.db, 'products'), (snap) => {
      const list: Product[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as Product));
      }
      this.products.set(list);
    });

    // 4. Sync Spoilage Logs
    onSnapshot(collection(this.db, 'spoilageLogs'), (snap) => {
      const list: SpoilageLog[] = [];
      if (!snap.empty) {
        snap.forEach(docSnap => list.push(docSnap.data() as SpoilageLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      this.spoilageLogs.set(list);
    });
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

    const unitCost = material?.costPerUnit || 0;
    const calculatedCostLoss = Number((unitCost * data.quantityWasted).toFixed(2));

    if (material) {
      const updatedStock = Math.max(0, material.currentStock - data.quantityWasted);
      this.updateRawMaterial(material.id, { currentStock: updatedStock });
    }

    const newLog: SpoilageLog = {
      id: `SPOIL-${Date.now()}`,
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