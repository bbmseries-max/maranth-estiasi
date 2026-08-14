import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { MenuService } from './core/services/menu.service';
import { TenantContextService } from './core/services/tenant-context.service';
import { MenuSeederService } from './core/services/menu-seeder.service';
import { AutoLogoutService } from './core/services/auto-logout.service';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { RestaurantPosService } from './core/services/restaurant-pos.service';
import { AuthShiftService } from './core/services/auth-shift.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, SlicePipe],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private autoLogoutService = inject(AutoLogoutService);
  private seeder = inject(MenuSeederService);
  private tenantContext = inject(TenantContextService);
  private menuService = inject(MenuService);

  public posService = inject(RestaurantPosService);
  public authShiftService = inject(AuthShiftService);
  public isBellDrawerOpen = signal<boolean>(false);

  async ngOnInit() {
    // 1. Start bulletproof inactivity monitoring globally
    this.autoLogoutService.startMonitoring();

    // 2. 🔒 Only seed if in demo mode, NEVER force override active tenant context
    this.seeder.checkAndSeedDemoIfNeeded();
  }

  public canAccessFloorPlan(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return ['MANAGER', 'ADMIN', 'OWNER', 'WAITER', 'HEAD_WAITER'].includes(r);
  }

  public canAccessKitchen(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return ['MANAGER', 'ADMIN', 'OWNER', 'BARISTA', 'KITCHEN', 'CHEF', 'BARMAN'].includes(r);
  }

  public canAccessManagement(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return ['MANAGER', 'ADMIN', 'OWNER'].includes(r);
  }

  public isKitchenOnly(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return ['BARISTA', 'KITCHEN', 'CHEF', 'BARMAN'].includes(r);
  }

  public getRoleBadgeLabel(role?: string): string {
    if (!role) return '';
    const r = role.toUpperCase();
    switch (r) {
      case 'MANAGER':
      case 'ADMIN':
      case 'OWNER': return 'Manager';
      case 'WAITER':
      case 'HEAD_WAITER': return 'Σερβιτόρος';
      case 'BARISTA':
      case 'BARMAN': return 'Barista';
      case 'KITCHEN':
      case 'CHEF': return 'Κουζίνα';
      default: return role;
    }
  }

  public async endMyShift(): Promise<void> {
    const current = this.authShiftService.currentEmployee();
    if (!current) return;

    if (confirm(`Είστε σίγουρος ότι θέλετε να κλείσετε τη βάρδια σας και να αποσυνδεθείτε;`)) {
      await this.authShiftService.clockOutEmployeeShift(current.id, `Έξοδος υπαλλήλου (${current.name})`);
      this.authShiftService.logoutEmployee();
    }
  }
}