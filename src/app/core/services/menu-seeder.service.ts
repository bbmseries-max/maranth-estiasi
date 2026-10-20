// src/app/core/services/menu-seeder.service.ts

import { Injectable, inject, Injector } from '@angular/core';
import { TenantContextService } from './tenant-context.service';
import { RestaurantPosService } from './restaurant-pos.service';
import { Category, Product, ModifierGroup } from '../modals';

export interface SeedMenuData {
  categories: Category[];
  products: Product[];
  modifiers?: any[];
  modifierGroups?: ModifierGroup[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuSeederService {
 private posService = inject(RestaurantPosService);
  private tenantContext = inject(TenantContextService);

  public async checkAndSeedDemoIfNeeded(): Promise<void> {
    const tenantId = this.tenantContext.currentTenantId();
    const storeId = this.tenantContext.currentStoreId();

    // 1. Wait a moment for initial Firestore sync to evaluate
    setTimeout(async () => {
      const currentProducts = this.posService.products();
      const currentTables = this.posService.tables();

      // If store is completely empty (no products or no tables), provision the starter pack!
      if (currentProducts.length === 0) {
        await this.posService.seedDefaultMenuForCurrentStore();
      }

      if (currentTables.length === 0) {
        const defaultTables = (this.posService.tableOrderService as any).getInitialDefaultTables(tenantId, storeId);
        if (this.posService.db && defaultTables) {
          for (const tbl of defaultTables) {
            await (this.posService.tableOrderService as any).addTable(tbl);
          }
        }
      }
    }, 1200);
  }

  /**
   * Safety Guard: Only seed demo data if explicitly in demo mode or forced
   */
  public async seedCoffeeShopTenant(force: boolean = false): Promise<SeedMenuData | null> {
    const activeTenant = this.tenantContext.currentTenantId();

    // 🔒 Block seeding for active client accounts unless forced
    if (activeTenant !== 'coffee-shop-demo' && !force) {
      
      return null;
    }

    return this.loadAndSeedFromPublicJson();
  }

  /**
   * Fetches public JSON seed and loads it into active state
   */
  public async loadAndSeedFromPublicJson(): Promise<SeedMenuData | null> {
    try {
      const activeTenant = this.tenantContext.currentTenantId();
      const activeStore = this.tenantContext.currentStoreId();

      const response = await fetch('/seeds/coffee-shop-menu.seed.json');

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const seedData: SeedMenuData = await response.json();
      const pos = this.posService;

      // Stamp active tenantId & storeId onto imported JSON items
      const stampedCategories = (seedData.categories || []).map(cat => ({
        ...cat,
        tenantId: activeTenant,
        storeId: activeStore
      }));

      const stampedProducts = (seedData.products || []).map(prod => ({
        ...prod,
        tenantId: activeTenant,
        storeId: activeStore
      }));

      const stampedModifierGroups = (seedData.modifierGroups || []).map(group => ({
        ...group,
        tenantId: activeTenant,
        storeId: activeStore
      }));

      // 1. Clear existing local state
      pos.inventoryService.categories.set([]);
      pos.inventoryService.products.set([]);

      // 2. Set new stamped categories & products
      if (stampedCategories.length > 0) {
        pos.inventoryService.categories.set(stampedCategories);
      }

      if (stampedProducts.length > 0) {
        pos.inventoryService.products.set(stampedProducts);
      }

      if (stampedModifierGroups.length > 0) {
        pos.inventoryService.modifierGroups.set(stampedModifierGroups);
      }

      return seedData;
    } catch (error) {
      console.error('❌ Failed to load coffee-shop-menu.seed.json:', error);
      return null;
    }
  }

  /**
   * 🔒 Backward Compatibility Alias for existing component calls
   */
  public seedDemoMenu(): void {
    this.checkAndSeedDemoIfNeeded();
  }

  
}