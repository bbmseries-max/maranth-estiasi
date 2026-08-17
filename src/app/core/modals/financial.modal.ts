// src/app/core/modals/financial.modal.ts

import { TableOrderItem } from './order.modal';
import { WorkShiftLog } from './shift.modal';

export interface WaiterVaultSession {
  id: string;
  tenantId?: string;
  storeId?: string;
  shiftLogId: string;
  waiterId: string;
  waiterName: string;
  openedAt: string;
  closedAt?: string;
  startingFloat: number;
  cashCollected: number;
  cardCollected: number;
  startingCash?: number;
  expectedCash?: number;
  cashHandedOver?: number;
  cashVariance?: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface AuditLog {
  id: string;
  tenantId?: string;
  storeId?: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  action: string;
  tableNumber?: string | number;
  details: string;
}

export interface DailyZReportSnapshot {
  id: string;
  tenantId?: string;
  storeId?: string;
  dateStr: string;
  timestamp: string;
  closedByEmployeeId: string;
  closedByEmployeeName: string;
  totalCash: number;
  totalCard: number;
  totalGrossRevenue: number;
  net13: number;
  vat13: number;
  net24: number;
  vat24: number;
  totalNetRevenue: number;
  totalVatLiability: number;
}

export interface SaleRecord {
  id: string;
  tenantId?: string;
  storeId?: string;
  orderId: string;
  tableId: string;
  tableNumber: number;
  waiterId: string;
  waiterName: string;
  paymentMethod: 'CASH' | 'CARD' | 'DEBT';
  items: TableOrderItem[];
  subtotalNet: number;
  totalTax: number;
  grandTotal: number;
  timestamp: string;
  notes?: string;
}

export interface ReadyNotification {
  id: string;
  tenantId?: string;
  storeId: string;
  tableId: string;
  tableNumber: number;
  zone: string;
  itemSummary: string;
  readyAt: string;
}