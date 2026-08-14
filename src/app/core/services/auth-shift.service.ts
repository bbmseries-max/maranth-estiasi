// src/app/core/services/auth-shift.service.ts

import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  Unsubscribe 
} from 'firebase/firestore';
import { TenantContextService } from './tenant-context.service';

import { 
  Employee, 
  WorkShiftLog, 
  Role 
} from '../modals';

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const copy: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      copy[key] = cleanUndefined(obj[key]);
    }
  }
  return copy;
}

@Injectable({
  providedIn: 'root'
})
export class AuthShiftService {
  private tenantContext = inject(TenantContextService);
  private router = inject(Router);
  private db: Firestore | null = null;

  private empSyncUnsub: Unsubscribe | null = null;
  private shiftSyncUnsub: Unsubscribe | null = null;

  // State Signals
  public employees = signal<Employee[]>([]);
  public currentEmployee = signal<Employee | null>(null);
  public workShifts = signal<WorkShiftLog[]>([]);
  public activeWorkShift = signal<WorkShiftLog | null>(null);

  // Multi-Tenancy Computations
  public activeTenantId = computed(() => 
    this.currentEmployee()?.tenantId || 
    localStorage.getItem('active_tenant_id') || 
    (this.tenantContext as any).currentTenantId?.() || 
    'coffee-shop-demo'
  );

  public activeStoreId = computed(() => 
    this.currentEmployee()?.storeId || 
    localStorage.getItem('active_store_id') || 
    (this.tenantContext as any).currentStoreId?.() || 
    'store-1'
  );

  // Role Security
  public canManageSystem = computed(() => {
    const emp = this.currentEmployee();
    const role = (emp?.role as string)?.toUpperCase();
    return role === 'MANAGER' || role === 'ADMIN' || role === 'OWNER';
  });

  // Multi-Store Isolated Shifts List
  public storeShifts = computed(() => {
    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();

    return this.workShifts().filter(shift => 
      (!shift.tenantId || shift.tenantId === tenantId) &&
      (!shift.storeId || shift.storeId === storeId)
    );
  });

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const saved = localStorage.getItem('current_employee') || localStorage.getItem('maranth_pos_employee');
      if (saved) {
        const emp: Employee = JSON.parse(saved);
        this.currentEmployee.set(emp);
      }
    } catch (err) {
      console.warn('Failed to restore employee session:', err);
    }

    let wasShiftActive = false;

    // Monitor shift status changes for non-manager auto-logout
    effect(() => {
      const currentEmp = this.currentEmployee();
      const shifts = this.workShifts();
      const role = (currentEmp?.role as string)?.toUpperCase() || '';

      if (!currentEmp || role === 'MANAGER' || role === 'ADMIN' || role === 'OWNER') {
        wasShiftActive = false;
        return;
      }

      const activeShift = shifts.find(s => 
        (s.employeeId === currentEmp.id || s.employeeId === currentEmp.pin) && s.status === 'WORKING'
      );

      if (activeShift) {
        wasShiftActive = true;
      } else if (wasShiftActive) {
        wasShiftActive = false;
        this.logoutEmployee();
      }
    });
  }

  /**
   * Default staff seed including Master Manager 9999
   */
  private getInitialStoreEmployees(tenantId: string, storeId: string): Employee[] {
    return [
      { 
        id: `${storeId}_emp_9999`, 
        name: 'Διαχειριστής (9999)', 
        pin: '9999', 
        pinCode: '9999', 
        role: 'MANAGER', 
        hourlyRate: 10.0, 
        isActive: true, 
        active: true, 
        tenantId, 
        storeId 
      },
      { 
        id: `${storeId}_emp_1111`, 
        name: 'Υπεύθυνος Βάρδιας', 
        pin: '1111', 
        pinCode: '1111', 
        role: 'MANAGER', 
        hourlyRate: 8.5, 
        isActive: true, 
        active: true, 
        tenantId, 
        storeId 
      },
      { 
        id: `${storeId}_emp_1234`, 
        name: 'Σερβιτόρος / Barista', 
        pin: '1234', 
        pinCode: '1234', 
        role: 'WAITER', 
        hourlyRate: 6.5, 
        isActive: true, 
        active: true, 
        tenantId, 
        storeId 
      }
    ];
  }

  /**
   * Initialize Firestore listeners for live employees & work shifts
   */
 public initFirestoreSync(db: Firestore): void {
    this.db = db;
    if (!this.db) return;

    if (this.empSyncUnsub) this.empSyncUnsub();
    if (this.shiftSyncUnsub) this.shiftSyncUnsub();

    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();

    // 1. Sync Employees (Handle both scoped and legacy documents)
    this.empSyncUnsub = onSnapshot(collection(this.db, 'employees'), (snap) => {
      const allEmps: Employee[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as Employee;
        const empId = data.id || docSnap.id;
        
        // Match if matches active store OR is global/legacy
        const matchesStore = !data.tenantId || data.tenantId === tenantId || data.storeId === storeId;
        if (matchesStore) {
          allEmps.push({ ...data, id: empId });
        }
      });

      if (allEmps.length > 0) {
        this.employees.set(allEmps);
      } else {
        const initialSeed = this.getInitialStoreEmployees(tenantId, storeId);
        this.employees.set(initialSeed);
      }
    });

   // In auth-shift.service.ts inside this.shiftSyncUnsub onSnapshot:
    this.shiftSyncUnsub = onSnapshot(collection(this.db, 'shifts'), (snap) => {
      const shiftList: WorkShiftLog[] = [];
      
      snap.forEach(docSnap => {
        const data = docSnap.data() as WorkShiftLog;
        const shiftId = data.id || docSnap.id;
        
        // Include matching store shifts or legacy shifts
        const isStoreMatch = !data.tenantId || data.tenantId === tenantId;
        if (isStoreMatch) {
          shiftList.push({
            ...data,
            id: shiftId
          });
        }
      });

      this.workShifts.set(shiftList);

      // Only link if there is a real WORKING shift
      const currentEmp = this.currentEmployee();
      if (currentEmp) {
        const myActive = shiftList.find(s => 
          (s.employeeId === currentEmp.id || s.employeeId === currentEmp.pin || s.employeeName === currentEmp.name) && 
          s.status === 'WORKING'
        );
        this.activeWorkShift.set(myActive || null);
      }
    });
  }

  public logoutEmployee(): void {
    this.currentEmployee.set(null);
    this.activeWorkShift.set(null);
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');
    this.router.navigate(['/login']);
  }

  // --- AUTHENTICATION METHODS ---
  public getStorePrefix(): string {
    const store = this.activeStoreId() || 'store-1';
    if (store.toLowerCase().includes('tirane') || store.toLowerCase().includes('kafe')) {
      return 'TK';
    }
    return store.substring(0, 2).toUpperCase();
  }

  public loginWithPin(pin: string): Employee | null {
    let cleanPin = String(pin).trim().toUpperCase();
    const currentTenant = this.activeTenantId();
    const currentStore = this.activeStoreId();
    const prefix = this.getStorePrefix();

    // Strip out prefix if typed manually (e.g., "TK-9999" or "TK9999" -> "9999")
    if (cleanPin.startsWith(`${prefix}-`)) {
      cleanPin = cleanPin.replace(`${prefix}-`, '');
    } else if (cleanPin.startsWith(prefix)) {
      cleanPin = cleanPin.substring(prefix.length);
    }

    // 1. Search employees strictly matching this store AND clean PIN
    let employee = this.employees().find(e => {
      const matchStore = !e.storeId || e.storeId === currentStore;
      const matchPin = String(e.pin).trim() === cleanPin || String(e.pinCode).trim() === cleanPin;
      return matchStore && matchPin && e.isActive !== false;
    });

    // 2. Exact fallback profiles with store prefix in display name
    if (!employee) {
      const predefinedStaff: Record<string, { name: string; role: Role; rate: number }> = {
        '9999': { name: `[${prefix}] Διαχειριστής`, role: 'MANAGER', rate: 10.0 },
        '1111': { name: `[${prefix}] Υπεύθυνος Βάρδιας`, role: 'MANAGER', rate: 8.5 },
        '1234': { name: `[${prefix}] Σερβιτόρος 1`, role: 'WAITER', rate: 6.5 },
        '5555': { name: `[${prefix}] Σερβιτόρος 2`, role: 'WAITER', rate: 6.5 }
      };

      if (predefinedStaff[cleanPin]) {
        const seed = predefinedStaff[cleanPin];
        employee = {
          id: `${currentStore}_emp_${cleanPin}`,
          name: seed.name,
          pin: cleanPin,
          pinCode: `${prefix}-${cleanPin}`, // Combined PIN code: "TK-9999"
          role: seed.role,
          hourlyRate: seed.rate,
          isActive: true,
          active: true,
          tenantId: currentTenant,
          storeId: currentStore
        };

        this.employees.update(list => [employee!, ...list.filter(e => String(e.pin).trim() !== cleanPin)]);
      }
    }

    if (employee) {
      this.setLoggedInEmployee(employee);
      return employee;
    }

    return null;
  }

  /**
   * 🧹 Emergency / Maintenance: Flushes all lingering open shifts in Firestore
   */
  public async closeAllActiveShifts(): Promise<void> {
    const nowStr = new Date().toISOString();
    const openShifts = this.workShifts().filter(s => s.status === 'WORKING');

    // 1. Update in-memory signals
    this.workShifts.update(list => list.map(s => ({
      ...s,
      status: 'COMPLETED' as const,
      clockOutTime: s.clockOutTime || nowStr,
      notes: s.notes || 'Μαζικό κλείσιμο βάρδιας (Admin flush)'
    })));
    this.activeWorkShift.set(null);

    // 2. Persist to Firestore
    if (this.db) {
      for (const shift of openShifts) {
        try {
          await setDoc(doc(this.db, 'shifts', shift.id), cleanUndefined({
            ...shift,
            status: 'COMPLETED',
            clockOutTime: nowStr
          }), { merge: true });
        } catch (err) {
          console.error('Error flushing shift:', err);
        }
      }
    }
  }

  public setLoggedInEmployee(emp: Employee): void {
    this.currentEmployee.set(emp);
    localStorage.setItem('current_employee', JSON.stringify(emp));
    localStorage.setItem('maranth_pos_employee', JSON.stringify(emp));

    // Check if shift already exists
    const existingShift = this.workShifts().find(
      s => (s.employeeId === emp.id || s.employeeId === emp.pin || s.employeeName === emp.name) && s.status === 'WORKING'
    );

    if (existingShift) {
      this.activeWorkShift.set(existingShift);
    } else {
      this.clockInShift(`Σύνδεση χρήστη (${emp.name})`);
    }
  }

  public checkActiveShiftOrAutoKick(): void {
    const current = this.currentEmployee();
    if (!current) return;

    const role = (current.role as string)?.toUpperCase() || '';
    if (role === 'ADMIN' || role === 'MANAGER' || role === 'OWNER') return;

    const activeShift = this.getEmployeeActiveShift(current.id);
    if (!activeShift || activeShift.status === 'COMPLETED') {
      this.logoutEmployee();
    }
  }

  // --- SHIFT LOGGING METHODS ---

  public clockInShift(notes?: string): WorkShiftLog | null {
    const emp = this.currentEmployee();
    if (!emp) return null;

    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();

    const existingActive = this.workShifts().find(
      s => (s.employeeId === emp.id || s.employeeId === emp.pin || s.employeeName === emp.name) && s.status === 'WORKING'
    );

    if (existingActive) {
      this.activeWorkShift.set(existingActive);
      return existingActive;
    }

    const newShift: WorkShiftLog = {
      id: `SHIFT-${emp.id}-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      tenantId: emp.tenantId || tenantId,
      storeId: emp.storeId || storeId,
      clockInTime: new Date().toISOString(),
      status: 'WORKING',
      notes: notes || 'Έναρξη βάρδιας',
      hourlyRateAtShift: emp.hourlyRate || 10.0
    };

    this.activeWorkShift.set(newShift);
    this.workShifts.update(list => [newShift, ...list.filter(s => s.id !== newShift.id)]);

    if (this.db) {
      setDoc(doc(this.db, 'shifts', newShift.id), cleanUndefined(newShift)).catch(err => {
        console.error('Error saving shift in Firestore:', err);
      });
    }

    return newShift;
  }

 public async clockOutEmployeeShift(empIdOrPinOrName: string, notes?: string): Promise<void> {
    if (!empIdOrPinOrName) return;
    const targetKey = empIdOrPinOrName.trim();
    const nowStr = new Date().toISOString();

    // 1. Identify all matching open shifts
    const allShifts = this.workShifts();
    const matchingShifts = allShifts.filter(s => 
      s.status === 'WORKING' && 
      (s.employeeId === targetKey || 
       s.employeeName === targetKey || 
       s.id === targetKey ||
       targetKey.includes(s.employeeId) || 
       s.employeeId.includes(targetKey))
    );

    // 2. Update local state immediately
    const updatedShifts = allShifts.map(s => {
      const isTarget = matchingShifts.some(m => m.id === s.id);
      if (isTarget) {
        return {
          ...s,
          status: 'COMPLETED' as const,
          clockOutTime: nowStr,
          notes: notes || 'Κλείσιμο βάρδιας'
        };
      }
      return s;
    });

    this.workShifts.set(updatedShifts);
    this.activeWorkShift.set(null);

    // 3. Persist every matching open shift document to Firestore
    if (this.db) {
      for (const shift of matchingShifts) {
        const closedShiftRecord = {
          ...shift,
          status: 'COMPLETED',
          clockOutTime: nowStr,
          notes: notes || shift.notes || 'Κλείσιμο βάρδιας'
        };
        try {
          await setDoc(doc(this.db, 'shifts', shift.id), cleanUndefined(closedShiftRecord), { merge: true });
        } catch (err) {
          console.error('Error closing shift in Firestore:', err);
        }
      }
    }
  }

  public getEmployeeActiveShift(empIdOrPin: string): WorkShiftLog | undefined {
    const shifts = this.workShifts();
    const emp = this.employees().find(e => e.id === empIdOrPin || e.pin === empIdOrPin || e.name === empIdOrPin);

    return shifts.find(s => {
      if (s.status !== 'WORKING') return false;
      if (s.employeeId === empIdOrPin) return true;
      if (emp && (s.employeeId === emp.id || s.employeeId === emp.pin || s.employeeName === emp.name)) return true;
      return false;
    });
  }

  // --- STAFF MANAGEMENT METHODS ---

  public addEmployee(empData: { name: string; pinCode: string; role: Role; hourlyRate: number }): { success: boolean; message: string; employee?: Employee } {
    const cleanPin = empData.pinCode.trim();
    if (!empData.name || cleanPin.length < 4 || cleanPin.length > 8) {
      return { success: false, message: 'Το PIN πρέπει να είναι 4 έως 8 ψηφία.' };
    }

    const existing = this.employees().find(e => e.pinCode === cleanPin || e.pin === cleanPin);
    if (existing) {
      return { success: false, message: 'Υπάρχει ήδη υπάλληλος με αυτό το PIN!' };
    }

    const currentTenant = this.activeTenantId();
    const currentStore = this.activeStoreId();

    const newEmp: Employee = {
      id: `emp_${Date.now()}`,
      name: empData.name,
      pinCode: cleanPin,
      pin: cleanPin,
      role: empData.role,
      hourlyRate: empData.hourlyRate || 7.0,
      isActive: true,
      active: true,
      tenantId: currentTenant,
      storeId: currentStore,
      createdAt: new Date().toISOString()
    };

    const updated = [...this.employees(), newEmp];
    this.employees.set(updated);

    if (this.db) {
      setDoc(doc(this.db, 'employees', newEmp.id), cleanUndefined(newEmp)).catch(() => {});
    }

    return { success: true, message: 'Ο υπάλληλος δημιουργήθηκε επιτυχώς', employee: newEmp };
  }

  public async updateEmployee(updatedEmp: Employee): Promise<void> {
    const updatedList = this.employees().map(e => e.id === updatedEmp.id ? { ...updatedEmp } : e);
    this.employees.set(updatedList);

    if (this.currentEmployee()?.id === updatedEmp.id) {
      this.currentEmployee.set(updatedEmp);
    }

    if (this.db) {
      try {
        await setDoc(doc(this.db, 'employees', updatedEmp.id), cleanUndefined(updatedEmp), { merge: true });
      } catch (e) {
        console.error('Error updating employee in Firestore:', e);
      }
    }
  }

  public toggleEmployeeActiveStatus(empId: string, isActive: boolean): void {
    const updated = this.employees().map(e => e.id === empId ? { ...e, isActive, active: isActive } : e);
    this.employees.set(updated);

    if (this.db) {
      updateDoc(doc(this.db, 'employees', empId), { isActive, active: isActive }).catch(() => {});
    }
  }

  public async registerEmployeeBiometrics(employee: Employee): Promise<{ success: boolean; message: string }> {
    if (!window.PublicKeyCredential) {
      return { success: false, message: 'Η συσκευή δεν υποστηρίζει βιομετρική ταυτοποίηση.' };
    }

    try {
      const encoder = new TextEncoder();
      const userIdBuffer = encoder.encode(employee.id);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
          rp: { name: 'Maranth Estiasi POS', id: window.location.hostname },
          user: {
            id: userIdBuffer,
            name: employee.name,
            displayName: employee.name
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, 
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (credential) {
        employee.biometricPublicKey = credential.id;
        await this.updateEmployee(employee);
        return { success: true, message: 'Το αποτύπωμα καταχωρήθηκε με επιτυχία!' };
      }

      return { success: false, message: 'Ακύρωση καταχώρησης.' };
    } catch (error: any) {
      console.error('Biometric registration error:', error);
      return { success: false, message: 'Αποτυχία καταχώρησης αποτυπώματος.' };
    }
  }
}