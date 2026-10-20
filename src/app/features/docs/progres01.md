# Multi-Tenant POS Stabilization & Security Audit Progress Report
**System:** Maranth.gr Estiasi POS  
**Primary Goal:** Fix critical data isolation bugs, resolve compilation blockers, and secure multi-tenant operational boundaries.

---

## 1. Recap of What We Fixed So Far

### 1. Hard Firestore Data Leakage Neutralized (Server-Side Query Scoping)
* **The Vulnerability:** `onSnapshot(collection(this.db, 'sales'))`, `shifts`, `vaults`, `employees`, and `z_reports` were executing blanket collection reads across the entire database, downloading competing restaurants' private financial records and staff lists into browser memory before filtering in JavaScript.
* **The Fix:** Replaced all root collection subscriptions in `AuthShiftService` and `RestaurantPosService` with Firestore server-side queries (`query(..., where('tenantId', '==', tenantId), where('storeId', '==', storeId))`). The client's network tab now only receives data belonging to the active tenant.

### 2. Cash Reconciliation & Shift Close Integrity
* **The Vulnerability:** Vault closure matched identities using fuzzy logic (`includes(pin)` or employee name substrings), allowing one waiter's shift close to tamper with another waiter's active cash drawer. Calculations (`variance`, `expectedCash`) were calculated client-side and committed directly.
* **The Fix:** Enforced strict equality (`waiterId === currentEmp.id`). Replaced local addition overrides on cash collections with atomic Firestore operations (`increment(addedCash)` and `increment(addedCard)`) to prevent concurrent order settlement race conditions.

### 3. POS Terminal State Hardening (`order-terminal.component.ts`)
* **The Vulnerability:** Manual URL tampering (`/order-terminal/:tableId`) could bind the UI to tables belonging to other stores or tenants. Table transfers did not verify target table tenancy.
* **The Fix:** 
  - Added strict tenant validation on `activeTable`. If a table doesn't match `tenantContext.currentTenantId()`, navigation is aborted back to `/floor-plan`.
  - Scoped `availableTransferTables` exclusively to tables matching the active tenant and store.
  - Implemented an `isProcessing` concurrency lock to eliminate double-tap bugs on kitchen dispatch, bill settlement, and table transfers.

### 4. Codebase Compilation & Interface Harmony
* Restored all delegate methods across `RestaurantPosService` (`dismissNotification`, `recordGoodsReceiving`, `logSpoilage`, `addCategory`, `addProduct`, `updateTable`, `bumpOrderItemStatus`, etc.) matching the signatures required by `InventoryManagementComponent`, `KdsDisplayComponent`, `ShiftReportsComponent`, and `StaffManagementComponent`.
* Corrected broken TypeScript union types (`Employee | null`) and sanitized property access on `SaleRecord`.

---

## 2. The Core Problem Ahead: Safe & Fully Separated Tenant Login

Right now, the application relies on an insecure initial entry point:
- `localStorage.getItem('active_tenant_id')` or default fallback `'tirane-kafe-1974'`.
- Any user who modifies `localStorage` or types another tenant ID can change the context before entering a PIN.
- PIN codes are stored in plaintext in the Firestore `employees` documents. Anyone with DevTools can read the active tenant's staff PINs from memory.

---

## 3. Options for Multi-Tenant Entry & Separation

Here are the practical architectural options for Maranth.gr:

| Model | Implementation | Security Level | Operational Complexity | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: URL Subdomain Routing** | `kafe1974.maranth.gr`<br>`beachbar.maranth.gr` | **High** | Requires DNS wildcard (`*.maranth.gr`) and SSL handling. | Best for white-label SaaS, but more deployment setup. |
| **Option B: Path-Based Routing with Guards** | `maranth.gr/t/:tenantSlug/login`<br>`maranth.gr/t/:tenantSlug/pos` | **High** | Uses standard Angular routing + `tenant.guard.ts`. | **Recommended:** Easy to implement, works with existing single-domain hosting. |
| **Option C: Unified Terminal Code / Global PIN Auth** | `maranth.gr/login`<br>(Enters 6-digit Terminal Key first, then Staff PIN) | **High** | Stores terminal key in `indexedDB`/`localStorage` once per physical tablet. | Best for fixed cash register tablets where staff never touch URLs. |

---

## 4. Next Priorities (Tomorrow's Agenda)

1. **Implement Option B or C for Tenant Login:** Establish the authoritative entry mechanism so tenant context is never guessable or switchable by unauthorized staff.
2. **Review & Audit `table-order.service.ts`:**
   - Inspect order creation, item addition, modifiers, and table merging.
   - Verify real-time listeners for active tables and kitchen orders are strictly scoped.
3. **Automated Unit & Integration Tests:**
   - Test `TenantContextService` to guarantee invalid slugs or cross-tenant storage inputs are rejected.
   - Test `AuthShiftService` and `RestaurantPosService` to verify Firestore query isolation and atomic increment logic.
4. **Firestore Security Rules (`firestore.rules`):**
   - Translate our client-side protections into database security rules so unauthorized operations are blocked at the database engine level, even if someone runs scripts from the browser console.