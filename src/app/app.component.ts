import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TenantContextService } from './core/services/tenant-context.service';
import { MenuSeederService } from './core/services/menu-seeder.service';
import { AutoLogoutService } from './core/services/auto-logout.service';
import { RestaurantPosService } from './core/services/restaurant-pos.service';
import { AuthShiftService } from './core/services/auth-shift.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive, SlicePipe],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private autoLogoutService = inject(AutoLogoutService);
  private seeder = inject(MenuSeederService);
  private router = inject(Router);
  public tenantContext = inject(TenantContextService);

  public posService = inject(RestaurantPosService);
  public authShiftService = inject(AuthShiftService);
  public isBellDrawerOpen = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    this.autoLogoutService.startMonitoring();
    await this.seeder.checkAndSeedDemoIfNeeded();
  }

  public currentSlug(): string {
  return this.tenantContext.currentTenantId() || 'coffee-shop-demo';
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
    if (!current?.id) return;

    const confirmed = confirm('Είστε σίγουρος ότι θέλετε να κλείσετε τη βάρδια σας και να αποσυνδεθείτε;');
    if (!confirmed) return;

    try {
      // Strict matching: Only match open vaults belonging to this employee and current tenant
      const activeVaults = this.posService.activeVaultSessions();
      const myOpenVault = activeVaults.find(
        v => v.waiterId === current.id && v.status === 'OPEN'
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
          'Εισάγετε το τελικό ποσό μετρητών προς παράδοση:',
          expectedCash.toFixed(2)
        );

        if (cashHandedStr === null) {
          return; // Explicit cancelation by user
        }

        const cashHanded = parseFloat(cashHandedStr);
        if (isNaN(cashHanded) || cashHanded < 0) {
          alert('Μη έγκυρο ποσό μετρητών.');
          return;
        }

        // Delegate final closing calculation to service (which must be backed by server-side verification)
        await this.posService.closeWaiterVaultSession({
          ...myOpenVault,
          closedAt: new Date().toISOString(),
          cashHandedOver: cashHanded
        });
      }

      await this.authShiftService.clockOutEmployeeShift(current.id, `Έξοδος υπαλλήλου (${current.name})`);
    } catch (error) {
      console.error('Error during shift teardown:', error);
      alert('Παρουσιάστηκε σφάλμα κατά το κλείσιμο της βάρδιας.');
      return;
    } finally {
      // Ensure logout occurs if shift operations succeeded or clean teardown is required
      this.posService.logoutEmployee();
      this.authShiftService.logoutEmployee();
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}