// src/app/core/guards/role.guard.ts

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { RestaurantPosService } from '../services/restaurant-pos.service';
import { AuthShiftService } from '../services/auth-shift.service';
import { Employee } from '../modals';

export const roleGuard: CanActivateFn = (route, state) => {
  const posService = inject(RestaurantPosService);
  const authShiftService = inject(AuthShiftService);
  const router = inject(Router);

  // 1. Get current employee from memory
  let emp: Employee | null = authShiftService.currentEmployee() || posService.currentEmployee();

  // 2. If memory is empty on fresh page reload, restore from local storage
  if (!emp) {
    try {
      const savedEmp = localStorage.getItem('current_employee') || localStorage.getItem('maranth_pos_employee');
      if (savedEmp) {
        emp = JSON.parse(savedEmp);
        authShiftService.currentEmployee.set(emp);
        posService.currentEmployee.set(emp);
      }
    } catch {
      emp = null;
    }
  }

  // 3. Not logged in -> strictly redirect to /login
  if (!emp) {
    return router.createUrlTree(['/login']);
  }

  let userRole = String(emp.role || '').toUpperCase().trim();
  if (userRole === 'BAR' || userRole === 'BARMAN') userRole = 'BARISTA';
  if (userRole === 'CHEF') userRole = 'KITCHEN';

  // 4. Managers have universal access across all routes
  if (['ADMIN', 'MANAGER', 'OWNER'].includes(userRole)) {
    return true;
  }

  // 5. Check route allowed roles
  const allowedRoles = (route.data?.['roles'] as string[] | undefined)?.map(r => r.toUpperCase().trim()) || [];
  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  // 6. Role mismatch: send to default allowed area (never hijack Manager)
  if (userRole === 'KITCHEN' || userRole === 'BARISTA') {
    return router.createUrlTree(['/kitchen']);
  }
  return router.createUrlTree(['/floor-plan']);
};