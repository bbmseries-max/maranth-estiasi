// src/app/core/services/tenant-context.service.ts

import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  // Read saved values directly from localStorage during initialization
  public currentTenantId = signal<string>(
    localStorage.getItem('active_tenant_id') || 'coffee-shop-demo'
  );
  public currentStoreId = signal<string>(
    localStorage.getItem('active_store_id') || 'store-1'
  );

  /**
   * Updates active tenant and store context and persists them to localStorage
   */
  public setTenantAndStore(tenantId: string, storeId: string): void {
    if (!tenantId || !storeId) return;

    localStorage.setItem('active_tenant_id', tenantId);
    localStorage.setItem('active_store_id', storeId);

    this.currentTenantId.set(tenantId);
    this.currentStoreId.set(storeId);

    console.log(`🔄 Switched active tenant context to: ${tenantId} (${storeId})`);
  }

  /**
   * Compatibility wrapper for existing setTenant calls
   */
  public setTenant(tenantId: string, storeId: string = 'store-1'): void {
    this.setTenantAndStore(tenantId, storeId);
  }
}