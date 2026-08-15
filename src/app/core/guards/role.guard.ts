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

  // 1. Check in-memory signals
  let emp: Employee | null = authShiftService.currentEmployee() || posService.currentEmployee();

  // 2. Fallback: Restore from localStorage and fully re-hydrate session
  if (!emp) {
    try {
      const savedEmp = localStorage.getItem('current_employee') || localStorage.getItem('maranth_pos_employee');
      if (savedEmp) {
        emp = JSON.parse(savedEmp);
        if (emp) {
          posService.setLoggedInEmployee(emp);
        }
      }
    } catch (e) {
      console.error('Error parsing stored employee in roleGuard:', e);
      emp = null;
    }
  }

  // 3. No active session -> redirect to login
  if (!emp) {
    return router.createUrlTree(['/login']);
  }

  // 4. Normalize role
  let userRole = String(emp.role || '').toUpperCase().trim();
  if (userRole === 'BAR') userRole = 'BARISTA';
  if (userRole === 'CHEF') userRole = 'KITCHEN';

  // 5. Admin / Manager / Owner have full access
  if (['ADMIN', 'MANAGER', 'OWNER'].includes(userRole)) {
    return true;
  }

  // 6. Match allowed route roles
  const allowedRoles = (route.data?.['roles'] as string[] | undefined)?.map(r => r.toUpperCase().trim()) || [];
  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  // 7. Prevent infinite redirection loop if already on target route
  const currentPath = state.url;
  if (userRole === 'KITCHEN') {
    return currentPath === '/kitchen' ? true : router.createUrlTree(['/kitchen']);
  }

  return currentPath === '/floor-plan' ? true : router.createUrlTree(['/floor-plan']);
};