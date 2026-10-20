# Security & Bug Audit: WaiterLoginComponent
**Target File:** `src/app/features/auth/waiter-login.component.ts` (and template)  
**Root Cause of Freeze:** Router path mismatch (`/floor-plan` vs `/t/:tenantSlug/floor-plan`) + NgZone desync + `[(ngModel)]="licenseInput"` type clash with Angular signals.

---

## 1. Vulnerability & Bug Analysis

### Bug 1: Hardcoded Flat Route Trapped by Tenant Guard (Root Cause of Freeze)
* **Location:** `redirectByRole()`
  ```typescript
  this.router.navigate(['/floor-plan'], { replaceUrl: true });
  this.router.navigate(['/kitchen'], { replaceUrl: true });