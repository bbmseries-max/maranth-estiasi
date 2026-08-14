// src/app/core/models/inventory.modal.ts

import { UnitOfMeasure } from './common.modal';

export interface RawMaterial {
  id: string;
  storeId?: string;
  tenantId?: string;
  name: string;
  unit: UnitOfMeasure;
  currentStock: number;
  minAlertStock: number;
  costPerUnit: number;
}

export interface SpoilageLog {
  id: string;
  storeId?: string;
  tenantId?: string;
  itemId: string;
  itemName: string;
  quantityWasted: number;
  unit: UnitOfMeasure;
  costLossNet: number;
  reason: string;
  loggedByEmployeeId: string;
  loggedByEmployeeName: string;
  timestamp: string;
}