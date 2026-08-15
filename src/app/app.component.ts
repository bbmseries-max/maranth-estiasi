import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { WaiterVaultSession } from './core/modals';
import { MenuSeederService } from './core/services/menu-seeder.service';
import { AutoLogoutService } from './core/services/auto-logout.service';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
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
  private router = inject(Router);

  public posService = inject(RestaurantPosService);
  public authShiftService = inject(AuthShiftService);
  public isBellDrawerOpen = signal<boolean>(false);

  async ngOnInit() {
    // 1. Start inactivity monitoring
    this.autoLogoutService.startMonitoring();

    // 2. Safe demo seed check (read-only for production tenant)
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
        v => (
          v.waiterId === current.id || 
          v.waiterId === current.pin || 
          v.waiterName === current.name ||
          (v.waiterId && current.pin && v.waiterId.includes(current.pin))
        ) && v.status === 'OPEN'
      );

      if (myOpenVault) {
        const startingFloat = myOpenVault.startingFloat || 0;
        const cashCollected = myOpenVault.cashCollected || 0;
        const expectedCash = Number((startingFloat + cashCollected).toFixed(2));

        const cashHandedStr = prompt(
          `👛 Κλείσιμο Ταμείου (${current.name})\n` +
          `Αρχικό Ταμείο: €${startingFloat.toFixed(2)}\n` +
          `Εισπράξεις Μετρητών: €${cashCollected.toFixed(2)}\n` +
          `Αναμενόμενα Μετρητά: €${expectedCash.toFixed(2)}\n\n` +
          `Εισάγετε το τελικό ποσό μετρητών προς παράδοση:`,
          expectedCash.toFixed(2)
        );

        // If employee cancels the prompt, abort the entire shift close
        if (cashHandedStr === null) {
          return;
        }

        const cashHanded = parseFloat(cashHandedStr) || 0;
        const variance = Number((cashHanded - expectedCash).toFixed(2));

        const closedVault: WaiterVaultSession = {
          ...myOpenVault,
          closedAt: new Date().toISOString(),
          expectedCash,
          cashHandedOver: cashHanded,
          cashVariance: variance,
          status: 'CLOSED'
        };

        await this.posService.closeWaiterVaultSession(closedVault);
      }

      // 3. Clock out the employee shift in Firestore & local state
      await this.authShiftService.clockOutEmployeeShift(current.id, `Έξοδος υπαλλήλου (${current.name})`);

      // 4. Log out cleanly across both services and return to login
      this.posService.logoutEmployee();
      this.authShiftService.logoutEmployee();
      this.router.navigate(['/login'], { replaceUrl: true });

    } catch (error) {
      console.error('Error during endMyShift:', error);
      alert('Παρουσιάστηκε σφάλμα κατά το κλείσιμο της βάρδιας. Παρακαλώ δοκιμάστε ξανά.');
    }
  }
}