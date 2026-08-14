// src/app/core/services/tenant-context.service.ts

import { Injectable, signal, computed } from '@angular/core';

export interface StoreProfile {
  tenantId: string;
  storeId: string;
  name: string;
  badge: string;
  city: string;
  icon: string;
  themeColor: string;
  isDemo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  // 🏢 Scalable Store Registry: Add new client shops here anytime!
  public readonly registeredStores: StoreProfile[] = [
    {
      tenantId: 'tirane-kafe-1974',
      storeId: 'store-2',
      name: 'Tiranë Kafe 1974',
      badge: 'TK',
      city: 'Tiranë',
      icon: '☕',
      themeColor: 'amber'
    },
    {
      tenantId: 'coffee-shop-demo',
      storeId: 'store-1',
      name: 'Demo Estiasi (Showcase)',
      badge: 'DEMO',
      city: 'Live Demo',
      icon: '✨',
      themeColor: 'sky',
      isDemo: true
    }
  ];

  // Reactive State Signals
  public currentTenantId = signal<string>(
    localStorage.getItem('active_tenant_id') || 'tirane-kafe-1974'
  );

  public currentStoreId = signal<string>(
    localStorage.getItem('active_store_id') || 'store-2'
  );

  // Active Store Profile Computed Signal
  public activeStore = computed<StoreProfile>(() => {
    const tenant = this.currentTenantId();
    const store = this.currentStoreId();
    return (
      this.registeredStores.find(s => s.tenantId === tenant && s.storeId === store) ||
      this.registeredStores[0]
    );
  });

  /**
   * Direct setter for Tenant & Store IDs (used by tenant-switcher component)
   */
  public setTenantAndStore(tenantId: string, storeId: string = 'store-1'): void {
    this.currentTenantId.set(tenantId);
    this.currentStoreId.set(storeId);

    localStorage.setItem('active_tenant_id', tenantId);
    localStorage.setItem('active_store_id', storeId);

    // Clean session caches to prevent cross-tenant contamination
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');

    // Reload cleanly to reconnect all Firestore listeners to the new store
    window.location.href = '/login';
  }

  /**
   * Fast 1-Click Store Switcher
   */
  public switchStore(target: StoreProfile): void {
    this.setTenantAndStore(target.tenantId, target.storeId);
  }
}