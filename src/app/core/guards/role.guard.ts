// src/app/core/guards/role.guard.ts

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { RestaurantPosService } from '../services/restaurant-pos.service';
import { TenantContextService } from '../services/tenant-context.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const posService = inject(RestaurantPosService);
  const tenantContext = inject(TenantContextService);
  const router = inject(Router);

  // 1. Get employee from signal OR fallback to localStorage
  let emp = posService.currentEmployee();

  if (!emp) {
    try {
      const savedEmp = localStorage.getItem('current_employee') || localStorage.getItem('maranth_pos_employee');
      if (savedEmp) {
        emp = JSON.parse(savedEmp);
      }
    } catch (e) {
      // Ignore parse error
    }
  }

  // 2. If STILL no user logged in, redirect to PIN login
  if (!emp) {
    console.warn('roleGuard: No active employee session found. Redirecting to /login');
    return router.createUrlTree(['/login']);
  }

  // 3. Extract and normalize role
  const allowedRoles = (route.data?.['roles'] as string[] | undefined)?.map(r => r.toUpperCase()) || [];
  let userRole = (emp.role || '').toUpperCase();

  if (userRole === 'BAR') userRole = 'BARISTA';
  if (userRole === 'CHEF') userRole = 'KITCHEN';

  // 4. Managers, Admins, and Owners get universal access to ALL guarded routes
  if (['ADMIN', 'MANAGER', 'OWNER'].includes(userRole)) {
    return true;
  }

  // 5. Standard route role validation
  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  // 6. Kitchen-only staff redirects to /kitchen (KDS)
  if (userRole === 'KITCHEN') {
    return router.createUrlTree(['/kitchen']);
  }

  // 7. Default fallback for floor/counter staff (Waiters, Baristas, Cashiers)
  return router.createUrlTree(['/floor-plan']);
};