// src/app/core/guards/pending-order.guard.ts

import { CanDeactivateFn } from '@angular/router';
import { OrderTerminalComponent } from '../../features/pos/order-terminal.component';

export const pendingOrderGuard: CanDeactivateFn<OrderTerminalComponent> = (component) => {
  // If the terminal currently has unsent kitchen items
  if (component.hasPendingItems()) {
    return confirm(
      '⚠️ Υπάρχουν προϊόντα στην παραγγελία που ΔΕΝ έχουν σταλεί στην κουζίνα!\n\nΕίστε σίγουροι ότι θέλετε να αποχωρήσετε;'
    );
  }
  return true;
};