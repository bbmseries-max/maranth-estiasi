// src/app/core/services/shift.service.ts

import { Injectable, computed, inject } from '@angular/core';
import { AuthShiftService } from './auth-shift.service';
import { Shift } from '../modals';

@Injectable({ providedIn: 'root' })
export class ShiftService {
  private authShiftService = inject(AuthShiftService);

  // 1. Direct pass-through signal from AuthShiftService (Single Source of Truth)
  public allShifts = this.authShiftService.workShifts;

  // 2. Active multi-tenancy context
  public activeTenantId = this.authShiftService.activeTenantId;
  public activeStoreId = this.authShiftService.activeStoreId;

  // 3. Multi-Store isolated shift list
  public storeShifts = computed(() => {
    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();

    return this.allShifts().filter(shift => 
      (!shift.tenantId || shift.tenantId === tenantId) &&
      (!shift.storeId || shift.storeId === storeId)
    );
  });

  // 4. Current employee active shift (checks status === 'WORKING')
  public currentEmployeeShift = computed(() => {
    const emp = this.authShiftService.currentEmployee();
    if (!emp) return null;

    return this.storeShifts().find(
      shift => shift.employeeId === emp.id && shift.status === 'WORKING'
    ) ?? null;
  });

  public hasActiveShift = computed(() => this.currentEmployeeShift() !== null);
}