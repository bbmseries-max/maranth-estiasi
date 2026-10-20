// src/app/core/guards/tenant.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { TenantContextService } from '../services/tenant-context.service';

export const tenantExistsGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const tenantContext = inject(TenantContextService);
  const slug = route.paramMap.get('tenantSlug');

  if (!slug) {
    console.warn('[TenantGuard] No slug provided, redirecting to demo login');
    return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
  }

  const matchedStore = tenantContext.registeredStores.find(s => s.tenantId === slug);

  if (!matchedStore) {
    console.error(`[Security] Unknown tenant route: ${slug}`);
    return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
  }

  // Update signals safely without wiping localStorage credentials
  if (tenantContext.currentTenantId() !== slug || tenantContext.currentStoreId() !== matchedStore.storeId) {
    tenantContext.currentTenantId.set(slug);
    tenantContext.currentStoreId.set(matchedStore.storeId);
    localStorage.setItem('active_tenant_id', slug);
    localStorage.setItem('active_store_id', matchedStore.storeId);
  }

  return true;
};