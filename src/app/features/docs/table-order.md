# Security & Architecture Audit Report: Table Order Service
**Target File:** `src/app/core/services/table-order.service.ts`  
**Classification:** Critical Multi-Tenant Leakage, Financial Partial Settlement Audit Holes, and Order Concurrency Flaws

---

## 1. Vulnerability & Risk Analysis

### Finding 1: Unscoped `onSnapshot(collection(this.db, 'tables'))` (Severity: CRITICAL)
* **Location:** `TableOrderService.initFirestoreSync()`:
  ```typescript
  this.activeTablesUnsub = onSnapshot(collection(this.db, 'tables'), async (snap) => { ... });