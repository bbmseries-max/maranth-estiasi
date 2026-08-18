// src/app/features/floor-plan/floor-plan.component.ts

import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VaultClosureModalComponent } from '../staff/components/vault-closure-modal/vault-closure-modal.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { RestaurantTable, WaiterVaultSession } from '../../core/modals/restaurant-pos.modals';

export type TableVisualStatus = 'FREE' | 'PENDING' | 'PREPARING' | 'READY_TO_SERVE' | 'BILL_PRINTED' | 'RESERVED';

@Component({
  selector: 'app-floor-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, VaultClosureModalComponent],
  templateUrl: `./floor-plan.component.html`
})
export class FloorPlanComponent {
  public posService = inject(RestaurantPosService);
  private router = inject(Router);

  public closingVault = signal<WaiterVaultSession | null>(null);
  public selectedZone = signal<string>('ALL');
  public selectingVaultForSettlement = signal<{ tableId: string; method: 'CASH' | 'CARD' } | null>(null);

  public filteredTables = computed(() => {
    const all = this.posService.tables().filter(t => t.id !== 'takeaway-counter' && t.zone !== 'Takeaway');
    const zone = this.selectedZone();

    const result = zone === 'ALL' 
      ? all 
      : all.filter(t => (t.zone === zone || t.section === zone));

    return this.sortTables(result);
  });

  public onTableSelect(table: RestaurantTable, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    if (!table || !table.id) return;

    this.router.navigate(['/order', table.id]);
  }

  public openTakeaway(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    let takeawayTable = this.posService.tables().find(t => t.id === 'takeaway-counter');
    if (!takeawayTable) {
      takeawayTable = {
        id: 'takeaway-counter',
        number: '99',
        tableNumber: '99',
        name: '🛍️ Takeaway / Πακέτο',
        seats: 1,
        capacity: 1,
        section: 'BAR',
        zone: 'Takeaway',
        status: 'FREE',
        currentTotal: 0
      };
    }
    this.router.navigate(['/order', takeawayTable.id]);
  }

  public handleManagerSettlement(tableId: string, method: 'CASH' | 'CARD', event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    const activeVaults = this.posService.activeVaultSessions();

    if (activeVaults.length === 0) {
      alert('Δεν υπάρχει ενεργό ταμείο σερβιτόρου.');
      return;
    }

    if (activeVaults.length === 1) {
      this.posService.settleTablePayment(tableId, method, activeVaults[0].id);
      return;
    }

    this.selectingVaultForSettlement.set({ tableId, method });
  }

  public confirmVaultSelection(vaultId: string): void {
    const target = this.selectingVaultForSettlement();
    if (target) {
      this.posService.settleTablePayment(target.tableId, target.method, vaultId);
      this.selectingVaultForSettlement.set(null);
    }
  }

  public isTableReady(table: RestaurantTable): boolean {
    const notifications = this.posService.unreadReadyNotifications();
    return notifications.some(n => n.tableId === table.id);
  }

  public getTableVisualStatus(table: RestaurantTable): TableVisualStatus {
    if (this.isTableReady(table)) {
      return 'READY_TO_SERVE';
    }

    if (table.status === 'RESERVED') {
      return 'RESERVED';
    }

    if (!table.status || table.status === 'FREE' || table.status === 'AVAILABLE' || !table.activeOrder) {
      return 'FREE';
    }

    if (table.status === 'BILL_PRINTED') {
      return 'BILL_PRINTED';
    }

    const items = (table.activeOrder.items || []).filter(i => (i as any).status !== 'VOIDED');
    if (items.length === 0) {
      return 'FREE';
    }

    const statuses = items.map(i => i.status);

    if (statuses.includes('PREPARING') || statuses.includes('SENT_TO_KITCHEN')) {
      return 'PREPARING';
    }

    if (statuses.every(s => s === 'SERVED')) {
      return 'READY_TO_SERVE';
    }

    return 'PENDING';
  }

  public getTableCardBorderClass(table: RestaurantTable): string {
    const visualStatus = this.getTableVisualStatus(table);

    switch (visualStatus) {
      case 'RESERVED':
        return 'border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.25)] bg-purple-950/20';
      case 'READY_TO_SERVE':
        return 'border-emerald-500 shadow-[0_0_15px_rgba(160,185,129,0.3)] bg-emerald-950/20';
      case 'PREPARING':
        return 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-amber-950/20';
      case 'BILL_PRINTED':
        return 'border-sky-400/80 hover:border-sky-400 bg-sky-950/20';
      case 'PENDING':
        return 'border-red-500/50 hover:border-red-500/90 bg-red-950/20';
      case 'FREE':
      default:
        return 'border-slate-800 hover:border-emerald-500/50';
    }
  }

  public async processPayment(tableId: string, method: 'CASH' | 'CARD', event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    const table = this.posService.tables().find(t => t.id === tableId);
    const activeOrder = table?.activeOrder;

    if (activeOrder && activeOrder.items) {
      const unsentItems = activeOrder.items.filter(item => item.status === 'PENDING');
      if (unsentItems.length > 0) {
        alert(`⚠️ Υπάρχουν ${unsentItems.length} εκκρεμή προϊόντα που δεν έχουν σταλεί στην κουζίνα!`);
        return;
      }
    }

    const currentEmp = this.posService.currentEmployee();
    const myVault = this.posService.activeVaultSession();
    const activeVaults = this.posService.activeVaultSessions();
    const isManagerRole = ['MANAGER', 'ADMIN', 'OWNER'].includes(String(currentEmp?.role || '').toUpperCase());

    if (!myVault && isManagerRole && activeVaults.length > 0) {
      const selectedVaultId = this.promptSelectActiveWaiterVault(activeVaults);
      if (selectedVaultId) {
        await this.posService.settleTablePayment(tableId, method, selectedVaultId);
        this.router.navigate(['/floor-plan'], { replaceUrl: true });
      }
      return;
    }

    await this.posService.settleTablePayment(tableId, method);
    this.router.navigate(['/floor-plan'], { replaceUrl: true });
  }

  private promptSelectActiveWaiterVault(activeVaults: WaiterVaultSession[]): string | null {
    if (!activeVaults || activeVaults.length === 0) {
      alert('Δεν υπάρχει ενεργό ταμείο σερβιτόρου.');
      return null;
    }

    if (activeVaults.length === 1) {
      return activeVaults[0].id;
    }

    const vaultListText = activeVaults
      .map((v, index) => `${index + 1}. ${v.waiterName} (€${(v.cashCollected || 0).toFixed(2)})`)
      .join('\n');

    const input = prompt(`Επιλέξτε Ταμείο:\n\n${vaultListText}\n\nΑριθμός (1-${activeVaults.length}):`);
    if (input !== null) {
      const selectedIndex = parseInt(input.trim(), 10) - 1;
      if (!isNaN(selectedIndex) && activeVaults[selectedIndex]) {
        return activeVaults[selectedIndex].id;
      }
    }

    return null;
  }

  public openVaultClosure(vault: WaiterVaultSession, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    this.closingVault.set(vault);
  }

  public handleShiftClosure(event: { vaultId: string; countedCash: number; discrepancy: number }): void {
    const currentVault = this.closingVault();

    if (currentVault) {
      const updatedVault: WaiterVaultSession = {
        ...currentVault,
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        cashHandedOver: event.countedCash,
        cashVariance: event.discrepancy
      };

      this.posService.closeWaiterVaultSession(updatedVault);
    }

    this.closingVault.set(null);
  }

  public async openReservationPrompt(table: RestaurantTable, event?: Event): Promise<void> {
    if (event) event.stopPropagation();

    const customerName = prompt(`📅 Κράτηση για Τραπέζι ${table.number || table.tableNumber}\n\nΌνομα Πελάτη:`);
    if (!customerName?.trim()) return;

    const time = prompt('Ώρα κράτησης (π.χ. 21:00):', '20:30') || '20:30';
    const partySizeStr = prompt('Αριθμός ατόμων:', String(table.seats || table.capacity || 4));
    const phone = prompt('Τηλέφωνο επικοινωνίας (προαιρετικό):', '') || undefined;

    const reservationInfo = {
      customerName: customerName.trim(),
      reservationTime: time.trim(),
      partySize: parseInt(partySizeStr || '4', 10) || 4,
      phone: phone?.trim()
    };

    if (this.posService.reserveTable) {
      await this.posService.reserveTable(table.id, reservationInfo);
    }
  }

  public async cancelReservation(table: RestaurantTable, event?: Event): Promise<void> {
    if (event) event.stopPropagation();

    const confirmed = confirm(`Ακύρωση κράτησης για το Τραπέζι ${table.number || table.tableNumber} (${table.reservation?.customerName || ''});`);
    if (!confirmed) return;

    if (this.posService.cancelReservation) {
      await this.posService.cancelReservation(table.id);
    }
  }

  public seatReservedTable(table: RestaurantTable, event?: Event): void {
    if (event) event.stopPropagation();
    this.router.navigate(['/order', table.id]);
  }

  public sortTables(tables: RestaurantTable[]): RestaurantTable[] {
    return [...tables].sort((a, b) => {
      const valA = String(a.tableNumber ?? a.number ?? '');
      const valB = String(b.tableNumber ?? b.number ?? '');
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
}