import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { AutoLogoutService } from './core/services/auto-logout.service';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { RestaurantPosService } from './core/services/restaurant-pos.service';
import { EmployeeRole } from './core/models/restaurant-pos.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, SlicePipe],
  templateUrl: './app.component.html'
})
export class AppComponent {
private autoLogoutService = inject(AutoLogoutService);

  ngOnInit(): void {
    // Start bulletproof inactivity monitoring globally
    this.autoLogoutService.startMonitoring();
  }


  public posService = inject(RestaurantPosService);
  public isBellDrawerOpen = signal<boolean>(false);

  public canAccessFloorPlan(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return ['MANAGER', 'ADMIN', 'OWNER', 'WAITER', 'HEAD_WAITER'].includes(r);
  }

  public canAccessKitchen(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    // 👈 Added CHEF and BARMAN here
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
    // 👈 Added CHEF and BARMAN here
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
}