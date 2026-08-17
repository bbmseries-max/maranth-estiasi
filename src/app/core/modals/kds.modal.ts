// src/app/core/models/kds.model.ts

import { ItemPreparationStatus } from './order.modal';

export type { ItemPreparationStatus }; // Re-export the shared type
export type KdsOrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export interface KdsOrderItem {
  id: string;
  storeId?: string;
  tenantId?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  finalItemPrice?: number;
  status?: ItemPreparationStatus;
  modifiers?: any[];
  notes?: string;
  itemNotes?: string;
  kitchenStation?: 'KITCHEN' | 'BAR';
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string | Date;
}

export interface KdsOrder {
  id: string;
  storeId?: string;
  tenantId?: string;
  orderId?: string;
  tableNumber: string | Number;
  waiterName: string;
  createdAt: string | Date;
  status: KdsOrderStatus;
  items: KdsOrderItem[];
  isCancelled?: boolean;
  cancelReason?: string;
  isAcknowledged?: boolean;
}