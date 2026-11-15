// src/app/core/guards/tenant.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { TenantContextService } from '../services/tenant-context.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getOrStartEstiasiDeviceTrialExpiry(slug: string): number {
  const key = `maranth_estiasi_device_trial_until_${slug.toLowerCase()}`;
  const existing = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  if (existing) {
    const parsed = Number(existing);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  const expiryMs = Date.now() + SEVEN_DAYS_MS;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, String(expiryMs));
  }
  return expiryMs;
}

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

  const builtInStore = tenantContext.registeredStores.find((s) => s.tenantId === slug);

  // 1. Verify Dashboard-provisioned tenant in Firestore (/tenants/{slug}) whenever Firestore is available
  if (firestore) {
    try {
      const tenantRef = doc(firestore, 'tenants', slug);
      const snap = await Promise.race([
        getDoc(tenantRef),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Tenant lookup timed out (3500ms)')), 3500)
        )
      ]);

      if (snap && snap.exists()) {
        const data = snap.data() as Record<string, any>;
        const sub = data['subscription'] || {};
        const effectiveStatus = String(
          sub['status'] || data['status'] || (data['isActive'] === false ? 'SUSPENDED' : 'ACTIVE')
        )
          .trim()
          .toUpperCase();
        const effectiveTier = String(sub['tier'] || data['plan'] || '')
          .trim()
          .toUpperCase();

        let isAllowed =
          data['isActive'] !== false &&
          effectiveStatus !== 'SUSPENDED' &&
          effectiveStatus !== 'EXPIRED' &&
          effectiveStatus !== 'CANCELED' &&
          effectiveStatus !== 'CANCELLED';

        let lockReason = effectiveStatus;

        if (isAllowed) {
          // A. Public Demo (Per-Device 7-Day Trial — each browser gets its own 7d clock)
          if (effectiveTier === 'PUBLIC_DEMO_7D') {
            const deviceExpiry = getOrStartEstiasiDeviceTrialExpiry(slug);
            if (Date.now() > deviceExpiry) {
              isAllowed = false;
              lockReason = 'DEMO_EXPIRED';
            }
          }
          // B. Named Client 7-Day Trial (Stamps validUntil = now + 7d on very first open)
          else if (sub['trialStartsOnFirstOpen'] && !sub['validUntil']) {
            const nowIso = new Date().toISOString();
            const sevenDaysIso = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
            try {
              await setDoc(
                tenantRef,
                {
                  subscription: {
                    ...sub,
                    status: 'ACTIVE',
                    activatedAt: nowIso,
                    validUntil: sevenDaysIso,
                    trialStartsOnFirstOpen: false
                  },
                  updatedAt: nowIso
                },
                { merge: true }
              );
            } catch (stampErr) {
              console.warn(`[TenantGuard] Could not stamp first-open trial for /tenants/${slug}:`, stampErr);
            }
          }
          // C. Standard Timed / Paid Subscription
          else if (effectiveTier !== 'LIFETIME' && sub['validUntil']) {
            const expiryMs = new Date(sub['validUntil']).getTime();
            if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
              isAllowed = false;
              lockReason = 'EXPIRED';
            }
          }
        }

        if (!isAllowed) {
          console.warn(`[TenantGuard] Access denied for tenant "${slug}" (reason: ${lockReason})`);
          // Prevent redirect loop if coffee-shop-demo itself is locked
          if (slug === 'coffee-shop-demo') {
            return router.createUrlTree(['/t', 'demo-locked', 'login'], {
              queryParams: { lockedTenant: slug, reason: lockReason }
            });
          }
          return router.createUrlTree(['/t', 'coffee-shop-demo', 'login'], {
            queryParams: { lockedTenant: slug, reason: lockReason }
          });
        }

        const resolvedStoreId = String(data['storeId'] || builtInStore?.storeId || slug).trim();

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
      }

      // Not found in Firestore: allow built-in local stores (with 7d per-device demo check for coffee-shop-demo), block unknown slugs
      if (!builtInStore) {
        console.error(`[Security] Unknown tenant route (not in Firestore): ${slug}`);
        return router.createUrlTree(['/t', 'coffee-shop-demo', 'login'], {
          queryParams: { lockedTenant: slug, reason: 'NOT_FOUND' }
        });
      }
    } catch (err) {
      console.error(`[TenantGuard] Error verifying /tenants/${slug}:`, err);
      if (!builtInStore) {
        return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
      }
    }
  }

  // 2. Fallback for built-in local/demo stores when not overridden by Firestore
  if (builtInStore) {
    if (slug === 'coffee-shop-demo') {
      const deviceExpiry = getOrStartEstiasiDeviceTrialExpiry(slug);
      if (Date.now() > deviceExpiry) {
        return router.createUrlTree(['/t', 'demo-locked', 'login'], {
          queryParams: { lockedTenant: slug, reason: 'DEMO_EXPIRED' }
        });
      }
    }

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

  return router.createUrlTree(['/t', 'coffee-shop-demo', 'login']);
};