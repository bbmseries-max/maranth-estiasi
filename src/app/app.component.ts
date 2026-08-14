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

    // 1. Confirm clock-out intent
    const confirmed = confirm(`Είστε σίγουρος ότι θέλετε να κλείσετε τη βάρδια σας και να αποσυνδεθείτε;`);
    if (!confirmed) return;

    try {
      // 2. Check if the staff member has an open cash vault drawer
      const activeVaults = this.posService.activeVaultSessions();
      const myOpenVault = activeVaults.find(
        v => (v.waiterId === current.id || v.waiterId === current.pin || v.waiterName === current.name) && v.status === 'OPEN'
      );

      if (myOpenVault) {
        const expectedCash = (myOpenVault.startingCash || 0) + (myOpenVault.cashCollected || 0);
        const cashHandedStr = prompt(
          `👛 Κλείσιμο Ταμείου (${current.name})\n` +
          `Αναμενόμενα Μετρητά: €${expectedCash.toFixed(2)}\n\n` +
          `Εισάγετε το ποσό μετρητών προς παράδοση:`,
          expectedCash.toFixed(2)
        );

        if (cashHandedStr !== null) {
          const cashHanded = parseFloat(cashHandedStr) || 0;
          await this.posService.closeWaiterVaultSession({
            ...myOpenVault,
            cashHandedOver: cashHanded,
            cashVariance: Number((cashHanded - expectedCash).toFixed(2))
          });
        }
      }

      // 3. Clock out the employee shift in Firestore & local state
      await this.authShiftService.clockOutEmployeeShift(current.id, `Έξοδος υπαλλήλου (${current.name})`);

      // 4. Log out and return to the PIN login screen
      this.authShiftService.logoutEmployee();

    } catch (error) {
      console.error('Error during endMyShift:', error);
      alert('Παρουσιάστηκε σφάλμα κατά το κλείσιμο της βάρδιας. Παρακαλώ δοκιμάστε ξανά.');
    }
  }
}