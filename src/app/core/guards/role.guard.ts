// In src/app/core/guards/role.guard.ts

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { RestaurantPosService } from '../services/restaurant-pos.service';
import { AuthShiftService } from '../services/auth-shift.service';
import { Employee } from '../modals';

export const roleGuard: CanActivateFn = (route, state) => {
  const posService = inject(RestaurantPosService);
  const authShiftService = inject(AuthShiftService);
  const router = inject(Router);

  let emp: Employee | null = authShiftService.currentEmployee() || posService.currentEmployee();

  // If no in-memory employee, check localStorage
  if (!emp) {
    try {
      const savedEmp = localStorage.getItem('current_employee') || localStorage.getItem('maranth_pos_employee');
      if (savedEmp) {
        const parsed: Employee = JSON.parse(savedEmp);
        // Verify this employee actually has an active shift before hydrating
        const activeShift = authShiftService.getEmployeeActiveShift(parsed.id);
        const role = String(parsed.role || '').toUpperCase();
        const isManagement = ['MANAGER', 'ADMIN', 'OWNER'].includes(role);

        if (activeShift || isManagement) {
          emp = parsed;
          authShiftService.currentEmployee.set(emp);
          posService.currentEmployee.set(emp);
        } else {
          // Stale closed session: wipe storage and force login
          localStorage.removeItem('current_employee');
          localStorage.removeItem('maranth_pos_employee');
          return router.createUrlTree(['/login']);
        }
      }
    } catch (e) {
      emp = null;
    }
  }

  if (!emp) {
    return router.createUrlTree(['/login']);
  }

  let userRole = String(emp.role || '').toUpperCase().trim();
  if (userRole === 'BAR') userRole = 'BARISTA';
  if (userRole === 'CHEF') userRole = 'KITCHEN';

  if (['ADMIN', 'MANAGER', 'OWNER'].includes(userRole)) {
    return true;
  }

  const allowedRoles = (route.data?.['roles'] as string[] | undefined)?.map(r => r.toUpperCase().trim()) || [];
  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  return userRole === 'KITCHEN' ? router.createUrlTree(['/kitchen']) : router.createUrlTree(['/floor-plan']);
};