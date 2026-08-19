// src/app/core/services/bulk-import.service.ts

import { Injectable, inject } from '@angular/core';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { Product, Category } from '../modals';
import { InventoryService } from './inventory.service';
import { TenantContextService } from './tenant-context.service';

export interface RawImportProduct {
  name: string;
  categoryName: string;
  price: number;
  purchasePrice?: number;
  taxRate?: number;
  isPinnedToPOS?: boolean;
}

export interface ImportReport {
  success: boolean;
  totalParsed: number;
  importedProducts: number;
  newCategoriesCreated: number;
  skippedRows: number;
  message: string;
  warnings: string[];
}

// Dictionary of known aliases in English & Greek
const HEADER_ALIASES: Record<keyof RawImportProduct, string[]> = {
  name: [
    'name', 'product', 'product_name', 'item', 'title', 'description',
    'όνομα', 'ονομα', 'προϊόν', 'προϊον', 'προιον', 'περιγραφή', 'περιγραφη', 'ειδος', 'είδος'
  ],
  categoryName: [
    'categoryname', 'category', 'cat', 'category_name', 'group', 'department',
    'κατηγορία', 'κατηγορια', 'group_name', 'τύπος', 'τυπος', 'ομάδα', 'ομαδα'
  ],
  price: [
    'price', 'unit_price', 'sale_price', 'retail_price', 'price_eur',
    'τιμή', 'τιμη', 'αξία', 'αξια', 'τιμη λιανικης', 'τιμη_λιανικης', 'πώληση'
  ],
  purchasePrice: [
    'purchaseprice', 'purchase_price', 'cost', 'cost_price', 'buy_price',
    'αγορά', 'αγορα', 'κόστος', 'κοστος', 'τιμη αγορας', 'τιμη_αγορας'
  ],
  taxRate: [
    'taxrate', 'tax', 'vat', 'vat_rate', 'tax_rate',
    'φπα', 'φ.π.α', 'φ.π.α.', 'συντελεστής φπα', 'συντελεστης φπα'
  ],
  isPinnedToPOS: [
    'ispinnedtopos', 'pinned', 'favorite', 'pos', 'show_in_pos', 'favorite_pos',
    'αγαπημένα', 'αγαπημενα', 'βιτρίνα', 'βιτρινα', 'pos_visible'
  ]
};

@Injectable({
  providedIn: 'root'
})
export class BulkImportService {
  private tenantContext = inject(TenantContextService);
  private db = getFirestore();
  private inventoryService = inject(InventoryService);

  private getActiveTenantId(): string {
    return localStorage.getItem('active_tenant_id') || 
           (this.tenantContext as any).currentTenantId?.() || 
           (this.tenantContext as any).tenantId?.() || 
           'coffee-shop-demo';
  }

  private getActiveStoreId(): string {
    return localStorage.getItem('active_store_id') || 
           (this.tenantContext as any).currentStoreId?.() || 
           (this.tenantContext as any).activeStoreId?.() || 
           (this.tenantContext as any).storeId?.() || 
           'store-1';
  }

  /**
   * Universal CSV & JSON Parser
   */
  public parseFileContent(text: string, isJson: boolean = false): { products: RawImportProduct[]; warnings: string[] } {
    const warnings: string[] = [];

    if (isJson) {
      try {
        const rawJson = JSON.parse(text);
        const list = Array.isArray(rawJson) ? rawJson : [rawJson];
        const normalized = list.map((item, idx) => this.normalizeItem(item, idx + 1, warnings));
        return { products: normalized.filter((p): p is RawImportProduct => p !== null), warnings };
      } catch (e: any) {
        throw new Error('Το αρχείο JSON δεν έχει έγκυρη μορφή.');
      }
    }

    // --- CSV PARSING ENGINE ---
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('Το αρχείο CSV είναι κενό ή δεν περιέχει γραμμές δεδομένων.');
    }

    // 1. Auto-detect Delimiter (Semicolon ';' vs Comma ',' vs Tab '\t')
    const firstLine = lines[0];
    const delimiter = this.detectDelimiter(firstLine);

    // 2. Parse Headers
    const rawHeaders = this.splitCSVLine(firstLine, delimiter).map(h => this.cleanHeader(h));
    const headerMap = this.mapHeadersToFields(rawHeaders);

    if (headerMap.name === -1) {
      warnings.push('⚠️ Δεν βρέθηκε στήλη για το Όνομα Προϊόντος. Χρησιμοποιήθηκε η 1η στήλη ως προεπιλογή.');
    }

    // 3. Parse Data Rows
    const products: RawImportProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.splitCSVLine(lines[i], delimiter);
      if (values.length === 0 || values.every(v => v === '')) continue;

      const rawItem: Record<string, any> = {};
      

      Object.entries(headerMap).forEach(([field, colIdx]) => {
        if (colIdx !== -1 && colIdx < values.length) {
          rawItem[field] = values[colIdx];
        }
      });

      // Fallback: If 'name' column wasn't identified by alias, use index 0
      if (!rawItem['name'] && headerMap.name === -1 && values.length > 0) {
        rawItem['name'] = values[0];
      }

      const normalized = this.normalizeItem(rawItem, i + 1, warnings);
      if (normalized) {
        products.push(normalized);
      }
    }

    return { products, warnings };
  }

  /**
   * Commit normalized products to Firestore
   */
  public async importProducts(rawProducts: RawImportProduct[]): Promise<ImportReport> {
    const activeTenantId = this.getActiveTenantId();
    const activeStoreId = this.getActiveStoreId();

    if (!rawProducts || rawProducts.length === 0) {
      return {
        success: false,
        totalParsed: 0,
        importedProducts: 0,
        newCategoriesCreated: 0,
        skippedRows: 0,
        message: 'Δεν βρέθηκαν έγκυρα προϊόντα για εισαγωγή.',
        warnings: []
      };
    }

    try {
      const existingCategories = [...this.inventoryService.categories()];
      const categoryMap = new Map<string, string>();

      existingCategories.forEach(c => categoryMap.set(c.name.toLowerCase().trim(), c.id));

      const categoriesToCreate: Category[] = [];
      const newProducts: Product[] = [];

      for (const item of rawProducts) {
        const catName = item.categoryName || 'Γενικά';
        const catKey = catName.toLowerCase().trim();
        let catId = categoryMap.get(catKey);

        if (!catId) {
          catId = `CAT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const newCat: Category = {
            id: catId,
            tenantId: activeTenantId,
            storeId: activeStoreId,
            name: catName,
            icon: '📁',
            sortOrder: categoryMap.size + 1,
            isActive: true
          };
          categoriesToCreate.push(newCat);
          categoryMap.set(catKey, catId);
        }

        const prodId = `PRD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        newProducts.push({
          id: prodId,
          tenantId: activeTenantId, // 🔒 Dynamically stamped with active tenant
          storeId: activeStoreId,   // 🔒 Dynamically stamped with active store
          name: item.name,
          categoryId: catId,
          categoryName: catName,
          price: item.price,
          purchasePrice: item.purchasePrice || 0,
          costPrice: item.purchasePrice || 0,
          taxRate: (item.taxRate || 13) as any,
          stockCount: 100,
          isPinnedToPOS: item.isPinnedToPOS ?? true,
          isActive: true
        });
      }

      // Execute in 400-item chunks (safely under Firestore writeBatch limit of 500)
      const allItems = [...categoriesToCreate, ...newProducts];
      const chunkSize = 400;

      for (let i = 0; i < allItems.length; i += chunkSize) {
        const batch = writeBatch(this.db);
        const chunk = allItems.slice(i, i + chunkSize);

        for (const record of chunk) {
          const colName = 'sortOrder' in record ? 'categories' : 'products';
          batch.set(doc(this.db, colName, record.id), record);
        }

        await batch.commit();
      }

      return {
        success: true,
        totalParsed: rawProducts.length,
        importedProducts: newProducts.length,
        newCategoriesCreated: categoriesToCreate.length,
        skippedRows: 0,
        message: `Εισήχθησαν επιτυχώς ${newProducts.length} προϊόντα και ${categoriesToCreate.length} νέες κατηγορίες!`,
        warnings: []
      };
    } catch (err: any) {
      console.error('Bulk Import Error:', err);
      return {
        success: false,
        totalParsed: rawProducts.length,
        importedProducts: 0,
        newCategoriesCreated: 0,
        skippedRows: rawProducts.length,
        message: `Σφάλμα κατά την εγγραφή στο database: ${err?.message || err}`,
        warnings: []
      };
    }
  }

  // --- HELPER FUNCTIONS ---

  private detectDelimiter(line: string): string {
    const semicolons = (line.match(/;/g) || []).length;
    const commas = (line.match(/,/g) || []).length;
    const tabs = (line.match(/\t/g) || []).length;

    if (semicolons >= commas && semicolons >= tabs) return ';';
    if (tabs > commas && tabs > semicolons) return '\t';
    return ',';
  }

  private cleanHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/^[\uFEFF\s"']+|[\s"']+$/g, '')
      .replace(/[\_\-\s]+/g, '');
  }

  private mapHeadersToFields(rawHeaders: string[]): Record<keyof RawImportProduct, number> {
    const map: Record<keyof RawImportProduct, number> = {
      name: -1,
      categoryName: -1,
      price: -1,
      purchasePrice: -1,
      taxRate: -1,
      isPinnedToPOS: -1
    };

    (Object.keys(HEADER_ALIASES) as (keyof RawImportProduct)[]).forEach(field => {
      const aliases = HEADER_ALIASES[field].map(a => this.cleanHeader(a));
      const matchIndex = rawHeaders.findIndex(h => aliases.includes(h));
      if (matchIndex !== -1) {
        map[field] = matchIndex;
      }
    });

    return map;
  }

  private normalizeItem(raw: Record<string, any>, rowNum: number, warnings: string[]): RawImportProduct | null {
    const nameVal = this.findRawFieldValue(raw, 'name') || '';
    const catVal = this.findRawFieldValue(raw, 'categoryName') || 'Γενικά';
    const priceVal = this.findRawFieldValue(raw, 'price');
    const purchaseVal = this.findRawFieldValue(raw, 'purchasePrice');
    const taxVal = this.findRawFieldValue(raw, 'taxRate');
    const pinnedVal = this.findRawFieldValue(raw, 'isPinnedToPOS');

    const cleanName = String(nameVal).trim();
    if (!cleanName) {
      warnings.push(`Γραμμή ${rowNum}: Παραλείφθηκε λόγω έλλειψης ονόματος.`);
      return null;
    }

    const priceNum = this.parseNumericValue(priceVal);
    const purchaseNum = this.parseNumericValue(purchaseVal);
    let taxNum = this.parseNumericValue(taxVal);

    if (!taxNum || taxNum <= 0) taxNum = 13;

    let isPinned = true;
    if (pinnedVal !== undefined && pinnedVal !== null) {
      const strVal = String(pinnedVal).toLowerCase().trim();
      isPinned = strVal === 'true' || strVal === '1' || strVal === 'ναι' || strVal === 'yes';
    }

    return {
      name: cleanName,
      categoryName: String(catVal).trim() || 'Γενικά',
      price: priceNum,
      purchasePrice: purchaseNum,
      taxRate: taxNum,
      isPinnedToPOS: isPinned
    };
  }

  private findRawFieldValue(raw: Record<string, any>, field: keyof RawImportProduct): any {
    if (raw[field] !== undefined) return raw[field];

    const aliases = HEADER_ALIASES[field];
    for (const key of Object.keys(raw)) {
      const cleanedKey = this.cleanHeader(key);
      if (aliases.some(a => this.cleanHeader(a) === cleanedKey)) {
        return raw[key];
      }
    }
    return undefined;
  }

  private parseNumericValue(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;

    const cleaned = String(val)
      .replace(/[€$\s]/g, '')
      .replace(',', '.');

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  private splitCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' || c === "'") {
        inQuotes = !inQuotes;
      } else if (c === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result.map(v => v.replace(/^["']|["']$/g, ''));
  }

  public parseCSV(csvText: string): RawImportProduct[] {
    const { products } = this.parseFileContent(csvText, false);
    return products;
  }
}