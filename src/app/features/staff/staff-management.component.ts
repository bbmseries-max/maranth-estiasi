import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthShiftService } from '../../core/services/auth-shift.service';
import { EmployeeFormComponent } from './components/employee-form/employee-form.component';
import { FormsModule } from '@angular/forms';
import { Employee, Role, WaiterVaultSession } from '../../core/modals/restaurant-pos.modals';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { WaiterVaultModalComponent } from './components/waiter-vault-modal/waiter-vault-modal.component';

@Component({
  selector: 'app-staff-management',
  standalone: true,
  imports: [
    CommonModule,
    EmployeeFormComponent,
    FormsModule, 
    WaiterVaultModalComponent
  ],
  templateUrl: './staff-management.component.html'
})
export class StaffManagementComponent {
  public posService = inject(RestaurantPosService);
  public authShiftService = inject(AuthShiftService);

  public showAddForm = signal<boolean>(false);
  public selectedEmployee = signal<Employee | null>(null);
  public showAddModal = signal<boolean>(false);
  public isRegisteringBiometrics = signal<boolean>(false);

  public isVaultModalOpen = signal<boolean>(false);
  public activeVaultSessionForModal = signal<WaiterVaultSession | null>(null);

  public newEmpName = '';
  public newEmpPin = '';
  public newEmpRole: Role = 'WAITER';
  public newEmpRate = 7.0;

  public openNewEmployeeForm(): void {
    this.showAddForm.set(true);
  }

  public hideNewEmployeeForm(): void {
    this.showAddForm.set(false);
  }

  public selectEmployee(emp: Employee): void {
    this.selectedEmployee.set(emp);
  }

  public toggleStatus(emp: Employee): void {
    const currentActive = emp.isActive ?? emp.active ?? true;
    this.posService.toggleEmployeeActiveStatus(emp.id, !currentActive);
    
    this.selectedEmployee.set({
      ...emp,
      isActive: !currentActive,
      active: !currentActive
    });
  }

  public async onRegisterFingerprint(emp: Employee | null): Promise<void> {
    if (!emp) return;

    this.isRegisteringBiometrics.set(true);

    try {
      const result = await this.posService.registerEmployeeBiometrics(emp);
      alert(result.message);

      if (result.success) {
        const updated = this.posService.employees().find(e => e.id === emp.id);
        if (updated) {
          this.selectedEmployee.set({ ...updated });
        }
      }
    } catch {
      alert('Αποτυχία καταχώρησης αποτυπώματος.');
    } finally {
      this.isRegisteringBiometrics.set(false);
    }
  }

  public openAddModal(): void {
    this.newEmpName = '';
    this.newEmpPin = '';
    this.newEmpRole = 'WAITER';
    this.newEmpRate = 7.0;
    this.showAddModal.set(true);
  }

  public saveNewEmployee(): void {
    const cleanPin = this.newEmpPin.trim();
    if (!this.newEmpName.trim() || cleanPin.length < 4) {
      alert('Παρακαλώ συμπληρώστε όνομα και PIN (τουλάχιστον 4 ψηφία).');
      return;
    }

    const res = this.posService.addEmployee({
      name: this.newEmpName.trim(),
      pinCode: cleanPin,
      role: this.newEmpRole,
      hourlyRate: Number(this.newEmpRate) || 7.0
    });

    if (res.success && res.employee) {
      this.showAddModal.set(false);
      this.selectedEmployee.set(res.employee);
    } else {
      alert(res.message);
    }
  }

  public openVaultModalForEmployee(employee: Employee): void {
    const allSessions = this.posService.activeVaultSessions() || [];
    
    let session = allSessions.find(
      s => (
        s.waiterId === employee.id || 
        s.waiterId === employee.pin || 
        s.waiterName === employee.name ||
        (s.waiterId && employee.pin && s.waiterId.includes(employee.pin))
      ) && s.status === 'OPEN'
    );

    if (!session) {
      session = {
        id: `VAULT-${employee.id}-${Date.now()}`,
        tenantId: employee.tenantId || 'Tirane kafe 1974',
        storeId: employee.storeId || 'store-2',
        shiftLogId: `SHIFT-${employee.id}-${Date.now()}`,
        waiterId: employee.id,
        waiterName: employee.name,
        openedAt: new Date().toISOString(),
        startingFloat: 0.00,
        cashCollected: 0.00,
        cardCollected: 0.00,
        status: 'OPEN'
      };
    }

    this.activeVaultSessionForModal.set(session);
    this.isVaultModalOpen.set(true);
  }

  public handleCloseVaultModal(): void {
    this.isVaultModalOpen.set(false);
    this.activeVaultSessionForModal.set(null);
  }

 public handleVaultClosed(closedSession: WaiterVaultSession): void {
  console.log('Vault session closed:', closedSession.id);
  this.handleCloseVaultModal();
}
}