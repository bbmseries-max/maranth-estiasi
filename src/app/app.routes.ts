// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { pendingOrderGuard } from './core/guards/pending-order.guard';
import { roleGuard } from './core/guards/role.guard';
import { tenantExistsGuard } from './core/guards/tenant.guard';

export const routes: Routes = [
  // 1. Root redirect defaults to demo tenant
  
  
  { 
    path: '', 
    pathMatch: 'full',
    redirectTo: 't/coffee-shop-demo/login'
  },

  // 2. Tenant Direct Routes (No nested router-outlet required)
  {
    path: 't/:tenantSlug/login',
    canActivate: [tenantExistsGuard],
    loadComponent: () => import('./features/auth/waiter-login.component')
      .then(m => m.WaiterLoginComponent),
    title: 'Maranth Estiasi - Είσοδος'
  },
  {
    path: 't/:tenantSlug/floor-plan',
    canActivate: [tenantExistsGuard, roleGuard],
    loadComponent: () => import('./features/floor-plan/floor-plan.component')
      .then(m => m.FloorPlanComponent),
    data: { roles: ['BARISTA', 'MANAGER', 'ADMIN', 'OWNER', 'WAITER', 'HEAD_WAITER'] },
    title: 'Maranth Estiasi - Πλάνο Τραπεζιών'
  },
  {
    path: 't/:tenantSlug/order/:tableId',
    canActivate: [tenantExistsGuard, roleGuard],
    canDeactivate: [pendingOrderGuard],
    loadComponent: () => import('./features/pos/order-terminal.component')
      .then(m => m.OrderTerminalComponent),
    data: { roles: ['MANAGER', 'BARISTA', 'ADMIN', 'OWNER', 'WAITER', 'HEAD_WAITER'] },
    title: 'Maranth Estiasi - Παραγγελιοληψία'
  },
  {
    path: 't/:tenantSlug/kitchen',
    canActivate: [tenantExistsGuard, roleGuard],
    loadComponent: () => import('./features/kitchen/kds-display.component')
      .then(m => m.KdsDisplayComponent),
    data: { roles: ['BAR', 'BARISTA', 'MANAGER', 'ADMIN', 'OWNER', 'KITCHEN'] },
    title: 'Maranth Estiasi - Οθόνη Κουζίνας & Bar'
  },
  {
    path: 't/:tenantSlug/inventory',
    canActivate: [tenantExistsGuard, roleGuard],
    loadComponent: () => import('./features/inventory/inventory-management.component')
      .then(m => m.InventoryManagementComponent),
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER'] },
    title: 'Maranth Estiasi - Αποθήκη & Τιμοκατάλογος'
  },
  {
    path: 't/:tenantSlug/staff',
    canActivate: [tenantExistsGuard, roleGuard],
    loadComponent: () => import('./features/staff/staff-management.component')
      .then(m => m.StaffManagementComponent),
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER'] },
    title: 'Maranth Estiasi - Προσωπικό'
  },
  {
    path: 't/:tenantSlug/reports',
    canActivate: [tenantExistsGuard, roleGuard],
    loadComponent: () => import('./features/reports/shift-reports.component')
      .then(m => m.ShiftReportsComponent),
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER'] },
    title: 'Maranth Estiasi - Z-Report'
  },
  {
    path: 't/:tenantSlug/settings',
    canActivate: [tenantExistsGuard, roleGuard],
    loadComponent: () => import('./features/settings/settings.component')
      .then(m => m.SettingsComponent),
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER'] },
    title: 'Maranth Estiasi - Settings'
  },

  // 3. Fallback for root /login or unknown paths
  {
    path: 'login',
    redirectTo: 't/coffee-shop-demo/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 't/coffee-shop-demo/login'
  }
];