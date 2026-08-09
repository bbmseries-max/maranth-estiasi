import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Router } from '@angular/router';
import { 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot 
} from 'firebase/firestore';

import { 
  Employee, 
  WorkShiftLog, 
  Role 
} from '../models/restaurant-pos.models';

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

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp_1', name: 'Διαχειριστής', pinCode: '1111', pin: '1111', role: 'MANAGER', hourlyRate: 10.0, isActive: true, active: true },
  { id: 'emp_2', name: 'Γιώργος (Σερβιτόρος)', pinCode: '2222', pin: '2222', role: 'WAITER', hourlyRate: 6.5, isActive: true, active: true },
  { id: 'emp_3', name: 'Μαρία (Barista)', pinCode: '3333', pin: '3333', role: 'BAR', hourlyRate: 7.0, isActive: true, active: true },
  { id: 'emp_4', name: 'Κώστας (Κουζίνα)', pinCode: '4444', pin: '4444', role: 'KITCHEN', hourlyRate: 8.0, isActive: true, active: true }
];

@Injectable({
  providedIn: 'root'
})
export class AuthShiftService {
  private router = inject(Router);
  private db: Firestore | null = null;

  // Signals
  public employees = signal<Employee[]>(INITIAL_EMPLOYEES);
  public currentEmployee = signal<Employee | null>(null);
  public workShifts = signal<WorkShiftLog[]>([]);
  public activeWorkShift = signal<WorkShiftLog | null>(null);

  // Computations
  public canManageSystem = computed(() => {
    const emp = this.currentEmployee();
    return emp?.role === 'MANAGER' || emp?.role === 'ADMIN';
  });

  constructor() {
    let wasShiftActive = false;

    // Monitor shift status changes in real time for auto-logout
    effect(() => {
      const currentEmp = this.currentEmployee();
      const shifts = this.workShifts();

      // Skip auto-logout checks for Managers / Admins or unauthenticated states
      if (!currentEmp || currentEmp.role === 'MANAGER' || currentEmp.role === 'ADMIN') {
        wasShiftActive = false;
        return;
      }

      const activeShift = shifts.find(s => s.employeeId === currentEmp.id && s.status === 'WORKING');

      if (activeShift) {
        // Employee has a verified active shift running
        wasShiftActive = true;
      } else if (wasShiftActive) {
        // Shift was closed remotely (e.g. by manager on another device)
        console.warn(`[AuthShiftService] Shift closed remotely for ${currentEmp.name}. Logging out...`);
        wasShiftActive = false;
        this.logoutEmployee();
      }
    });
  }

  /**
   * Initialize Firestore listeners for live employees & work shifts
   */
  public initFirestoreSync(db: any): void {
    this.db = db;
    if (!this.db) return;

    // 1. Sync Employees collection real-time
    onSnapshot(collection(this.db, 'employees'), (snap) => {
      if (!snap.empty) {
        const empList: Employee[] = [];
        snap.forEach(docSnap => {
          empList.push(docSnap.data() as Employee);
        });
        this.employees.set(empList);
      } else {
        // Seed default employees if collection is brand new
        this.employees.set(INITIAL_EMPLOYEES);
        INITIAL_EMPLOYEES.forEach(emp => {
          setDoc(doc(this.db!, 'employees', emp.id), cleanUndefined(emp)).catch(() => {});
        });
      }
    });

    // 2. Sync Work Shifts collection real-time across devices
    onSnapshot(collection(this.db, 'shifts'), (snap) => {
      const shiftList: WorkShiftLog[] = [];
      snap.forEach(docSnap => {
        shiftList.push(docSnap.data() as WorkShiftLog);
      });

      this.workShifts.set(shiftList);

      // Update activeWorkShift Signal for current employee
      const currentEmp = this.currentEmployee();
      if (currentEmp) {
        const myActive = shiftList.find(s => s.employeeId === currentEmp.id && s.status === 'WORKING');
        this.activeWorkShift.set(myActive || null);
      }
    });
  }

  public logoutEmployee(): void {
    this.currentEmployee.set(null);
    this.activeWorkShift.set(null);
    this.router.navigate(['/login']);
  }

  // --- AUTHENTICATION METHODS ---

  public loginWithPin(pin: string): { success: boolean; message: string; employee?: Employee } {
    const cleanPin = pin.trim();
    const emp = this.employees().find(
      e => (e.pinCode === cleanPin || e.pin === cleanPin) && (e.isActive ?? e.active ?? true)
    );

    if (emp) {
      this.setLoggedInEmployee(emp);
      return { success: true, message: 'Επιτυχής είσοδος', employee: emp };
    }
    return { success: false, message: 'Λανθασμένο PIN ή ανενεργός υπάλληλος.' };
  }

  public setLoggedInEmployee(emp: Employee): void {
    this.currentEmployee.set(emp);
  }

  public checkActiveShiftOrAutoKick(): void {
    const current = this.currentEmployee();
    if (!current) return;
    if (current.role === 'ADMIN' || current.role === 'MANAGER') return;

    const activeShift = this.getEmployeeActiveShift(current.id);
    if (!activeShift || activeShift.status === 'COMPLETED') {
      this.logoutEmployee();
    }
  }

  // --- SHIFT LOGGING METHODS ---

  public clockInShift(notes?: string): void {
    const emp = this.currentEmployee();
    if (!emp) return;

    const newShift: WorkShiftLog = {
      id: `SHIFT-${emp.id}-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      clockInTime: new Date().toISOString(),
      status: 'WORKING',
      notes: notes || 'Έναρξη βάρδιας',
      hourlyRateAtShift: emp.hourlyRate || 0
    };

    // 1. Update Signals locally for instant responsiveness
    this.activeWorkShift.set(newShift);
    this.workShifts.update(list => [newShift, ...list.filter(s => s.employeeId !== emp.id || s.status !== 'WORKING')]);

    // 2. Save to Firestore
    if (this.db) {
      setDoc(doc(this.db, 'shifts', newShift.id), cleanUndefined(newShift)).catch(err => {
        console.error('Error saving shift in Firestore:', err);
      });
    }
  }

  public clockOutEmployeeShift(employeeId: string): void {
  const activeShifts = this.workShifts().filter(s => s.employeeId === employeeId && s.status === 'WORKING');
  if (activeShifts.length === 0) return;

  const nowIso = new Date().toISOString();

  // 1. Ενημέρωση των local signals
  this.workShifts.update(list => 
    list.map(s => (s.employeeId === employeeId && s.status === 'WORKING') 
      ? { ...s, clockOutTime: nowIso, status: 'COMPLETED' as const } 
      : s
    )
  );

  if (this.currentEmployee()?.id === employeeId) {
    this.activeWorkShift.set(null);
  }

  // 2. Ενημέρωση στο Firestore για ΟΛΕΣ τις ανοιχτές βάρδιες του υπαλλήλου
  if (this.db) {
    activeShifts.forEach(shift => {
      setDoc(doc(this.db!, 'shifts', shift.id), {
        ...shift,
        clockOutTime: nowIso,
        status: 'COMPLETED'
      }, { merge: true }).catch(err => {
        console.error('Error closing shift in Firestore:', err);
      });
    });
  }
}

 public getEmployeeActiveShift(empId: string): WorkShiftLog | undefined {
  // Παίρνουμε MONO την πιο πρόσφατη βάρδια που είναι 'WORKING'
  const activeShifts = this.workShifts()
    .filter(s => s.employeeId === empId && s.status === 'WORKING')
    .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());

  return activeShifts[0]; // Επιστρέφει την πιο πρόσφατη ή undefined
}

  // --- STAFF MANAGEMENT & BIOMETRICS ---

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
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
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