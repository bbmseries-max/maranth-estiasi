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

  // 1. Check in-memory state first
  let emp: Employee | null = authShiftService.currentEmployee() || posService.currentEmployee();

  // 2. Fallback to tab-isolated sessionStorage, then localStorage
  if (!emp) {
    try {
      const savedEmp = 
        sessionStorage.getItem('current_employee') || 
        localStorage.getItem('current_employee') || 
        localStorage.getItem('maranth_pos_employee');

      if (savedEmp) {
        const parsed: Employee = JSON.parse(savedEmp);
        emp = parsed;
        authShiftService.currentEmployee.set(emp);
        posService.currentEmployee.set(emp);
      }
    } catch {
      emp = null;
    }
  }

  // 3. If still no active user, send to login
  if (!emp) {
    return router.createUrlTree(['/login']);
  }

  let userRole = String(emp.role || '').toUpperCase().trim();
  if (userRole === 'BAR' || userRole === 'BARMAN') userRole = 'BARISTA';
  if (userRole === 'CHEF') userRole = 'KITCHEN';

  // 4. Managers have global access
  if (['ADMIN', 'MANAGER', 'OWNER'].includes(userRole)) {
    return true;
  }

  // 5. Check allowed roles for route
  const allowedRoles = (route.data?.['roles'] as string[] | undefined)?.map(r => r.toUpperCase().trim()) || [];
  
  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  // 6. Access Denied: redirect to the employee's default view
  if (userRole === 'KITCHEN' || userRole === 'BARISTA') {
    return router.createUrlTree(['/kitchen']);
  }
  
  return router.createUrlTree(['/floor-plan']);
};