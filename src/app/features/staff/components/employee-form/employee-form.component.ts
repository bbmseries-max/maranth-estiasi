// src/app/features/staff/components/employee-form/employee-form.component.ts

import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthShiftService } from '../../../../core/services/auth-shift.service';
import { Role } from '../../../../core/modals';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-form.component.html'
})
export class EmployeeFormComponent {
  private authShiftService = inject(AuthShiftService);

  // 👈 This lets the parent component know when to close the modal
  @Output() closeForm = new EventEmitter<void>();

  // Form State
  public name = signal<string>('');
  public pinCode = signal<string>('');
  public role = signal<Role>('WAITER');
  public hourlyRate = signal<number>(5.0);

  // UI Feedback
  public errorMessage = signal<string>('');
  public successMessage = signal<string>('');
  public isSubmitting = signal<boolean>(false);

  // Available Roles
  public availableRoles: { value: Role; label: string }[] = [
    { value: 'WAITER', label: 'Σερβιτόρος' },
    { value: 'MANAGER', label: 'Διαχειριστής' },
    { value: 'KITCHEN', label: 'Κουζίνα' },
    { value: 'BAR', label: 'Barista / Μπαρ' }
  ];

  public submitForm(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    // Basic frontend validation
    if (!this.name().trim()) {
      this.errorMessage.set('Παρακαλώ εισάγετε όνομα υπαλλήλου.');
      return;
    }
    
    if (this.pinCode().trim().length < 4) {
      this.errorMessage.set('Το PIN πρέπει να είναι τουλάχιστον 4 ψηφία.');
      return;
    }

    this.isSubmitting.set(true);

    // Call the synchronous service
    const result = this.authShiftService.addEmployee({
      name: this.name(),
      pinCode: this.pinCode(),
      role: this.role(),
      hourlyRate: this.hourlyRate()
    });

    this.isSubmitting.set(false);

    if (result.success) {
      this.successMessage.set(result.message);
      this.resetForm();
      
      // Close the form automatically after 1.5 seconds on success
      setTimeout(() => {
        this.closeForm.emit();
      }, 1500);
    } else {
      this.errorMessage.set(result.message);
    }
  }

  // 👈 Here is the missing cancel method!
  public cancel(): void {
    this.closeForm.emit();
  }

  private resetForm(): void {
    this.name.set('');
    this.pinCode.set('');
    this.role.set('WAITER');
    this.hourlyRate.set(5.0);
    
    // Clear success message after 3 seconds
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}