export * from './index';

export interface WorkShiftLog {
  id: string;
  employeeId: string;
  employeeName: string;
  tenantId?: string;  // 👈 Multi-tenant company isolation
  storeId?: string;   // 👈 Multi-store branch isolation
  clockInTime: string;
  clockOutTime?: string;
  status: 'WORKING' | 'COMPLETED';
  notes?: string;
  hourlyRateAtShift?: number;
}