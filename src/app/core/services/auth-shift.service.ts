// src/app/core/services/auth-shift.service.ts

import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  Unsubscribe 
} from 'firebase/firestore';
import { TenantContextService } from './tenant-context.service';

import { 
  Employee, 
  WorkShiftLog, 
  Role 
} from '../modals';

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
  public currentEmployee = signal<Employee | null>(null);
  public workShifts = signal<WorkShiftLog[]>([]);
  public activeWorkShift = signal<WorkShiftLog | null>(null);

  // --- MULTI-TENANCY CONTEXT ---
  public activeTenantId = computed(() => {
    return (
      this.currentEmployee()?.tenantId || 
      localStorage.getItem('active_tenant_id') || 
      (this.tenantContext as any)?.currentTenantId?.() || 
      'coffee-shop-demo'
    );
  });

 public activeStoreId = computed(() => {
    return (
      this.currentEmployee()?.storeId || 
      localStorage.getItem('active_store_id') || 
      (this.tenantContext as any)?.currentStoreId?.() || 
      'store-1'
    );
  });

  // --- ROLE SECURITY ---
  public canManageSystem = computed(() => {
    const emp = this.currentEmployee();
    const role = (emp?.role as string)?.toUpperCase();
    return role === 'MANAGER' || role === 'ADMIN' || role === 'OWNER';
  });

  public storeShifts = computed(() => {
    const targetTenant = normalizeKey(this.activeTenantId());
    const targetStore = normalizeKey(this.activeStoreId());

    return this.workShifts().filter(shift => {
      const sTenant = normalizeKey(shift.tenantId);
      const sStore = normalizeKey(shift.storeId);

      const matchesTenant = sTenant === targetTenant;
      const matchesStore = !sStore || sStore === targetStore || sStore === 'all';

      return matchesTenant && matchesStore;
    });
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

    return [
      { 
        id: `emp_${normalizeKey(tenantId)}_1111`, 
        name: 'Υπεύθυνος (1111)', 
        pin: '1111', 
        pinCode: '1111', 
        role: 'MANAGER', 
        hourlyRate: 8.5, 
        isActive: true, 
        active: true, 
        tenantId, 
        storeId 
      }
    ];
  }

  public initFirestoreSync(db: Firestore): void {
    this.db = db;
    if (!this.db) return;

    if (this.empSyncUnsub) this.empSyncUnsub();
    if (this.shiftSyncUnsub) this.shiftSyncUnsub();

    const targetTenant = normalizeKey(this.activeTenantId());
    const targetStore = normalizeKey(this.activeStoreId());

    // 1. Sync Employees - STRICT TENANT ISOLATION
    this.empSyncUnsub = onSnapshot(collection(this.db, 'employees'), (snap) => {
      const allEmps: Employee[] = [];
      
      snap.forEach(docSnap => {
        const data = docSnap.data() as Employee;
        const empId = data.id || docSnap.id;
        
        const docTenant = normalizeKey(data.tenantId);
        const docStore = normalizeKey(data.storeId);

        // Strict Tenant Match (No cross-tenant bleeding)
        const matchesTenant = docTenant === targetTenant;
        const matchesStore = !docStore || docStore === targetStore || docStore === 'all';

        if (matchesTenant && matchesStore && data.isActive !== false) {
          allEmps.push({ ...data, id: empId });
        }
      });

      if (allEmps.length > 0) {
        this.employees.set(allEmps);
      } else {
        this.employees.set(this.getInitialStoreEmployees(this.activeTenantId(), this.activeStoreId()));
      }
    });

    // 2. Sync Shifts - STRICT TENANT ISOLATION
    this.shiftSyncUnsub = onSnapshot(collection(this.db, 'shifts'), (snap) => {
      const shiftList: WorkShiftLog[] = [];
      
      snap.forEach(docSnap => {
        const data = docSnap.data() as WorkShiftLog;
        const shiftId = data.id || docSnap.id;
        
        const docTenant = normalizeKey(data.tenantId);
        const docStore = normalizeKey(data.storeId);

        const matchesTenant = docTenant === targetTenant;
        const matchesStore = !docStore || docStore === targetStore || docStore === 'all';

        if (matchesTenant && matchesStore) {
          shiftList.push({
            ...data,
            id: shiftId
          });
        }
      });

      this.workShifts.set(shiftList);

      const currentEmp = this.currentEmployee();
      if (currentEmp) {
        const myActive = this.getEmployeeActiveShift(currentEmp.id);
        this.activeWorkShift.set(myActive || null);
      }
    });
  }

  // --- AUTHENTICATION METHODS ---
  public loginWithPin(pin: string): Employee | null {
    const cleanPin = String(pin).trim();
    const availableEmployees = this.employees();

    // Verify PIN exclusively against the currently isolated tenant employee list
    const emp = availableEmployees.find(e => {
      const pinMatch = String(e.pin).trim() === cleanPin || String(e.pinCode).trim() === cleanPin;
      return pinMatch && e.isActive !== false;
    });

    if (emp) {
      this.setLoggedInEmployee(emp);
      return emp;
    }

    return null;
  }

  public setLoggedInEmployee(emp: Employee): void {
    this.currentEmployee.set(emp);
    localStorage.setItem('current_employee', JSON.stringify(emp));
    localStorage.setItem('maranth_pos_employee', JSON.stringify(emp));

    // Save active tenant & store so POS services query the right database slice
    if (emp.tenantId) {
      localStorage.setItem('active_tenant_id', emp.tenantId);
    }
    if (emp.storeId) {
      localStorage.setItem('active_store_id', emp.storeId);
    }

    const existingShift = this.getEmployeeActiveShift(emp.id);

    if (existingShift) {
      this.activeWorkShift.set(existingShift);
    } else {
      this.clockInShift(`Σύνδεση χρήστη (${emp.name})`);
    }
  }

  public logoutEmployee(): void {
    this.currentEmployee.set(null);
    this.activeWorkShift.set(null);
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');
    this.router.navigate(['/login']);
  }

  // --- SHIFT LOGGING METHODS ---
  public clockInShift(notes?: string): WorkShiftLog | null {
    const emp = this.currentEmployee();
    if (!emp) return null;

    const existingActive = this.getEmployeeActiveShift(emp.id);
    if (existingActive) {
      this.activeWorkShift.set(existingActive);
      return existingActive;
    }

    const newShift: WorkShiftLog = {
      id: `SHIFT-${emp.id}-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      tenantId: emp.tenantId || this.activeTenantId(),
      storeId: emp.storeId || this.activeStoreId(),
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
    if (!empIdOrPinOrName) return;
    const targetKey = String(empIdOrPinOrName).trim().toLowerCase();
    const nowStr = new Date().toISOString();

    const allShifts = this.workShifts();
    
    const matchingShifts = allShifts.filter(s => 
      s.status === 'WORKING' && 
      (
        String(s.employeeId || '').toLowerCase() === targetKey || 
        String(s.employeeName || '').toLowerCase() === targetKey || 
        String(s.id || '').toLowerCase() === targetKey
      )
    );

    const updatedShifts = allShifts.map(s => {
      const isTarget = matchingShifts.some(m => m.id === s.id);
      if (isTarget) {
        return {
          ...s,
          status: 'COMPLETED' as const,
          clockOutTime: nowStr,
          notes: notes || 'Κλείσιμο βάρδιας',
          ...(financialSummary || {})
        };
      }
      return s;
    });

    this.workShifts.set(updatedShifts);

    const current = this.currentEmployee();
    if (current && (current.id.toLowerCase() === targetKey || current.name.toLowerCase() === targetKey)) {
      this.activeWorkShift.set(null);
    }

    if (this.db) {
      for (const shift of matchingShifts) {
        const closedShiftRecord = {
          ...shift,
          status: 'COMPLETED',
          clockOutTime: nowStr,
          notes: notes || shift.notes || 'Κλείσιμο βάρδιας',
          ...(financialSummary || {})
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
    if (!empIdOrPin) return undefined;
    const target = String(empIdOrPin).trim().toLowerCase();
    const shifts = this.workShifts();
    const emp = this.employees().find(e => 
      e.id.toLowerCase() === target || 
      String(e.pin).toLowerCase() === target || 
      e.name.toLowerCase() === target
    );

    const empPin = emp ? String(emp.pin).trim().toLowerCase() : '';
    const empName = emp ? emp.name.trim().toLowerCase() : '';
    const empId = emp ? emp.id.trim().toLowerCase() : target;

    return shifts.find(s => {
      if (s.status !== 'WORKING') return false;
      const sEmpId = String(s.employeeId || '').toLowerCase();
      const sEmpName = String(s.employeeName || '').toLowerCase();

      return (
        sEmpId === target ||
        sEmpId === empId ||
        (empPin !== '' && sEmpId === empPin) ||
        (empName !== '' && sEmpName === empName)
      );
    });
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
}