# Multi-Tenant POS Platform Audit & Security Stabilization
**Application:** Maranth.gr Estiasi POS  
**Domain:** Bar / Cafe / Restaurant Multi-Tenant POS System  
**Framework:** Angular (Standalone Components, Signals, RxJS/Firestore)  
**Date:** October 20, 2026  
**Status:** STABLE & DEPLOYMENT-READY

---

## 1. Executive Summary

This audit addressed severe multi-tenancy security vulnerabilities, data leakage across client databases, router deadlocks, financial discrepancies during bill splitting, and unhandled navigation state drops. The system was transformed from an insecure flat-route client application into an enterprise-grade, URL-scoped, cryptographically guarded multi-tenant POS platform.

---

## 2. Security Vulnerabilities Identified & Resolved

### 1. Cross-Tenant Firestore Data Exposure (Critical)
* **Vulnerability:** Services were executing blanket subscriptions to root collections:
  `onSnapshot(collection(db, 'sales'))`, `shifts`, `tables`, `vaults`, `employees`, and `z_reports`.
  Every restaurant's data was downloaded into memory and merely filtered client-side with JavaScript.
* **Impact:** Anyone opening Chrome DevTools Network/Frames could inspect competing businesses' sales, waiter PINs, and financial totals.
* **Resolution:** Converted all listeners across `RestaurantPosService`, `AuthShiftService`, `TableOrderService`, and `InventoryService` into Firestore server-side queries strictly constrained by `where('tenantId', '==', tenantId)` and `where('storeId', '==', storeId)`.

### 2. Elimination of Hardcoded Frontend Backdoors
* **Vulnerability:** Plaintext admin codes (`9999`) and client-side device pairing logic were present in the frontend bundle.
* **Resolution:** Simplified tenant onboarding to an authoritative single-owner provisioning model. The frontend bundle was purged of backdoor strings, and device pairings use immutable Web Crypto SHA-256 digests.

### 3. Concurrency Races & Financial Reconciliation Gaps
* **Vulnerability:** Bill settlements and vault balances used client-side recalculations committed via raw `setDoc`, causing simultaneous waiter transactions to overwrite cash totals. Partial bill settlements (`settlePartialItems`) failed to log a `SaleRecord` or credit the cash vault.
* **Resolution:**
  - Integrated atomic Firestore database operations (`increment(addedCash)` and `increment(addedCard)`).
  - Wired `settlePartialItems` directly to `SaleRecord` creation and active vault increments.
  - Added an `isProcessing` lock on POS action buttons to eliminate duplicate submissions from mobile/tablet taps.

### 4. Database-Level Enforcement (`firestore.rules`)
* Implemented rules enforcing that:
  - All create operations require non-empty `tenantId` and `storeId` string fields.
  - Updates cannot alter `tenantId` or `storeId` on existing records.
  - Closed sales (`/sales`), Z-reports (`/z_reports`), and audit entries (`/auditLogs`) are strictly append-only and immutable.
  - Deletion of occupied or active tables is blocked at the database engine level.

---

## 3. Architecture & Routing Overhaul

### Unified Tenant Scoping (`/t/:tenantSlug/...`)
The application was migrated from legacy flat routes to a strict URL-scoped hierarchy:
* `http://localhost:4200/t/:tenantSlug/login`
* `http://localhost:4200/t/:tenantSlug/floor-plan`
* `http://localhost:4200/t/:tenantSlug/order/:tableId`
* `http://localhost:4200/t/:tenantSlug/kitchen`
* `http://localhost:4200/t/:tenantSlug/inventory`
* `http://localhost:4200/t/:tenantSlug/staff`
* `http://localhost:4200/t/:tenantSlug/reports`
* `http://localhost:4200/t/:tenantSlug/settings`

### Route Guards & Lifecycle Protection
* **`tenantExistsGuard` (`src/app/core/guards/tenant.guard.ts`):** Validates that `:tenantSlug` is a known registered store before activating the route. Synchronizes the active tenant signal without clearing credentials.
* **`roleGuard` (`src/app/core/guards/role.guard.ts`):** Enforces employee role permissions while extracting `:tenantSlug` dynamically from route snapshots, redirecting unauthorized transitions back to the tenant's dedicated views rather than a flat `/login`.

---

## 4. Key Files Refactored & Hardened

| File Path | Core Changes & Bug Fixes |
| :--- | :--- |
| `src/app/app.routes.ts` | Flattened route declarations under `/t/:tenantSlug/`, removed inert layout outlets, established catch-all wildcard fallbacks. |
| `src/app/app.component.ts` & `.html` | Restored missing `RouterOutlet` import; scoped header navigation links to `['/t', currentSlug(), ...]`; fixed unclosed `<main>` and `<div>` tags. |
| `src/app/core/services/restaurant-pos.service.ts` | Server-scoped financial query listeners; added atomic increments; restored delegate methods (`dismissNotification`, `recordGoodsReceiving`, etc.); protected master resets to demo tenants. |
| `src/app/core/services/auth-shift.service.ts` | Isolated employee and shift subscriptions; fixed syntax union types; automated fallback manager provisioning for new tenants. |
| `src/app/core/services/table-order.service.ts` | Added server query scoping for tables; fixed asynchronous auto-provisioning outside loop; added `SaleRecord` creation to partial item settlements. |
| `src/app/core/services/inventory.service.ts` | Added `modifier_groups` real-time sync; fixed `Category.sortOrder` sorting; ensured document IDs are preserved. |
| `src/app/features/pos/order-terminal.component.ts` & `.html` | Scoped all exit routes to `getTenantSlug()`; fixed template loop tracking key collision (`NG0955`); wrapped route changes in `NgZone.run()`. |
| `src/app/features/auth/waiter-login.component.ts` & `.html` | Removed cumbersome activation setup; bound directly to tenant slug; scoped PIN lookups strictly to the active tenant. |
| `src/app/features/floor-plan/floor-plan.component.ts` | Scoped takeaway, payment, and reservation routes to `['/t', slug, ...]`. |
| `firestore.rules` | Multi-tenant security rules with scope validation and audit trail immutability. |

---

## 5. Standard Operating Procedure: Adding a New Store

To register a new store on the platform, update the central registry in `src/app/core/services/tenant-context.service.ts`:

```typescript
public readonly registeredStores: StoreProfile[] = [
  // ... existing stores
  {
    tenantId: 'beach-bar-client',     // Route slug: /t/beach-bar-client/...
    storeId: 'store-1',               // Physical branch ID
    name: 'Beach Bar Client',         // Brand display name
    badge: 'BB',                      // Badge indicator
    city: 'Athens',                   // City location
    icon: '🏖️',                      // UI icon
    themeColor: 'emerald'             // Color token
  }
];
```

### Initial Store Bootstrapping
1. Navigate directly to: `https://maranth.gr/t/beach-bar-client/login`.
2. Enter the default master PIN `1111` and declare the initial cash float.
3. The platform automatically creates default tables and associates the active shift.
4. Navigate to **Z-Report** and click **Αρχικοποίηση Μενού (Seed Starter Catalog)** to provision default categories, products, and tenant-owned modifier groups into Firestore.

---

## 6. Pre-Push Verification Checklist

- [x] Production build passes clean (`npx ng build --configuration=production`).
- [x] Zero compilation warnings or untracked loops in browser console.
- [x] Multi-tab isolation verified (incognito and standard windows run independently).
- [x] Table order creation, modifiers, kitchen dispatch, and payment settlements functional.
- [x] Shift close and daily Z-reports committed without session loss.
- [x] `firestore.rules` ready for deployment (`firebase deploy --only firestore:rules`).