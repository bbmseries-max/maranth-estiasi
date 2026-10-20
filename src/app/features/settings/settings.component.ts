import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantContextService } from '../../core/services/tenant-context.service';
import { MenuSeederService } from '../../core/services/menu-seeder.service';
import { AuthShiftService } from '../../core/services/auth-shift.service';
import { BulkImportService } from '../../core/services/bulk-import.service';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { Firestore, doc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

export interface StorePrinterConfig {
  id: string;
  name: string;
  role: 'RECEIPTS' | 'KITCHEN' | 'BAR';
  type: 'BROWSER_POPUP' | 'NETWORK_IP';
  ipAddress?: string;
  port?: number;
  paperWidth: 58 | 80;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100 font-sans select-none">
      
      <!-- HEADER -->
      <div class="max-w-5xl mx-auto mb-8">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 class="text-3xl font-black text-white tracking-tight m-0">⚙️ Ρυθμίσεις Καταστήματος</h1>
            <p class="text-sm text-slate-400 font-medium mt-1">Διαχείριση καταλόγου, εκτυπωτών και παραμέτρων POS</p>
          </div>
          
          <!-- CURRENT USER BADGE -->
          <div class="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl flex items-center gap-3">
            <span class="text-xl">👤</span>
            <div>
              <div class="text-xs font-black text-white">{{ currentEmployee()?.name || 'Άγνωστος Χρήστης' }}</div>
              <div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{{ currentEmployee()?.role || 'GUEST' }}</div>
            </div>
          </div>
        </div>

        <!-- TABS NAVIGATION -->
        <div class="flex gap-2 mt-6 overflow-x-auto pb-2 border-b border-slate-800/80">
          <button (click)="activeTab.set('CATALOG')"
                  [class]="activeTab() === 'CATALOG' ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10' : 'bg-slate-900 text-slate-400 hover:text-white font-bold'"
                  class="px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shrink-0">
            <span>📦 Κατάλογος & Εισαγωγή CSV</span>
          </button>
          
          <button (click)="activeTab.set('STORE')"
                  [class]="activeTab() === 'STORE' ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10' : 'bg-slate-900 text-slate-400 hover:text-white font-bold'"
                  class="px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shrink-0">
            <span>🏪 Στοιχεία Καταστήματος</span>
          </button>

          <button (click)="activeTab.set('PRINTERS')"
                  [class]="activeTab() === 'PRINTERS' ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10' : 'bg-slate-900 text-slate-400 hover:text-white font-bold'"
                  class="px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2 shrink-0">
            <span>🖨️ Εκτυπωτές & Θερμικοί</span>
          </button>
        </div>
      </div>

      <!-- MAIN TAB CONTENT -->
      <div class="max-w-5xl mx-auto">
        
        <!-- TAB 1: CATALOG & BULK IMPORT -->
        @if (activeTab() === 'CATALOG') {
          @if (isManager()) {
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl max-w-3xl">
              <div class="flex items-center gap-4 mb-6 border-b border-slate-800/80 pb-4">
                <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl font-black shrink-0">
                  📥
                </div>
                <div>
                  <h2 class="text-xl font-black text-white m-0">Μαζική Εισαγωγή Μενού (Excel / CSV / JSON)</h2>
                  <p class="text-xs text-slate-400 m-0 mt-1">Ανεβάστε το τιμοκατάλογό σας αυτόματα απευθείας στο κατάστημα {{ activeStoreProfile()?.name }}.</p>
                </div>
              </div>

              <div class="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 mb-6 text-xs text-slate-300 space-y-3">
                <p class="font-black text-amber-400 text-sm flex items-center gap-2">
                  <span>💡</span> Οδηγίες για τη μορφή του αρχείου Excel / CSV:
                </p>
                <p class="leading-relaxed">
                  Το αρχείο σας πρέπει να έχει επικεφαλίδες στη 1η γραμμή. Υποχρεωτικές στήλες: 
                  <code class="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">name</code>, 
                  <code class="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">categoryName</code>, 
                  <code class="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">price</code>.
                </p>
              </div>

              <div class="flex flex-wrap gap-4 items-center">
                <input type="file" #fileInput (change)="onFileSelected($event)" accept=".csv, .json" class="hidden" />

                <button (click)="fileInput.click()" 
                        [disabled]="isUploading()"
                        class="px-6 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50">
                  <span>{{ isUploading() ? 'Επεξεργασία...' : '📂 Επιλογή Αρχείου CSV / JSON' }}</span>
                </button>

                <button (click)="downloadSampleCSV()" 
                        class="px-5 py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-2">
                  <span>⬇️ Λήψη Πρότυπου CSV (Excel)</span>
                </button>
              </div>

              @if (statusMessage()) {
                <div [class]="statusSuccess() ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/10 border-rose-500/40 text-rose-400'"
                     class="mt-6 p-4 rounded-2xl border text-xs font-black flex items-center gap-3">
                  <span class="text-lg">{{ statusSuccess() ? '✅' : '⚠️' }}</span>
                  <span>{{ statusMessage() }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 max-w-md mx-auto">
              <span class="text-4xl block mb-3">🔒</span>
              <h3 class="font-black text-white text-lg mb-2">Περιορισμένη Πρόσβαση</h3>
              <p class="text-xs text-slate-400">Η εισαγωγή και τροποποίηση καταλόγου επιτρέπεται μόνο σε Διαχειριστές (Managers).</p>
            </div>
          }
        }

        <!-- TAB 2: STORE SETTINGS -->
        @if (activeTab() === 'STORE') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl max-w-2xl">
            <h2 class="text-lg font-black text-white mb-4">Στοιχεία Καταστήματος</h2>
            <div class="space-y-4 text-xs">
              <div>
                <label class="block text-slate-400 mb-1 font-bold">Όνομα Επιχείρησης / Κατάστημα</label>
                <input type="text" [value]="activeStoreProfile()?.name || activeTenantId()" readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1 font-bold">Πόλη / Τοποθεσία</label>
                <input type="text" [value]="activeStoreProfile()?.city || 'Ελλάδα'" readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1 font-bold">Tenant ID (URL Slug)</label>
                <input type="text" [value]="activeTenantId()" readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-amber-400 font-mono" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1 font-bold">Store ID</label>
                <input type="text" [value]="activeStoreId()" readonly class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 font-mono" />
              </div>
            </div>
          </div>
        }

        <!-- TAB 3: PRINTERS & HARDWARE (PER-TENANT ISOLATED) -->
        @if (activeTab() === 'PRINTERS') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl max-w-3xl">
            <div class="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
              <div>
                <h2 class="text-xl font-black text-white m-0">🖨️ Εκτυπωτές Καταστήματος</h2>
                <p class="text-xs text-slate-400 m-0 mt-1">Ρυθμίσεις θερμικών εκτυπωτών για το κατάστημα {{ activeStoreProfile()?.name }}.</p>
              </div>
              <button (click)="addNewPrinter()" 
                      class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer">
                ➕ Προσθήκη Εκτυπωτή
              </button>
            </div>

            <div class="space-y-4">
              @for (printer of printers(); track printer.id; let i = $index) {
                <div class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div class="space-y-1 flex-1">
                    <input type="text" [(ngModel)]="printer.name" class="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold text-white w-full max-w-xs" />
                    <div class="flex flex-wrap gap-2 pt-2">
                      <select [(ngModel)]="printer.role" class="bg-slate-900 border border-slate-700 text-xs text-amber-400 rounded-lg px-2 py-1">
                        <option value="RECEIPTS">🧾 Ταμείο / Αποδείξεις</option>
                        <option value="KITCHEN">🍳 Κουζίνα</option>
                        <option value="BAR">☕ Bar</option>
                      </select>

                      <select [(ngModel)]="printer.type" class="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2 py-1">
                        <option value="BROWSER_POPUP">🪟 Παράθυρο Browser (Προεπιλογή)</option>
                        <option value="NETWORK_IP">🌐 Δικτυακός (LAN / IP)</option>
                      </select>

                      <select [(ngModel)]="printer.paperWidth" class="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2 py-1">
                        <option [ngValue]="80">80mm</option>
                        <option [ngValue]="58">58mm</option>
                      </select>
                    </div>

                    @if (printer.type === 'NETWORK_IP') {
                      <div class="flex gap-2 pt-2 items-center">
                        <input type="text" [(ngModel)]="printer.ipAddress" placeholder="IP: 192.168.1.200" class="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-emerald-400 font-mono w-36" />
                        <input type="number" [(ngModel)]="printer.port" placeholder="Port: 9100" class="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-slate-300 font-mono w-24" />
                      </div>
                    }
                  </div>

                  <button (click)="removePrinter(i)" class="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl border border-rose-500/30 text-xs font-bold cursor-pointer">
                    🗑️ Διαγραφή
                  </button>
                </div>
              } @empty {
                <div class="text-center py-8 text-slate-500 text-xs">
                  Δεν έχουν προστεθεί προσαρμοσμένοι εκτυπωτές. Οι εκτυπώσεις γίνονται μέσω του παραθύρου εκτύπωσης του browser.
                </div>
              }
            </div>

            <div class="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button (click)="savePrintersConfig()" 
                      [disabled]="isSavingPrinters()"
                      class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50">
                {{ isSavingPrinters() ? 'Αποθήκευση...' : '💾 Αποθήκευση Εκτυπωτών' }}
              </button>
            </div>
          </div>
        }

      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private tenantContext = inject(TenantContextService);
  private authShiftService = inject(AuthShiftService);
  private bulkImportService = inject(BulkImportService);
  private posService = inject(RestaurantPosService);

  public activeTab = signal<'CATALOG' | 'STORE' | 'PRINTERS'>('CATALOG');
  public isUploading = signal<boolean>(false);
  public isSavingPrinters = signal<boolean>(false);
  public statusMessage = signal<string>('');
  public statusSuccess = signal<boolean>(true);

  public currentEmployee = computed(() => this.authShiftService.currentEmployee());

  public activeTenantId = computed(() => 
    this.currentEmployee()?.tenantId || 
    localStorage.getItem('active_tenant_id') || 
    this.tenantContext.currentTenantId()
  );

  public activeStoreId = computed(() => 
    this.currentEmployee()?.storeId || 
    localStorage.getItem('active_store_id') || 
    this.tenantContext.currentStoreId()
  );

  public activeStoreProfile = computed(() => this.tenantContext.activeStore());

  public printers = signal<StorePrinterConfig[]>([]);
  private printersUnsub: Unsubscribe | null = null;

  ngOnInit(): void {
    this.initPrintersSync();
  }

  public isManager = computed(() => {
    const role = (this.currentEmployee()?.role || '').toUpperCase();
    return role === 'MANAGER' || role === 'ADMIN' || role === 'OWNER';
  });

  private initPrintersSync(): void {
    const db = this.posService.db;
    if (!db) return;

    if (this.printersUnsub) {
      this.printersUnsub();
    }

    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();
    const configId = `${tenantId}_${storeId}_printers`;

    this.printersUnsub = onSnapshot(doc(db, 'store_configs', configId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        this.printers.set(data['printers'] || []);
      } else {
        // Default browser fallback printer
        this.printers.set([
          {
            id: 'default_receipt',
            name: 'Κεντρικό Ταμείο',
            role: 'RECEIPTS',
            type: 'BROWSER_POPUP',
            paperWidth: 80
          }
        ]);
      }
    }, (err) => console.error('[Settings] Printers sync error:', err));
  }

  public addNewPrinter(): void {
    this.printers.update(list => [
      ...list,
      {
        id: `prn_${Date.now()}`,
        name: 'Νέος Εκτυπωτής',
        role: 'KITCHEN',
        type: 'BROWSER_POPUP',
        paperWidth: 80
      }
    ]);
  }

  public removePrinter(index: number): void {
    this.printers.update(list => list.filter((_, i) => i !== index));
  }

  public async savePrintersConfig(): Promise<void> {
    const db = this.posService.db;
    if (!db) return;

    const tenantId = this.activeTenantId();
    const storeId = this.activeStoreId();
    const configId = `${tenantId}_${storeId}_printers`;

    this.isSavingPrinters.set(true);
    try {
      await setDoc(doc(db, 'store_configs', configId), {
        tenantId,
        storeId,
        printers: this.printers(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('Οι ρυθμίσεις εκτυπωτών αποθηκεύτηκαν επιτυχώς για το κατάστημα!');
    } catch (err) {
      console.error('Save printers error:', err);
      alert('Σφάλμα κατά την αποθήκευση εκτυπωτών.');
    } finally {
      this.isSavingPrinters.set(false);
    }
  }

  public async onFileSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    this.statusMessage.set('Ανάγνωση και επεξεργασία αρχείου...');

    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith('.json');

      const { products, warnings } = this.bulkImportService.parseFileContent(text, isJson);

      if (products.length === 0) {
        throw new Error('Δεν βρέθηκαν έγκυρα προϊόντα στο αρχείο.');
      }

      // Enforce current tenant/store boundaries on bulk imported products
      const tenantId = this.activeTenantId();
      const storeId = this.activeStoreId();
      const scopedProducts = products.map(p => ({
        ...p,
        tenantId,
        storeId
      }));

      const result = await this.bulkImportService.importProducts(scopedProducts);

      this.statusSuccess.set(result.success);
      const warningText = warnings.length > 0 ? ` (${warnings.length} προειδοποιήσεις)` : '';
      this.statusMessage.set(`${result.message}${warningText}`);
    } catch (err: any) {
      this.statusSuccess.set(false);
      this.statusMessage.set(err?.message || 'Σφάλμα κατά την επεξεργασία του αρχείου.');
    } finally {
      this.isUploading.set(false);
      target.value = '';
    }
  }

  public downloadSampleCSV(): void {
    const sampleCSV = `name,categoryName,price,purchasePrice,taxRate,isPinnedToPOS
Freddo Espresso,Καφέδες & Ροφήματα,2.20,0.35,13,true
Freddo Cappuccino,Καφέδες & Ροφήματα,2.50,0.45,13,true
Espresso Single,Καφέδες & Ροφήματα,1.80,0.25,13,true
Club Sandwich Γαλοπούλα,Σάντουιτς & Snacks,5.80,1.90,13,true
Φρέσκος Χυμός Πορτοκάλι,Τσάι & Χυμοί,3.50,0.80,13,true
Κρουασάν Βουτύρου,Γλυκά & Περιποίησης,2.00,0.60,13,true`;

    const blob = new Blob(['\uFEFF' + sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'menu_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}