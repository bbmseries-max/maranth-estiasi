import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthShiftService } from '../../core/services/auth-shift.service';
import { RouterLink } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { DailyZReportSnapshot } from '../../core/modals/restaurant-pos.modals';
import { ThermalPrinterService } from '../../core/services/thermal-printer.service';
import { 
  AuditLog, 
  WorkShiftLog, 
  WaiterVaultSession,
  Employee 
} from '../../core/modals/restaurant-pos.modals';

@Component({
  selector: 'app-shift-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: `./shift-reports.component.html`
})
export class ShiftReportsComponent implements OnInit, OnDestroy {
  public authShiftService = inject(AuthShiftService);
  public posService = inject(RestaurantPosService);
  private printerService = inject(ThermalPrinterService);
  private cdr = inject(ChangeDetectorRef);

  public activeTab = signal<'Z_REPORT' | 'VAULTS' | 'AUDIT'>('Z_REPORT');
  public closingVault = signal<WaiterVaultSession | null>(null);
  public actualHandedCash: number = 0;
  public now = signal<number>(Date.now());

  // 🔒 Direct computed signals to guarantee OnPush view reactivity
  public activeVaults = computed(() => this.posService.activeVaultSessions());
  public employeesList = computed(() => this.posService.employees());
  public workShiftsList = computed(() => this.posService.workShifts());
  public zReportsList = computed(() => this.posService.zReports());
  public auditLogsList = computed(() => this.posService.auditLogs());
  public vatData = computed(() => this.posService.vatBreakdown());
  public liveFloorRevenue = computed(() => this.posService.totalLiveFloorRevenue());
  public occupiedTablesCount = computed(() => this.posService.occupiedTables().length);
  public totalCashInVaults = computed(() => this.posService.totalDailyCashInVaults());
  public totalCardInVaults = computed(() => this.posService.totalDailyCardInVaults());
  public totalStartingFloats = computed(() => this.posService.totalDailyStartingFloats());
  public totalGrossSales = computed(() => this.posService.totalDailyGrossSales());

  private timerInterval: any;

  ngOnInit(): void {
    const currentEmp = this.posService.currentEmployee();
    if (currentEmp) {
      // Re-trigger live store sync to attach listeners for Tirane kafe 1974
      this.posService.reconnectActiveStoreSync(currentEmp);
    }

    this.timerInterval = setInterval(() => {
      this.now.set(Date.now());
      this.cdr.markForCheck();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  public getShiftForEmployee(empId: string): WorkShiftLog | undefined {
    return this.posService.getEmployeeActiveShift(empId);
  }

  public calculateShiftHours(activeShift: WorkShiftLog | undefined | null): number {
    if (!activeShift || !activeShift.clockInTime) {
      return 0;
    }

    const startMs = new Date(activeShift.clockInTime).getTime();
    const endMs = activeShift.clockOutTime 
      ? new Date(activeShift.clockOutTime).getTime() 
      : Date.now();

    const diffMs = endMs - startMs;
    if (diffMs <= 0) return 0;

    return diffMs / (1000 * 60 * 60);
  }

  public promptEditStartingFloat(vault: WaiterVaultSession): void {
    const input = prompt(`Αλλαγή Αρχικού Ταμείου / Ρέστα για ${vault.waiterName} (€):`, vault.startingFloat.toString());
    if (input !== null) {
      const parsed = parseFloat(input);
      if (!isNaN(parsed) && parsed >= 0) {
        this.posService.updateWaiterVaultFloat(vault.id, parsed);
        this.cdr.markForCheck();
      }
    }
  }

  public openCloseVaultModal(vault: WaiterVaultSession): void {
    this.closingVault.set(vault);
    this.actualHandedCash = Number((vault.startingFloat + vault.cashCollected).toFixed(2));
    this.cdr.markForCheck();
  }

  public confirmVaultClose(vault: WaiterVaultSession): void {
    const expected = Number((vault.startingFloat + vault.cashCollected).toFixed(2));
    const count = Number(this.actualHandedCash) || 0;
    const variance = Number((count - expected).toFixed(2));

    // 1. Print Receipt
    this.printVaultReceipt(vault, count);

    // 2. Delegate Vault Close & Employee Clock-Out to POS Service
    const closedVault: WaiterVaultSession = {
      ...vault,
      closedAt: new Date().toISOString(),
      expectedCash: expected,
      cashHandedOver: count,
      cashVariance: variance,
      status: 'CLOSED'
    };

    this.posService.closeWaiterVaultSession(closedVault);

    // 3. Close Modal & force view update
    this.closingVault.set(null);
    this.cdr.markForCheck();
  }

  public closeBusinessDay(): void {
    if (confirm('Είστε βέβαιοι για το Κλείσιμο Ημέρας; Θα δημιουργηθεί μόνιμο snapshot Z-Report.')) {
      const snapshot = this.posService.closeDayAndGenerateZReport();
      this.printSnapshotZReport(snapshot);
      this.cdr.markForCheck();
    }
  }

  public printCurrentZReport(): void {
    const vat = this.posService.vatBreakdown();
    const snapshot: DailyZReportSnapshot = {
      id: `Z-LIVE-${Date.now()}`,
      dateStr: new Date().toLocaleDateString('el-GR'),
      timestamp: new Date().toISOString(),
      closedByEmployeeId: this.posService.currentEmployee()?.id || 'MANAGER',
      closedByEmployeeName: this.posService.currentEmployee()?.name || 'Manager',
      totalCash: this.posService.totalDailyCashInVaults(),
      totalCard: this.posService.totalDailyCardInVaults(),
      totalGrossRevenue: vat.totalGross,
      net13: vat.net13,
      vat13: vat.vat13,
      net24: vat.net24,
      vat24: vat.vat24,
      totalNetRevenue: vat.totalNet,
      totalVatLiability: vat.totalVat
    };
    this.printSnapshotZReport(snapshot);
  }

  public printSnapshotZReport(z: DailyZReportSnapshot): void {
    this.printerService.printZReport(z);
  }

  public printVaultReceipt(vault: WaiterVaultSession, handedCash?: number): void {
    this.printerService.printVaultReceipt(vault, handedCash);
  }

  public getActionBadgeClass(action: string): string {
    switch (action) {
      case 'CLOCK_IN':
      case 'CLOCK_OUT': return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
      case 'ORDER_CREATED':
      case 'ITEM_ADDED': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'PAYMENT_RECEIVED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'ITEM_VOIDED':
      case 'VAULT_CLOSED':
      case 'Z_REPORT_CLOSED': return 'bg-red-500/20 text-red-400 border-red-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }

public async flushAllShifts(): Promise<void> {
    try {
      if (confirm('Θέλετε να κλείσουν όλες οι εκκρεμείς/παλιές βάρδιες;')) {
        await this.authShiftService.closeAllActiveShifts();
        alert('Όλες οι παλιές βάρδιες έκλεισαν επιτυχώς!');
      }
    } catch (err) {
      console.error('Failed to flush shifts:', err);
    }
  }

  public async seedMenu(): Promise<void> {
    try {
      await this.posService.seedDefaultMenuForCurrentStore();
      alert('Ο κατάλογος προϊόντων φορτώθηκε επιτυχώς!');
    } catch (err) {
      console.error('Failed to seed menu:', err);
    }
  }

  public async closeSingleStaffShift(emp: Employee): Promise<void> {
    if (confirm(`Θέλετε να κλείσετε τη βάρδια για τον υπάλληλο: ${emp.name};`)) {
      await this.authShiftService.clockOutEmployeeShift(emp.id, `Κλείσιμο βάρδιας (${emp.name})`);
      alert(`Η βάρδια για τον ${emp.name} έκλεισε επιτυχώς.`);
    }
  }
}