import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { RestaurantPosService } from '../services/restaurant-pos.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const posService = inject(RestaurantPosService);
  const router = inject(Router);

  const emp = posService.currentEmployee();

  // 1. If no user is logged in, redirect to PIN login screen
  if (!emp) {
    return router.createUrlTree(['/login']);
  }

  // 2. Case-insensitive role matching
  const allowedRoles = (route.data?.['roles'] as string[] | undefined)?.map(r => r.toUpperCase()) || [];
  const userRole = (emp.role || '').toUpperCase();

  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  // 3. If unauthorized, redirect to the station default
  if (userRole === 'KITCHEN' || userRole === 'BARISTA') {
    return router.createUrlTree(['/kitchen']);
  }

  return router.createUrlTree(['/floor-plan']);
};