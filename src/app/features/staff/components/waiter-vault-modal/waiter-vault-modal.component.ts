// src/app/features/staff/components/waiter-vault-modal/waiter-vault-modal.component.ts

import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RestaurantPosService } from '../../../../core/services/restaurant-pos.service';
import { WaiterVaultSession } from '../../../../core/modals/restaurant-pos.modals';
import { ThermalPrinterService } from '../../../../core/services/thermal-printer.service';

@Component({
  selector: 'app-waiter-vault-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiter-vault-modal.component.html',
  styleUrls: ['./waiter-vault-modal.component.scss']
})
export class WaiterVaultModalComponent {
  private posService = inject(RestaurantPosService);
  private printerService = inject(ThermalPrinterService);

  @Input() session: WaiterVaultSession | null = null;
  @Input() isOpen: boolean = false;

  @Output() closeModal = new EventEmitter<void>();
  @Output() vaultClosed = new EventEmitter<WaiterVaultSession>();

  // State Signals
  public cashHandedOver = signal<number | null>(null);
  public notes = signal<string>('');

  // Getter computations for reliable recalculation in HTML templates
  public get expectedCash(): number {
    if (!this.session) return 0;
    const starting = this.session.startingFloat || 0;
    const collected = this.session.cashCollected || 0;
    return Number((starting + collected).toFixed(2));
  }

  public get variance(): number {
    const actual = this.cashHandedOver() ?? 0;
    return Number((actual - this.expectedCash).toFixed(2));
  }

  public addDenomination(amount: number): void {
    const current = this.cashHandedOver() ?? 0;
    this.cashHandedOver.set(Number((current + amount).toFixed(2)));
  }

  public resetCount(): void {
    this.cashHandedOver.set(null);
  }

  public async submitVaultClosure(): Promise<void> {
    if (!this.session) return;

    const actualCash = this.cashHandedOver() ?? 0;
    const expected = this.expectedCash;
    const varAmount = Number((actualCash - expected).toFixed(2));

    const closedSession: WaiterVaultSession = {
      ...this.session,
      closedAt: new Date().toISOString(),
      expectedCash: expected,
      cashHandedOver: actualCash,
      cashVariance: varAmount,
      notes: this.notes().trim(),
      status: 'CLOSED'
    };

    try {
      if (this.printerService && typeof this.printerService.printVaultReceipt === 'function') {
        this.printerService.printVaultReceipt(closedSession, actualCash);
      }
    } catch (err) {
      console.warn('Printer offline or receipt print failed:', err);
    }

    try {
      await this.posService.closeWaiterVaultSession(closedSession);
    } catch (err) {
      console.error('Error closing vault session:', err);
    }

    this.vaultClosed.emit(closedSession);
    this.onClose();
  }

  public onClose(): void {
    this.cashHandedOver.set(null);
    this.notes.set('');
    this.closeModal.emit();
  }
}