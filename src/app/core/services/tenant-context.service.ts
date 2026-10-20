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
    },
    {
      tenantId: 'beach-bar-test',
      storeId: 'store-1',
      name: 'Beach Bar Test',
      badge: 'BB',
      city: 'Athens',
      icon: '🏖️',
      themeColor: 'emerald'
    }
  ];

  // Initialize from storage or default to primary store
  private readonly defaultStore = this.registeredStores[0];

  public currentTenantId = signal<string>(
    localStorage.getItem('active_tenant_id') || this.defaultStore.tenantId
  );

  public currentStoreId = signal<string>(
    localStorage.getItem('active_store_id') || this.defaultStore.storeId
  );

  public activeStore = computed<StoreProfile>(() => {
    const tenant = this.currentTenantId();
    const store = this.currentStoreId();
    return (
      this.registeredStores.find(s => s.tenantId === tenant && s.storeId === store) ||
      this.defaultStore
    );
  });

  /**
   * Sets tenant and store context with input validation against registered stores
   */
  public setTenantAndStore(tenantId: string, storeId: string = 'store-1'): void {
    const isValid = this.registeredStores.some(
      s => s.tenantId === tenantId && s.storeId === storeId
    );

    if (!isValid) {
      console.error(`Invalid tenant/store context rejected: ${tenantId} / ${storeId}`);
      return;
    }

    this.currentTenantId.set(tenantId);
    this.currentStoreId.set(storeId);

    localStorage.setItem('active_tenant_id', tenantId);
    localStorage.setItem('active_store_id', storeId);

    // Wipe cached credentials to avoid cross-tenant leaks
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');
  }

  public resetToDefault(): void {
    this.setTenantAndStore(this.defaultStore.tenantId, this.defaultStore.storeId);
  }
}