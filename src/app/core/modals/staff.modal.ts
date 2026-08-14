// src/app/core/modals/staff.modal.ts

import { Role } from './common.modal';

export interface Employee {
  id: string;
  name: string;
  pin: string;               // Primary PIN
  pinCode?: string;          // Optional alias for legacy forms
  role: Role;
  hourlyRate: number;
  isActive: boolean;
  active?: boolean;          // Optional alias for legacy templates

  // Multi-tenancy & Location
  tenantId?: string;         // 👈 Optional for safe migration
  storeId?: string;          // 👈 Optional for safe migration

  // Metadata & Biometrics
  createdAt?: string;
  biometricPublicKey?: string;
}