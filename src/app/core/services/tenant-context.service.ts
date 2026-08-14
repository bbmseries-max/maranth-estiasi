// src/app/core/services/tenant-context.service.ts

import { Injectable, signal, computed } from '@angular/core';

export interface StoreTenant {
  tenantId: string;
  storeId: string;
  storeName: string;
  currency?: string;
  vatTiers?: { food: number; alcohol: number };
}

@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  public availableStores: StoreTenant[] = [
    {
      tenantId: 'coffee-shop-demo',
      storeId: 'store-1',
      storeName: '☕ Coffee Shop Demo',
      currency: '€',
      vatTiers: { food: 13, alcohol: 24 }
    },
    {
      tenantId: 'tirane-kafe-1974',
      storeId: 'store-2',
      storeName: '📍 Tirane kafe 1974',
      currency: '€',
      vatTiers: { food: 13, alcohol: 24 }
    }
  ];

  public currentTenantId = signal<string>(
    localStorage.getItem('active_tenant_id') || 'tirane-kafe-1974'
  );
  
  public currentStoreId = signal<string>(
    localStorage.getItem('active_store_id') || 'store-2'
  );

  // Backward-compatibility aliases
  public activeTenantId = computed(() => this.currentTenantId());
  public activeStoreId = computed(() => this.currentStoreId());
  public tenantId = computed(() => this.currentTenantId());
  public storeId = computed(() => this.currentStoreId());

  /**
   * Primary switcher method called by TenantSwitcherComponent
   */
  public setTenantAndStore(tenantId: string, storeId?: string): void {
    const targetStoreId = storeId || (tenantId === 'tirane-kafe-1974' ? 'store-2' : 'store-1');
    
    this.currentTenantId.set(tenantId);
    this.currentStoreId.set(targetStoreId);
    
    localStorage.setItem('active_tenant_id', tenantId);
    localStorage.setItem('active_store_id', targetStoreId);

    // Clear previous employee session when switching stores to avoid state conflicts
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  public selectStore(store: StoreTenant): void {
    this.setTenantAndStore(store.tenantId, store.storeId);
  }

  public setTenant(tenantId: string): void {
    this.setTenantAndStore(tenantId);
  }

  public setStore(storeId: string): void {
    this.setTenantAndStore(this.currentTenantId(), storeId);
  }
}