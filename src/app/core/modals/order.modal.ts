// src/app/core/modals/order.modal.ts

import { GreekVatRate } from './common.modal';
export type { SelectedModifier } from './modifier.modal';

export type ItemPreparationStatus = 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'SERVED' | 'VOIDED';
export type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'SERVED';

export interface OrderModifier {
  id?: string;
  name?: string;
  optionId?: string;
  optionName?: string;
  groupId?: string;
  groupName?: string;
  priceExtra?: number;
  price?: number;
}

export interface TableOrderItem {
  id: string;
  storeId?: string;
  tenantId?: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  taxRate: GreekVatRate;
  modifiers?: OrderModifier[];
  finalItemPrice: number;
  itemNotes?: string;
  orderedByWaiterId: string;
  orderedByWaiterName: string;
  timestamp: string;
  status: ItemPreparationStatus;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
}

export interface ActiveOrder {
  id?: string;
  storeId?: string;
  tenantId?: string;
  orderId: string;
  openedAt: string;
  tableNumber?: number;
  items: TableOrderItem[];
  subtotalNet: number;
  totalTax: number;
  grandTotal: number;
  notes?: string;
}