# Changelog & Guide: Multi-Tenant Architecture & Store Provisioning
**Project:** Maranth.gr Estiasi POS  
**Domain:** Bar / Cafe / Restaurant Multi-Tenant POS Platform  
**Target Architecture:** URL Path-Scoped Multi-Tenancy (`/t/:tenantSlug/...`) with Guard Isolation

---

## 1. Summary of Recent Core Fixes

### A. Root Routing & Layout Resilience
* **Fixed Router Deadlock:** Restored `RouterOutlet` in `AppComponent.imports` and closed truncated `<main>` template tags in `src/app/app.component.html`.
* **Flattened Tenant Routes:** Simplified `src/app/app.routes.ts` by using direct child paths (`t/:tenantSlug/login`, `t/:tenantSlug/floor-plan`, `t/:tenantSlug/order/:tableId`, etc.) without requiring dummy wrapper layout components.
* **Header & Navigation Isolation:** Replaced legacy flat routes (`/floor-plan`, `/kitchen`, `/reports`, `/inventory`) in `app.component.html` with reactive, tenant-aware paths (`['/t', currentSlug(), 'floor-plan']`), preventing unwanted session dropouts when switching views.

### B. POS Terminal Workflow Hardening
* **Exit Route Normalization:** Updated `settlePayment()`, `confirmTableTransfer()`, and `settleSplitItems()` in `order-terminal.component.ts` to navigate via `['/t', slug, ...]` inside `NgZone.run()`.
* **Atomic Financial Settle:** Connected partial split payments (`settlePartialItems`) directly to vault increments and audit logs in `restaurant-pos.service.ts` so revenue from split bills is not lost.
* **Template Tracking Fix (NG0955):** Fixed duplicated key errors in `order-terminal.component.html` by replacing `track mod.name` with `track (mod.id || mod.optionId || mod.name || $index)`.

### C. Database Query Boundary
* **Server-Side Firestore Scoping:** Replaced root `collection(db, ...)` subscriptions across `tables`, `orders`, `sales`, `vaults`, `shifts`, and `auditLogs` with explicit parameter queries:
  ```typescript
  query(
    collection(this.db, colName),
    where('tenantId', '==', tenantId),
    where('storeId', '==', storeId)
  )
  Step 1.
  File: src/app/core/services/tenant-context.service.ts

Add your new store definition to the registeredStores array:

TypeScript
public readonly registeredStores: StoreProfile[] = [
  // Existing stores...
  {
    tenantId: 'beach-bar-test',       // Unique URL slug (kebab-case)
    storeId: 'store-1',               // Store / branch identifier
    name: 'Beach Bar Test',           // Display name
    badge: 'BB',                      // 2-letter badge
    city: 'Athens',                   // Location
    icon: '🏖️',                      // Emoji / visual icon
    themeColor: 'emerald'             // Theme token
  }
];

Step 2: Register Terminal License Key
File: src/app/core/services/device-pairing.service.ts

Add an activation record to predefinedLicenses to allow terminal pairing:

TypeScript
public readonly predefinedLicenses: Record<string, DeviceLicense> = {
  // Existing licenses...
  'BB-2026': {
    licenseKey: 'BB-2026',
    tenantId: 'beach-bar-test',
    storeId: 'store-1',
    storeName: 'Beach Bar Test',
    storeIcon: '🏖️',
    city: 'Athens',
    status: 'ACTIVE'
  }
};
Step 3: Configure Initial Staff Access
File: src/app/core/services/auth-shift.service.ts

Ensure normalizeKey is defined at the top of the file:

TypeScript
function normalizeKey(val?: string | null): string {
  if (!val) return '';
  return String(val).trim().toLowerCase().replace(/[\s_-]+/g, '');
}
Verify that default fallback credentials exist in getInitialStoreEmployees():

TypeScript
public getInitialStoreEmployees(tenantId: string, storeId: string): Employee[] {
  // Demo branch logic...
  return [
    { 
      id: `emp_${normalizeKey(tenantId)}_1111`, 
      name: 'Manager Test (1111)', 
      pin: '1111', 
      pinCode: '1111', 
      role: 'MANAGER', 
      hourlyRate: 10.0, 
      isActive: true, 
      active: true, 
      tenantId, 
      storeId 
    }
  ];
}