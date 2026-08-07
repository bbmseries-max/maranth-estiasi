import { Component, Input, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// 🎯 Adjusted relative paths to point to core
import { RestaurantPosService } from '../../../../core/services/restaurant-pos.service';
import { WaiterVaultSession } from '../../../../core/models/restaurant-pos.models';
import { ThermalPrinterService } from '../../../../core/services/thermal-printer.service';

@Component({
  selector: 'app-waiter-vault-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiter-vault-modal.component.html',
  styleUrls: ['./waiter-vault-modal.component.scss']
})
export class WaiterVaultModalComponent {
  // ... rest of component code remains the same
private posService = inject(RestaurantPosService);
private printerService = inject(ThermalPrinterService);

  @Input() session: WaiterVaultSession | null = null;
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() vaultClosed = new EventEmitter<WaiterVaultSession>();

  // State Signals
  public cashHandedOver = signal<number | null>(null);
  public notes = signal<string>('');

  // Computations
  public expectedCash = computed(() => {
    if (!this.session) return 0;
    return (this.session.startingFloat || 0) + (this.session.cashCollected || 0);
  });

  public variance = computed(() => {
    const actual = this.cashHandedOver() ?? 0;
    return Number((actual - this.expectedCash()).toFixed(2));
  });

  public addDenomination(amount: number): void {
    const current = this.cashHandedOver() ?? 0;
    this.cashHandedOver.set(Number((current + amount).toFixed(2)));
  }

  public resetCount(): void {
    this.cashHandedOver.set(null);
  }

  public submitVaultClosure(): void {
  if (!this.session) return;

  const actualCash = this.cashHandedOver() ?? 0;
  const closedSession: WaiterVaultSession = {
    ...this.session,
    closedAt: new Date().toISOString(),
    expectedCash: this.expectedCash(),
    cashHandedOver: actualCash,
    cashVariance: this.variance(),
    notes: this.notes().trim(),
    status: 'CLOSED'
  };

  // 1. Trigger Thermal Printer
  this.printerService.printVaultReceipt(closedSession, actualCash);

  // 2. Save Session & Emit Event
  this.posService.closeWaiterVaultSession(closedSession);
  this.vaultClosed.emit(closedSession);
  this.onClose();
}

  public onClose(): void {
    this.cashHandedOver.set(null);
    this.notes.set('');
    this.closeModal.emit();
  }
}