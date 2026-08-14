// src/app/core/services/tenant-context.service.ts

import { Injectable, signal } from '@angular/core';

export interface StoreTenant {
  tenantId: string;
  storeId: string;
  storeName: string;
  currency: string;
  vatTiers: { food: number; alcohol: number };
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

  // Read saved values directly from localStorage during initialization
 public currentTenantId = signal<string>(
    localStorage.getItem('active_tenant_id') || 'tirane-kafe-1974'
  );
  
  public currentStoreId = signal<string>(
    localStorage.getItem('active_store_id') || 'store-2'
  );

 public selectStore(store: StoreTenant): void {
    this.currentTenantId.set(store.tenantId);
    this.currentStoreId.set(store.storeId);
    localStorage.setItem('active_tenant_id', store.tenantId);
    localStorage.setItem('active_store_id', store.storeId);
    
    // Clear old employee session when switching stores
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');
    window.location.reload();
  }
}