// src/app/core/services/device-pairing.service.ts

import { Injectable, signal, computed, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';

export interface DeviceLicense {
  licenseKey: string;      // e.g. "TK-1974" or "DEMO-01"
  tenantId: string;        // e.g. "tirane-kafe-1974"
  storeId: string;         // e.g. "store-2"
  storeName: string;       // e.g. "Tiranë Kafe 1974"
  storeIcon: string;       // e.g. "☕"
  city: string;            // e.g. "Tiranë"
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  pairedAt?: string;
  deviceName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DevicePairingService {
  private db: Firestore | null = null;

  // 🔑 Master Seed Licenses (Fallback & Demo presets)
  private readonly predefinedLicenses: Record<string, DeviceLicense> = {
    'TK-1974': {
      licenseKey: 'TK-1974',
      tenantId: 'tirane-kafe-1974',
      storeId: 'store-2',
      storeName: 'Tiranë Kafe 1974',
      storeIcon: '☕',
      city: 'Tiranë',
      status: 'ACTIVE'
    },
    'DEMO-01': {
      licenseKey: 'DEMO-01',
      tenantId: 'coffee-shop-demo',
      storeId: 'store-1',
      storeName: 'Demo Estiasi (Showcase)',
      storeIcon: '✨',
      city: 'Live Demo',
      status: 'ACTIVE'
    },
    'SYN-2026': {
      licenseKey: 'SYN-2026',
      tenantId: 'syntagma-bistro',
      storeId: 'store-1',
      storeName: 'Syntagma Bistro',
      storeIcon: '🍷',
      city: 'Αθήνα',
      status: 'ACTIVE'
    },
  };

  // Signals
  public currentLicense = signal<DeviceLicense | null>(this.loadStoredLicense());
  public isDevicePaired = computed(() => Boolean(this.currentLicense()));

  public initFirestore(dbInstance: Firestore | null): void {
    this.db = dbInstance;
  }

  /**
   * Load saved license from device storage on app startup
   */
  private loadStoredLicense(): DeviceLicense | null {
    try {
      const saved = localStorage.getItem('maranth_pos_device_license');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Activate / Pair this tablet with a shop License Key
   */
  public async activateDeviceWithKey(key: string, deviceLabel: string = 'Terminal'): Promise<{ success: boolean; message: string; license?: DeviceLicense }> {
    const cleanKey = key.trim().toUpperCase();

    if (!cleanKey) {
      return { success: false, message: 'Παρακαλώ εισάγετε τον κωδικό άδειας.' };
    }

    let resolvedLicense: DeviceLicense | null = null;

    // 1. Check Cloud Firestore for registered license keys
    if (this.db) {
      try {
        const licenseDoc = await getDoc(doc(this.db, 'device_licenses', cleanKey));
        if (licenseDoc.exists()) {
          const data = licenseDoc.data() as DeviceLicense;
          if (data.status === 'REVOKED') {
            return { success: false, message: 'Αυτή η άδεια χρήσης έχει ανακληθεί από τον διαχειριστή.' };
          }
          resolvedLicense = data;
        }
      } catch (err) {
        console.warn('Could not query firestore for license, falling back to predefined:', err);
      }
    }

    // 2. Fallback to Predefined Master Keys
    if (!resolvedLicense && this.predefinedLicenses[cleanKey]) {
      resolvedLicense = this.predefinedLicenses[cleanKey];
    }

    if (!resolvedLicense) {
      return { success: false, message: 'Μη έγκυρος κωδικός άδειας τερματικού. Ελέγξτε τον κωδικό και δοκιμάστε ξανά.' };
    }

    // 3. Save pairing details locally to lock this device
    const activeLicense: DeviceLicense = {
      ...resolvedLicense,
      pairedAt: new Date().toISOString(),
      deviceName: deviceLabel
    };

    localStorage.setItem('maranth_pos_device_license', JSON.stringify(activeLicense));
    localStorage.setItem('active_tenant_id', activeLicense.tenantId);
    localStorage.setItem('active_store_id', activeLicense.storeId);

    // Clear previous sessions
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');

    this.currentLicense.set(activeLicense);

    return { 
      success: true, 
      message: `Επιτυχής ενεργοποίηση για: ${activeLicense.storeName}`,
      license: activeLicense
    };
  }

  /**
   * Reset / Unpair tablet (Admin only - requires Super Admin PIN)
   */
  public unpairDevice(): void {
    localStorage.removeItem('maranth_pos_device_license');
    localStorage.removeItem('active_tenant_id');
    localStorage.removeItem('active_store_id');
    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');
    this.currentLicense.set(null);
  }
}