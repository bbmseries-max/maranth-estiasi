import { Routes } from '@angular/router';

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
    title: 'Maranth Estiasi - Είσοδος Σερβιτόρων'
  },
  {
    path: 'floor-plan',
    loadComponent: () => import('./features/floor-plan/floor-plan.component')
      .then(m => m.FloorPlanComponent),
    title: 'Maranth Estiasi - Πλάνο Τραπεζιών'
  },
  {
    path: 'order/:tableId',
    loadComponent: () => import('./features/pos/order-terminal.component')
      .then(m => m.OrderTerminalComponent),
    title: 'Maranth Estiasi - Παραγγελιοληψία'
  },
  {
    path: 'kitchen',
    loadComponent: () => import('./features/kitchen/kds-display.component')
      .then(m => m.KdsDisplayComponent),
    title: 'Maranth Estiasi - Οθόνη Κουζίνας & Bar'
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory-management.component')
      .then(m => m.InventoryManagementComponent),
    title: 'Maranth Estiasi - Αποθήκη & Παραλαβές'
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/shift-reports.component')
      .then(m => m.ShiftReportsComponent),
    title: 'Maranth Estiasi - Αναφορές & Z-Report'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];