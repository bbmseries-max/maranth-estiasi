// src/app/core/services/tenant-context.service.ts

import { Injectable, signal, computed, inject } from '@angular/core';
import { Firestore, doc, onSnapshot, Unsubscribe } from '@angular/fire/firestore';

export interface StoreProfile {
  tenantId: string;
  storeId: string;
  name: string;
  badge: string;
  city: string;
  icon: string;
  themeColor: string;
  afm?: string;
  doy?: string;
  address?: string;
  phone?: string;
  isDemo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  private readonly firestore = inject(Firestore, { optional: true });
  private tenantDocUnsub: Unsubscribe | null = null;

  public readonly registeredStores: StoreProfile[] = [
    {
      tenantId: 'tirane-kafe-1974',
      storeId: 'store-2',
      name: 'Tiranë Kafe 1974',
      badge: 'TK',
      city: 'Tiranë',
      icon: '☕',
      themeColor: 'amber',
      afm: '',
      doy: '',
      address: 'Tiranë'
    },
    {
      tenantId: 'coffee-shop-demo',
      storeId: 'store-1',
      name: 'Demo Estiasi (Showcase)',
      badge: 'DEMO',
      city: 'Live Demo',
      icon: '✨',
      themeColor: 'sky',
      afm: '999999999',
      doy: 'Α΄ Αθηνών',
      address: 'Λεωφ. Δημοκρατίας 1, Αθήνα',
      phone: '210 0000000',
      isDemo: true
    },
    {
      tenantId: 'beach-bar-test',
      storeId: 'store-1',
      name: 'Beach Bar Test',
      badge: 'BB',
      city: 'Athens',
      icon: '🏖️',
      themeColor: 'emerald',
      afm: '000000000',
      doy: 'Γλυφάδας',
      address: 'Παραλιακή 12, Γλυφάδα'
    }
  ];

  private readonly defaultStore = this.registeredStores[1]; // Safe Showcase Demo fallback

  public currentTenantId = signal<string>(
    localStorage.getItem('active_tenant_id') || this.defaultStore.tenantId
  );

  public currentStoreId = signal<string>(
    localStorage.getItem('active_store_id') || this.defaultStore.storeId
  );

  // Live Firestore tenant profile fetched from /tenants/{tenantId}
  public firestoreTenantProfile = signal<StoreProfile | null>(this.loadCachedProfile());

  public activeStore = computed<StoreProfile>(() => {
    const tenant = this.currentTenantId();
    const store = this.currentStoreId();

    // 1. Prioritize live Firestore tenant document (/tenants/{slug})
    const liveProfile = this.firestoreTenantProfile();
    if (liveProfile && liveProfile.tenantId === tenant) {
      return liveProfile;
    }

    // 2. Fallback to built-in registeredStores if found
    const staticMatch = this.registeredStores.find(
      s => s.tenantId === tenant && (!store || s.storeId === store)
    ) || this.registeredStores.find(s => s.tenantId === tenant);

    if (staticMatch) {
      return staticMatch;
    }

    // 3. Dynamic non-demo placeholder while Firestore resolves
    const cleanTitle = tenant
      .split('-')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');

    return {
      tenantId: tenant,
      storeId: store || tenant,
      name: cleanTitle || this.defaultStore.name,
      badge: (tenant.slice(0, 2) || 'ST').toUpperCase(),
      city: '',
      icon: '🏪',
      themeColor: 'emerald',
      afm: '',
      doy: '',
      address: '',
      phone: ''
    };
  });

  constructor() {
    const initialTenant = this.currentTenantId();
    if (initialTenant) {
      this.subscribeToTenantProfile(initialTenant);
    }
  }

  private loadCachedProfile(): StoreProfile | null {
    try {
      const raw = localStorage.getItem('active_tenant_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Subscribes to /tenants/{tenantId} in maranth-hub Firestore for live Z-Report & receipt branding
   */
  public subscribeToTenantProfile(tenantId: string): void {
    if (this.tenantDocUnsub) {
      this.tenantDocUnsub();
      this.tenantDocUnsub = null;
    }

    if (!this.firestore || !tenantId) return;

    const tenantRef = doc(this.firestore, 'tenants', tenantId);
    this.tenantDocUnsub = onSnapshot(
      tenantRef,
      (snap) => {
        if (!snap.exists()) return;

        const data = snap.data() as Record<string, any>;
        const resolvedName = String(data['name'] || data['clientName'] || tenantId).trim();
        const resolvedStoreId = String(data['storeId'] || tenantId).trim();
        const words = resolvedName.split(/\s+/).filter(Boolean);
        const badge = words.length >= 2
          ? `${words[0][0]}${words[1][0]}`.toUpperCase()
          : resolvedName.slice(0, 2).toUpperCase();

        const profile: StoreProfile = {
          tenantId,
          storeId: resolvedStoreId,
          name: resolvedName,
          badge,
          city: String(data['city'] || '').trim(),
          icon: '🏪',
          themeColor: 'emerald',
          afm: String(data['afm'] || data['taxNumber'] || '').trim(),
          doy: String(data['doy'] || '').trim(),
          address: String(data['address'] || '').trim(),
          phone: String(data['phone'] || data['contactPhone'] || '').trim(),
          isDemo: tenantId === 'coffee-shop-demo'
        };

        this.firestoreTenantProfile.set(profile);
        localStorage.setItem('active_tenant_profile', JSON.stringify(profile));

        // Keep storeId aligned with Firestore document if not explicitly overridden
        if (data['storeId'] && this.currentStoreId() !== data['storeId']) {
          this.currentStoreId.set(data['storeId']);
          localStorage.setItem('active_store_id', data['storeId']);
        }
      },
      (err) => {
        console.warn(`[TenantContextService] Could not stream /tenants/${tenantId}:`, err);
      }
    );
  }

  /**
   * Sets tenant and store context for both built-in stores and Dashboard-provisioned tenants
   */
  public setTenantAndStore(tenantId: string, storeId?: string): void {
    const cleanTenant = tenantId.trim().toLowerCase();
    if (!cleanTenant) return;

    const builtIn = this.registeredStores.find(s => s.tenantId === cleanTenant);
    const resolvedStoreId = storeId?.trim() || builtIn?.storeId || cleanTenant;

    const changed = this.currentTenantId() !== cleanTenant;

    this.currentTenantId.set(cleanTenant);
    this.currentStoreId.set(resolvedStoreId);

    localStorage.setItem('active_tenant_id', cleanTenant);
    localStorage.setItem('active_store_id', resolvedStoreId);

    if (changed) {
      localStorage.removeItem('current_employee');
      localStorage.removeItem('maranth_pos_employee');
    }

    this.subscribeToTenantProfile(cleanTenant);
  }

  public resetToDefault(): void {
    this.setTenantAndStore(this.defaultStore.tenantId, this.defaultStore.storeId);
  }
}