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
    // ➕ Future shops (Client 3, Client 4, etc.) can be added right here!
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
   * Fast 1-Click Store Switcher
   * Flushes old local sessions and cleanly switches active store
   */
  public switchStore(target: StoreProfile): void {
    this.currentTenantId.set(target.tenantId);
    this.currentStoreId.set(target.storeId);

    localStorage.setItem('active_tenant_id', target.tenantId);
    localStorage.setItem('active_store_id', target.storeId);

    // Clean session caches to prevent cross-tenant contamination
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');

    // Reload cleanly to reconnect all Firestore listeners to the new store
    window.location.href = '/login';
  }
}