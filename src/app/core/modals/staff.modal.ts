// src/app/core/modals/staff.modal.ts

import { Role } from './common.modal';

export interface Employee {
  id: string;
  name: string;
  pin: string;                // Primary PIN
  pinCode?: string;           // Optional alias for legacy forms
  role: Role;
  hourlyRate: number;
  isActive: boolean;
  active?: boolean;           // Optional alias for legacy templates
  isClockedIn?: boolean;      // 👈 Added (used in shift tracking)
  activeShiftId?: string;     // 👈 Added (active shift ref)

  // Multi-tenancy & Location
  tenantId?: string;
  storeId?: string;

  // Metadata & Biometrics
  phone?: string;
  color?: string;
  notes?: string;
  createdAt?: string;
  biometricPublicKey?: string;
}