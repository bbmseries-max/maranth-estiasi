import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  Unsubscribe 
} from 'firebase/firestore';
import { TenantContextService } from './tenant-context.service';
import { Employee, WorkShiftLog, Role } from '../modals';

function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined) as unknown as T;
  const copy: Record<string, any> = {};
  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, any>)[key];
    if (val !== undefined) {
      copy[key] = cleanUndefined(val);
    }
  }
  return copy as T;
}

function normalizeKey(val?: string | null): string {
  if (!val) return '';
  return String(val).trim().toLowerCase().replace(/[\s_-]+/g, '');
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

  // --- STATE SIGNALS ---
  public employees = signal<Employee[]>([]);
  public currentEmployee = signal<Employee | null>(this.loadStoredEmployee());
  public workShifts = signal<WorkShiftLog[]>([]);
  public activeWorkShift = signal<WorkShiftLog | null>(null);

  private loadStoredEmployee(): Employee | null {
    try {
      const saved = localStorage.getItem('current_employee') || localStorage.getItem('maranth_pos_employee');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  // Authoritative Context
  public activeTenantId = computed(() => {
    return this.currentEmployee()?.tenantId || this.tenantContext.currentTenantId();
  });

  public activeStoreId = computed(() => {
    return this.currentEmployee()?.storeId || this.tenantContext.currentStoreId();
  });

  public canManageSystem = computed(() => {
    const role = (this.currentEmployee()?.role as string)?.toUpperCase();
    return role === 'MANAGER' || role === 'ADMIN' || role === 'OWNER';
  });

  public storeShifts = computed(() => {
    const targetStore = this.activeStoreId();
    return this.workShifts().filter(s => !s.storeId || s.storeId === targetStore || s.storeId === 'all');
  });

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    const emp = this.loadStoredEmployee();
    if (emp) {
      if (emp.tenantId && emp.tenantId !== this.tenantContext.currentTenantId()) {
        this.logoutEmployee();
        return;
      }
      this.currentEmployee.set(emp);
    }
  }

  /**
   * Initializes real-time sync with STRICT server-side Firestore query constraints
   */
  public initFirestoreSync(db: Firestore): void {
    this.db = db;
    if (!this.db) return;

    this.teardownListeners();

    const tenantId = this.activeTenantId();

   // 1. Scoped Employee Query (Server-side filter)
    const empQuery = query(
      collection(this.db, 'employees'),
      where('tenantId', '==', tenantId),
      where('isActive', '==', true)
    );

    this.empSyncUnsub = onSnapshot(empQuery, async (snap) => {
      const tenantEmps: Employee[] = [];
      snap.forEach(docSnap => {
        tenantEmps.push({ ...(docSnap.data() as Employee), id: docSnap.id });
      });

      // 🛡️ If this is a brand-new tenant with NO employees in the database, provision the default manager!
      if (tenantEmps.length === 0) {
        const defaultEmps = this.getInitialStoreEmployees(tenantId, this.activeStoreId());
        this.employees.set(defaultEmps);

        // Save default manager to Firestore so they exist permanently
        if (this.db) {
          for (const emp of defaultEmps) {
            await setDoc(doc(this.db, 'employees', emp.id), cleanUndefined(emp), { merge: true }).catch(() => {});
          }
        }
      } else {
        this.employees.set(tenantEmps);
      }
    }, (err) => {
      console.error(`[Security/Firestore] Failed to sync employees for tenant: ${tenantId}`, err);
    });

    this.empSyncUnsub = onSnapshot(empQuery, (snap) => {
      const tenantEmps: Employee[] = [];
      snap.forEach(docSnap => {
        tenantEmps.push({ ...(docSnap.data() as Employee), id: docSnap.id });
      });
      this.employees.set(tenantEmps);
    }, (err) => {
      console.error(`[Security/Firestore] Failed to sync employees for tenant: ${tenantId}`, err);
    });

    // 2. Scoped Shifts Query (Server-side filter)
    const shiftsQuery = query(
      collection(this.db, 'shifts'),
      where('tenantId', '==', tenantId)
    );

    this.shiftSyncUnsub = onSnapshot(shiftsQuery, (snap) => {
      const shiftList: WorkShiftLog[] = [];
      snap.forEach(docSnap => {
        shiftList.push({ ...(docSnap.data() as WorkShiftLog), id: docSnap.id });
      });
      this.workShifts.set(shiftList);

      const localEmp = this.currentEmployee();
      if (localEmp) {
        const myShift = shiftList.find(s => s.status === 'WORKING' && s.employeeId === localEmp.id);
        this.activeWorkShift.set(myShift || null);
      }
    }, (err) => {
      console.error(`[Security/Firestore] Failed to sync shifts for tenant: ${tenantId}`, err);
    });
  }

  public teardownListeners(): void {
    if (this.empSyncUnsub) {
      this.empSyncUnsub();
      this.empSyncUnsub = null;
    }
    if (this.shiftSyncUnsub) {
      this.shiftSyncUnsub();
      this.shiftSyncUnsub = null;
    }
  }

  // --- AUTHENTICATION METHODS ---
  public async loginWithPin(pin: string): Promise<Employee | null> {
    const cleanPin = pin.trim();
    if (!cleanPin) return null;

    const matchedEmp = this.employees().find(e => (e.pin === cleanPin || e.pinCode === cleanPin));

    if (matchedEmp) {
      this.setLoggedInEmployee(matchedEmp);
      return matchedEmp;
    }
    return null;
  }

  public setLoggedInEmployee(emp: Employee): void {
    const activeTenant = this.tenantContext.currentTenantId();

    // Ensure employee object belongs to the store we are actually in
    const scopedEmp: Employee = {
      ...emp,
      tenantId: activeTenant,
      storeId: this.tenantContext.currentStoreId()
    };

    this.currentEmployee.set(scopedEmp);
    localStorage.setItem('current_employee', JSON.stringify(scopedEmp));
    localStorage.setItem('maranth_pos_employee', JSON.stringify(scopedEmp));

    const existingShift = this.getEmployeeActiveShift(scopedEmp.id);
    if (existingShift) {
      this.activeWorkShift.set(existingShift);
    } else {
      this.clockInShift(`Σύνδεση χρήστη (${scopedEmp.name})`, scopedEmp);
    }
  }

  public logoutEmployee(): void {
    this.currentEmployee.set(null);
    this.activeWorkShift.set(null);
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  public getEmployeeActiveShift(empId: string): WorkShiftLog | undefined {
    if (!empId) return undefined;
    return this.workShifts().find(s => s.status === 'WORKING' && s.employeeId === empId);
  }

  // --- SHIFT LOGGING METHODS ---
  public async clockInShift(notes: string = '', targetEmp?: Employee): Promise<void> {
    const emp = targetEmp || this.currentEmployee();
    if (!emp || !this.db) return;

    const newShift: WorkShiftLog = {
      id: `SHIFT-${Date.now()}-${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      clockInTime: new Date().toISOString(),
      status: 'WORKING',
      tenantId: emp.tenantId || this.activeTenantId(),
      storeId: emp.storeId || this.activeStoreId(),
      notes
    };

    this.activeWorkShift.set(newShift);
    this.workShifts.update(list => [newShift, ...list]);
    await setDoc(doc(this.db, 'shifts', newShift.id), newShift).catch(e => console.error(e));
  }

  public async clockOutEmployeeShift(
    empIdOrPinOrName: string, 
    notes?: string,
    financialSummary?: {
      startingFloat?: number;
      cashCollected?: number;
      cardCollected?: number;
      expectedCash?: number;
      actualCash?: number;
      cashVariance?: number;
      totalSales?: number;
    }
  ): Promise<void> {
    if (!empIdOrPinOrName || !this.db) return;
    const targetKey = String(empIdOrPinOrName).trim().toLowerCase();
    const nowStr = new Date().toISOString();

    const activeShift = this.workShifts().find(
      s => s.status === 'WORKING' && 
      (
        s.employeeId.toLowerCase() === targetKey ||
        (s.employeeName && s.employeeName.toLowerCase() === targetKey) ||
        s.id.toLowerCase() === targetKey
      )
    );

    if (!activeShift) return;

    const closedShift: WorkShiftLog = {
      ...activeShift,
      status: 'COMPLETED',
      clockOutTime: nowStr,
      notes: notes || 'Κλείσιμο βάρδιας',
      ...(financialSummary || {})
    };

    this.workShifts.update(list => list.map(s => s.id === activeShift.id ? closedShift : s));

    if (this.currentEmployee()?.id === activeShift.employeeId) {
      this.activeWorkShift.set(null);
    }

    try {
      await setDoc(doc(this.db, 'shifts', activeShift.id), cleanUndefined(closedShift), { merge: true });
    } catch (err) {
      console.error('Error closing shift in Firestore:', err);
    }
  }

  public async closeAllActiveShifts(): Promise<void> {
    const nowStr = new Date().toISOString();
    const openShifts = this.workShifts().filter(s => s.status === 'WORKING');

    this.workShifts.update(list => list.map(s => ({
      ...s,
      status: 'COMPLETED' as const,
      clockOutTime: s.clockOutTime || nowStr,
      notes: s.notes || 'Μαζικό κλείσιμο βάρδιας (Admin flush)'
    })));
    this.activeWorkShift.set(null);

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

  // --- STAFF CRUD ---
  public addEmployee(empData: { name: string; pinCode: string; role: Role; hourlyRate: number }): { success: boolean; message: string; employee?: Employee } {
    const cleanPin = empData.pinCode.trim();
    if (!empData.name || cleanPin.length < 4 || cleanPin.length > 8) {
      return { success: false, message: 'Το PIN πρέπει να είναι 4 έως 8 ψηφία.' };
    }

    const existing = this.employees().find(e => e.pinCode === cleanPin || e.pin === cleanPin);
    if (existing) {
      return { success: false, message: 'Υπάρχει ήδη υπάλληλος με αυτό το PIN!' };
    }

    const newEmp: Employee = {
      id: `emp_${Date.now()}`,
      name: empData.name,
      pinCode: cleanPin,
      pin: cleanPin,
      role: empData.role,
      hourlyRate: empData.hourlyRate || 7.0,
      isActive: true,
      active: true,
      tenantId: this.activeTenantId(),
      storeId: this.activeStoreId(),
      createdAt: new Date().toISOString()
    };

    this.employees.update(list => [...list, newEmp]);

    if (this.db) {
      setDoc(doc(this.db, 'employees', newEmp.id), cleanUndefined(newEmp)).catch(() => {});
    }

    return { success: true, message: 'Ο υπάλληλος δημιουργήθηκε επιτυχώς', employee: newEmp };
  }

  public async updateEmployee(updatedEmp: Employee): Promise<void> {
    this.employees.update(list => list.map(e => e.id === updatedEmp.id ? { ...updatedEmp } : e));

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
    this.employees.update(list => list.map(e => e.id === empId ? { ...e, isActive, active: isActive } : e));

    if (this.db) {
      setDoc(doc(this.db, 'employees', empId), { isActive, active: isActive }, { merge: true }).catch(() => {});
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

  public getInitialStoreEmployees(tenantId: string, storeId: string): Employee[] {
    const isDemo = normalizeKey(tenantId) === 'coffeeshopdemo';
    
    if (isDemo) {
      return [
        { 
          id: `emp_demo_9999`, 
          name: 'Demo Διαχειριστής (9999)', 
          pin: '9999', 
          pinCode: '9999', 
          role: 'MANAGER', 
          hourlyRate: 10.0, 
          isActive: true, 
          active: true, 
          tenantId: 'coffee-shop-demo', 
          storeId: 'store-1' 
        },
        { 
          id: `emp_demo_1234`, 
          name: 'Demo Barista (1234)', 
          pin: '1234', 
          pinCode: '1234', 
          role: 'WAITER', 
          hourlyRate: 6.5, 
          isActive: true, 
          active: true, 
          tenantId: 'coffee-shop-demo', 
          storeId: 'store-1' 
        }
      ];
    }

    // Default for Beach Bar or any new tenant:
    return [
      { 
        id: `emp_${normalizeKey(tenantId)}_1111`, 
        name: 'Υπεύθυνος Καταστήματος (1111)', 
        pin: '1111', 
        pinCode: '1111', 
        role: 'MANAGER', 
        hourlyRate: 10.0, 
        isActive: true, 
        active: true, 
        tenantId, 
        storeId 
      }
    ];
  }
}