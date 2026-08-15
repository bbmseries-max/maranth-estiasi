import { Component, input, output, signal, computed, inject } from '@angular/core';
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

  // Modern Signal Inputs (Template binding [session]="..." and [isOpen]="..." stays identical)
  public session = input<WaiterVaultSession | null>(null);
  public isOpen = input<boolean>(false);

  // Modern Outputs
  public closeModal = output<void>();
  public vaultClosed = output<WaiterVaultSession>();

  // State Signals
  public cashHandedOver = signal<number | null>(null);
  public notes = signal<string>('');

  // Computations (Now fully reactive to session changes!)
  public expectedCash = computed(() => {
    const currentSession = this.session();
    if (!currentSession) return 0;
    const starting = currentSession.startingFloat || 0;
    const collected = currentSession.cashCollected || 0;
    return Number((starting + collected).toFixed(2));
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

  public async submitVaultClosure(): Promise<void> {
    const currentSession = this.session();
    if (!currentSession) return;

    const actualCash = this.cashHandedOver() ?? 0;
    const expected = this.expectedCash();
    const varAmount = Number((actualCash - expected).toFixed(2));

    const closedSession: WaiterVaultSession = {
      ...currentSession,
      closedAt: new Date().toISOString(),
      expectedCash: expected,
      cashHandedOver: actualCash,
      cashVariance: varAmount,
      notes: this.notes().trim(),
      status: 'CLOSED'
    };

    // 1. Safe Printer Trigger (Doesn't block close if printer is offline)
    try {
      if (this.printerService && typeof this.printerService.printVaultReceipt === 'function') {
        this.printerService.printVaultReceipt(closedSession, actualCash);
      }
    } catch (err) {
      console.warn('Printer offline or receipt print failed:', err);
    }

    // 2. Persist to Firestore once & emit notification to parent
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