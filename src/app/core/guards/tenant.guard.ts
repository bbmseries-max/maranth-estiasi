// src/app/core/guards/tenant.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { TenantContextService } from '../services/tenant-context.service';

export const tenantExistsGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const tenantContext = inject(TenantContextService);
  const firestore = inject(Firestore, { optional: true });

  const rawSlug = route.paramMap.get('tenantSlug');
  const slug = rawSlug ? rawSlug.trim().toLowerCase() : '';

  if (!slug) {
    console.warn('[TenantGuard] No slug provided, redirecting to demo login');
    return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
  }

  // 1. Check built-in local/demo stores first
  const builtInStore = tenantContext.registeredStores.find((s) => s.tenantId === slug);

  if (builtInStore) {
    if (
      tenantContext.currentTenantId() !== slug ||
      tenantContext.currentStoreId() !== builtInStore.storeId
    ) {
      tenantContext.currentTenantId.set(slug);
      tenantContext.currentStoreId.set(builtInStore.storeId);
      localStorage.setItem('active_tenant_id', slug);
      localStorage.setItem('active_store_id', builtInStore.storeId);
    }
    tenantContext.subscribeToTenantProfile(slug);
    return true;
  }

  // 2. Verify Dashboard-provisioned tenant in Firestore (/tenants/{slug})
  if (!firestore) {
    console.error('[TenantGuard] Firestore unavailable while resolving dynamic tenant:', slug);
    return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
  }

  try {
    const tenantRef = doc(firestore, 'tenants', slug);
    const snap = await Promise.race([
      getDoc(tenantRef),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Tenant lookup timed out (3500ms)')), 3500)
      )
    ]);

    if (!snap || !snap.exists()) {
      console.error(`[Security] Unknown tenant route (not in Firestore): ${slug}`);
      return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
    }

    const data = snap.data() as Record<string, any>;
    const sub = data['subscription'] || {};
    const effectiveStatus = String(
      sub['status'] || data['status'] || (data['isActive'] === false ? 'SUSPENDED' : 'ACTIVE')
    )
      .trim()
      .toUpperCase();

    let isAllowed =
      data['isActive'] !== false &&
      effectiveStatus !== 'SUSPENDED' &&
      effectiveStatus !== 'EXPIRED' &&
      effectiveStatus !== 'CANCELED' &&
      effectiveStatus !== 'CANCELLED';

    if (isAllowed && sub['tier'] !== 'LIFETIME' && sub['validUntil']) {
      const expiryMs = new Date(sub['validUntil']).getTime();
      if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
        isAllowed = false;
      }
    }

    if (!isAllowed) {
      console.warn(`[TenantGuard] Access denied for tenant "${slug}" (status: ${effectiveStatus})`);
      return router.createUrlTree(['/t', 'coffee-shop-demo', 'login'], {
        queryParams: { lockedTenant: slug, reason: effectiveStatus }
      });
    }

    const resolvedStoreId = String(data['storeId'] || slug).trim();

    if (
      tenantContext.currentTenantId() !== slug ||
      tenantContext.currentStoreId() !== resolvedStoreId
    ) {
      tenantContext.currentTenantId.set(slug);
      tenantContext.currentStoreId.set(resolvedStoreId);
      localStorage.setItem('active_tenant_id', slug);
      localStorage.setItem('active_store_id', resolvedStoreId);
    }

    // Start live listener for Z-Report / receipt branding & profile updates
    tenantContext.subscribeToTenantProfile(slug);

    return true;
  } catch (err) {
    console.error(`[TenantGuard] Error verifying /tenants/${slug}:`, err);
    return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
  }
};