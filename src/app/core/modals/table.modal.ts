// src/app/core/modals/table.modal.ts

import { ActiveOrder } from './order.modal';

export interface Table {
  id: string;
  tenantId?: string;             // 👈 Added for multi-tenancy
  storeId?: string;              // 👈 Optional for safe migrations
  number: number;
  tableNumber?: number;          // Compatibility alias
  name?: string;
  seats: number;
  capacity?: number;             // Compatibility alias
  section?: 'INDOOR' | 'OUTDOOR' | 'BAR' | 'TAKEAWAY' | 'VIP';
  zone?: string;
  status: 'FREE' | 'AVAILABLE' | 'OCCUPIED' | 'BILL_PRINTED';
  currentTotal: number;
  activeOrder?: ActiveOrder;
  activeOrderId?: string;
  waiterId?: string;
  waiterName?: string;
  assignedWaiterId?: string;     // Compatibility alias
  assignedWaiterName?: string;   // Compatibility alias
}

export type RestaurantTable = Table;