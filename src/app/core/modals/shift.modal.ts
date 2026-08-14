// src/app/core/modals/shift.modal.ts

export type ShiftStatus = 'WORKING' | 'COMPLETED' ;

export interface WorkShiftLog {
  id: string;
  tenantId?: string;
  storeId?: string;
  employeeId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string;
  hourlyRateAtShift?: number;
  totalHoursWorked?: number;
  earnedAmount?: number;
  status: ShiftStatus;
  notes?: string;
}

// 👈 Single reference alias: Shift and WorkShiftLog are now identical
export type Shift = WorkShiftLog;