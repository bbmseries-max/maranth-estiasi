// src/app/core/guards/role.guard.ts

import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { RestaurantPosService } from '../services/restaurant-pos.service';
import { AuthShiftService } from '../services/auth-shift.service';
import { TenantContextService } from '../services/tenant-context.service';
import { Employee } from '../modals';

function resolveTenantSlug(route: ActivatedRouteSnapshot, fallback: string): string {
  let curr: ActivatedRouteSnapshot | null = route;
  while (curr) {
    const slug = curr.paramMap.get('tenantSlug');
    if (slug) return slug;
    curr = curr.parent;
  }
  return fallback;
}

export const roleGuard: CanActivateFn = (route, state) => {
  const posService = inject(RestaurantPosService);
  const authShiftService = inject(AuthShiftService);
  const tenantContext = inject(TenantContextService);
  const router = inject(Router);

  const activeSlug = resolveTenantSlug(route, tenantContext.currentTenantId() || 'coffee-shop-demo');

  // 1. Get current employee from memory
  let emp: Employee | null = authShiftService.currentEmployee() || posService.currentEmployee();

  // 2. Restore from local storage if memory was cleared on page reload
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

  // 3. Not logged in -> redirect strictly to the tenant's login view
  if (!emp) {
    return router.createUrlTree(['/t', activeSlug, 'login']);
  }

  // 4. Cross-tenant mismatch defense: employee belongs to store A but navigated to store B
  if (emp.tenantId && emp.tenantId !== activeSlug) {
    console.warn(`[Security] Employee tenant (${emp.tenantId}) does not match route (${activeSlug}).`);
    authShiftService.logoutEmployee();
    return router.createUrlTree(['/t', activeSlug, 'login']);
  }

  let userRole = String(emp.role || '').toUpperCase().trim();
  if (userRole === 'BAR' || userRole === 'BARMAN') userRole = 'BARISTA';
  if (userRole === 'CHEF') userRole = 'KITCHEN';

  // 5. Managers/Admins/Owners have universal access
  if (['ADMIN', 'MANAGER', 'OWNER'].includes(userRole)) {
    return true;
  }

  // 6. Check route allowed roles
  const allowedRoles = (route.data?.['roles'] as string[] | undefined)?.map(r => r.toUpperCase().trim()) || [];
  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return true;
  }

  // 7. Role mismatch -> send to tenant-scoped default area
  if (userRole === 'KITCHEN' || userRole === 'BARISTA') {
    return router.createUrlTree(['/t', activeSlug, 'kitchen']);
  }
  return router.createUrlTree(['/t', activeSlug, 'floor-plan']);
};