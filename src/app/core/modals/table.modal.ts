// src/app/core/modals/table.modal.ts

import { ActiveOrder } from './order.modal';

export interface TableReservationInfo {
  customerName: string;
  phone?: string;
  reservationTime: string; // e.g. "20:30"
  partySize: number;
  notes?: string;
}

export type TableStatus = 'FREE' | 'AVAILABLE' | 'OCCUPIED' | 'BILL_PRINTED' | 'RESERVED';

export interface Table {
  id: string;
  tenantId?: string;             // 👈 Added for multi-tenancy
  storeId?: string;              // 👈 Optional for safe migrations
  number: number;
  tableNumber?: number;          // Compatibility alias
  name?: string;
  seats: number;
  reservation?: TableReservationInfo;
  capacity?: number;             // Compatibility alias
  section?: 'INDOOR' | 'OUTDOOR' | 'BAR' | 'TAKEAWAY' | 'VIP';
  zone?: string;
  status: TableStatus;
  currentTotal: number;
  activeOrder?: ActiveOrder;
  activeOrderId?: string;
  waiterId?: string;
  waiterName?: string;
  assignedWaiterId?: string;     // Compatibility alias
  assignedWaiterName?: string;   // Compatibility alias
}

export type RestaurantTable = Table;