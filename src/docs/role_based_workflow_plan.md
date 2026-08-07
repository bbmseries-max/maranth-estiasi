🏛️ Role-Based Architecture & Station Workflow Plan (Option 1 - Simplified)

This document defines the strict Role-Based Access Control (RBAC) boundaries for Maranth Estiasi POS. Enforcing these boundaries ensures that staff members only interact with tools relevant to their station, keeping the workflow fast and eliminating code complexity.

👥 Station Roles & Access Matrix

Role Identifier

Greek Label

Station / Default View

Permitted Routes

Forbidden Routes

MANAGER / ADMIN / OWNER

Manager / Ιδιοκτήτης

Floor Plan (/floor-plan)

All Routes (/floor-plan, /order/:id, /kitchen, /inventory, /reports)

None

WAITER / HEAD_WAITER

Σερβιτόρος

Floor Plan (/floor-plan)

/floor-plan, /order/:id

/kitchen, /inventory, /reports

BARISTA

Μπαρίστα / Bar

Bar Display (/kitchen)

/kitchen

/floor-plan, /order/:id, /inventory, /reports

KITCHEN

Κουζίνα / Chef

Kitchen Display (/kitchen)

/kitchen

/floor-plan, /order/:id, /inventory, /reports

🛠️ Station Behavioral Rules

1. Waiter Station (WAITER / HEAD_WAITER - PIN 2222)

Default View: Floor Plan (/floor-plan).

Capabilities: Open tables, add items, select coffee/drink modifiers, fire tickets to Kitchen/Bar (/kitchen), print temporary bill, settle payments (Cash/Card).

Notifications: Receives non-blocking floating alerts and glowing table badges when Chef or Barman marks an item as "Ready" (✓ Έτοιμο).

Restrictions: Cannot open KDS, view management reports, change prices, or edit inventory.

2. Barman Station (BARISTA - PIN 3333)

Default View: KDS Display (/kitchen) filtered to Bar & Beverages only.

Capabilities: View incoming beverage orders, start preparation, bump drink items to "Ready" (✓ Έτοιμο).

Restrictions: Hides food items. Restricted to /kitchen. All orders for bar guests are entered by Waiters.

3. Kitchen / Chef Station (KITCHEN - PIN 4444)

Default View: KDS Display (/kitchen) filtered to Kitchen & Food only.

Capabilities: View incoming food tickets, track prep times, bump dishes to "Ready" (✓ Έτοιμο).

Restrictions: Hides drink items. Strictly locked to /kitchen. No access to tables or payments.

4. Manager Station (MANAGER - PIN 1111)

Default View: Floor Plan (/floor-plan).

Capabilities: Full system authority. Can switch between Floor Plan, KDS Display, Goods Receiving, Menu Management, Staff PIN setup, and Shift Z-Reports.