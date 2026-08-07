import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: 'login', 
    pathMatch: 'full' 
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/waiter-login.component')
      .then(m => m.WaiterLoginComponent),
    title: 'Maranth Estiasi - Είσοδος'
  },
  {
    path: 'floor-plan',
    loadComponent: () => import('./features/floor-plan/floor-plan.component')
      .then(m => m.FloorPlanComponent),
    canActivate: [roleGuard],
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER', 'WAITER', 'HEAD_WAITER'] },
    title: 'Maranth Estiasi - Πλάνο Τραπεζιών'
  },
  {
    path: 'order/:tableId',
    loadComponent: () => import('./features/pos/order-terminal.component')
      .then(m => m.OrderTerminalComponent),
    canActivate: [roleGuard],
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER', 'WAITER', 'HEAD_WAITER'] },
    title: 'Maranth Estiasi - Παραγγελιοληψία'
  },
  {
    path: 'kitchen',
    loadComponent: () => import('./features/kitchen/kds-display.component')
      .then(m => m.KdsDisplayComponent),
    canActivate: [roleGuard],
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER', 'BARISTA', 'KITCHEN'] },
    title: 'Maranth Estiasi - Οθόνη Κουζίνας & Bar'
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory-management.component')
      .then(m => m.InventoryManagementComponent),
    canActivate: [roleGuard],
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER'] },
    title: 'Maranth Estiasi - Αποθήκη & Τιμοκατάλογος'
  },
  {
    path: 'staff',
    loadComponent: () => import('./features/staff/staff-management.component').then(m => m.StaffManagementComponent)
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/shift-reports.component')
      .then(m => m.ShiftReportsComponent),
    canActivate: [roleGuard],
    data: { roles: ['MANAGER', 'ADMIN', 'OWNER'] },
    title: 'Maranth Estiasi - Z-Report'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];