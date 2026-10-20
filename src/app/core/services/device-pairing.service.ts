import { Injectable, signal, computed } from '@angular/core';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { sha256 } from '../utils/crypto.util';

export interface DeviceLicense {
  licenseHash: string;      // Hashed lookup key
  tenantId: string;
  storeId: string;
  storeName: string;
  storeIcon: string;
  city: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  deviceToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DevicePairingService {
  private db: Firestore | null = null;

  // 🛡️ Predefined license records stored as SHA-256 digests (NO PLAIN TEXT KEYS)
  private readonly predefinedLicenseHashes: Record<string, Omit<DeviceLicense, 'licenseHash'>> = {
    // SHA-256 of "TK-1974"
    '72a2e474ca60d6945a0b95c3298a44d03da0492cb46a9a7a0b3f8ffb737191fe': {
      tenantId: 'tirane-kafe-1974',
      storeId: 'store-2',
      storeName: 'Tiranë Kafe 1974',
      storeIcon: '☕',
      city: 'Tiranë',
      status: 'ACTIVE'
    },
    // SHA-256 of "DEMO-01"
    '33b194f2ea0df2277c10b71e194868e7ec8a7e0892c9f5394be412c984dc7498': {
      tenantId: 'coffee-shop-demo',
      storeId: 'store-1',
      storeName: 'Demo Estiasi (Showcase)',
      storeIcon: '✨',
      city: 'Live Demo',
      status: 'ACTIVE'
    },
    // SHA-256 of "BB-2026"
    '23d46bf5ea167f2597405ba8629ea1568297ea4f954f9a0c84c1737f1e4c70d4': {
      tenantId: 'beach-bar-test',
      storeId: 'store-1',
      storeName: 'Beach Bar Test',
      storeIcon: '🏖️',
      city: 'Athens',
      status: 'ACTIVE'
    }
  };

  // Master Admin Emergency Digest (SHA-256 of your secret master key)
  private readonly MASTER_BYPASS_HASH = '6f35860719e563bcf83190443a2998d59517f30a7add976013f70405aa148a4f'; // hash of 9999

  public currentLicense = signal<DeviceLicense | null>(this.loadStoredLicense());
  public isDevicePaired = computed(() => Boolean(this.currentLicense()?.deviceToken));

  public initFirestore(dbInstance: Firestore | null): void {
    this.db = dbInstance;
  }


/**
   * Synchronizes or activates device license based on route tenantSlug
   */
  public syncWithTenantSlug(slug: string): DeviceLicense | null {
    const existing = this.currentLicense();
    if (existing && existing.tenantId === slug) {
      return existing;
    }

    // Look for matching tenant across predefined hash records
    const matchedHash = Object.keys(this.predefinedLicenseHashes).find(
      h => this.predefinedLicenseHashes[h].tenantId === slug
    );

    if (matchedHash) {
      const profile = this.predefinedLicenseHashes[matchedHash];
      const paired = this.completePairing(matchedHash, profile as DeviceLicense);
      return paired.license;
    }

    return null;
  }
  private loadStoredLicense(): DeviceLicense | null {
    try {
      const saved = localStorage.getItem('maranth_pos_device_license');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Validates activation code cryptographically and pairs the physical device
   */
  public async activateDevice(rawKey: string): Promise<{ success: boolean; isMasterAdmin?: boolean; license?: DeviceLicense; message: string }> {
    const keyHash = await sha256(rawKey);

    // 1. Check Master Bypass Hash
    if (keyHash === this.MASTER_BYPASS_HASH) {
      return {
        success: true,
        isMasterAdmin: true,
        message: 'Master Administrator authenticated.'
      };
    }

    // 2. Check Remote Firestore Licences (Lookup by Hash document ID)
    if (this.db) {
      try {
        const licenseDoc = await getDoc(doc(this.db, 'device_licenses', keyHash));
        if (licenseDoc.exists()) {
          const data = licenseDoc.data() as DeviceLicense;
          if (data.status === 'REVOKED') {
            return { success: false, message: 'Η άδεια χρήσης έχει ανακληθεί.' };
          }
          return this.completePairing(keyHash, data);
        }
      } catch (err) {
        console.warn('Firestore license lookup failed, falling back to local registry:', err);
      }
    }

    // 3. Check Predefined Hash Registry
    if (this.predefinedLicenseHashes[keyHash]) {
      const profile = this.predefinedLicenseHashes[keyHash];
      return this.completePairing(keyHash, profile as DeviceLicense);
    }

    return {
      success: false,
      message: 'Μη έγκυρος κωδικός άδειας τερματικού.'
    };
  }

  private completePairing(hash: string, baseProfile: DeviceLicense): { success: boolean; license: DeviceLicense; message: string } {
    const pairedRecord: DeviceLicense = {
      ...baseProfile,
      licenseHash: hash,
      deviceToken: crypto.randomUUID() // Cryptographic token uniquely binding this browser instance
    };

    localStorage.setItem('maranth_pos_device_license', JSON.stringify(pairedRecord));
    localStorage.setItem('active_tenant_id', pairedRecord.tenantId);
    localStorage.setItem('active_store_id', pairedRecord.storeId);
    this.currentLicense.set(pairedRecord);

    return {
      success: true,
      license: pairedRecord,
      message: `Επιτυχής ενεργοποίηση για ${pairedRecord.storeName}`
    };
  }

  public unpairDevice(): void {
    localStorage.removeItem('maranth_pos_device_license');
    localStorage.removeItem('active_tenant_id');
    localStorage.removeItem('active_store_id');
    localStorage.removeItem('current_employee');
    this.currentLicense.set(null);
  }
}