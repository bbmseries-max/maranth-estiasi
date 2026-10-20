# POS Operational Resilience & Concurrency Architecture

### Fix 1: Touchscreen Gesture Route Protection (pendingOrderGuard)
- **Problem:** Accidental edge-swiping or browser-back navigation on mobile tablets dismissed open orders, silently discarding unsent items.
- **Solution:** Implemented `CanDeactivateFn` on `/order/:tableId`. It detects `hasPendingItems()` and halts navigation until the waiter explicitly dispatches or cancels.

### Fix 2: Atomic Concurrency & Double-Settlement Lock (runTransaction)
- **Problem:** Two waiters or cashiers settling the same table at the exact same millisecond generated duplicate sales records, corrupted cash vault totals, and double-deducted inventory.
- **Solution:** Encapsulated settlement inside an atomic Firestore `runTransaction()`. The table document is locked; once cleared, any concurrent attempt safely aborts with an `ALREADY_SETTLED` notification.

### Fix 3: Shift-Windowed Z-Report Aggregation (Midnight Crossing Safe)
- **Problem:** Calculating daily revenue via calendar date strings (`toLocaleDateString()`) broke late-night bars operating past midnight (00:00–04:00 AM), splitting shifts and misallocating tax liability across two separate dates.
- **Solution:** Anchored revenue and VAT calculation to the active business window (`timestamp > lastZReportTimestamp`). Printing a Z-report establishes an immutable boundary and resets the calculation window to zero.

### Fix 4: Real-Time Network & Offline Disconnect Guard
- **Problem:** Outdoor beach bar and patio tablets intermittently drop Wi-Fi, leaving staff unaware that kitchen tickets and payments failed to reach the server.
- **Solution:** Built a reactive `ConnectionStatusService` with immediate visual warning banners and defensive pre-flight guards on critical write operations (`sendOrder`, `settlePayment`).