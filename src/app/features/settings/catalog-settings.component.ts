import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BulkImportService, RawImportProduct } from '../../core/services/bulk-import.service';
import { AuthShiftService } from '../../core/services/auth-shift.service';

@Component({
  selector: 'app-catalog-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Manager Role Check -->
    @if (isManager()) {
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl font-bold">
            📥
          </div>
          <div>
            <h2 class="text-lg font-black text-white m-0">Μαζική Εισαγωγή Μενού (Excel / CSV / JSON)</h2>
            <p class="text-xs text-slate-400 m-0">Εισάγετε προϊόντα & κατηγορίες αυτόματα από αρχείο.</p>
          </div>
        </div>

        <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-4 text-xs text-slate-300 space-y-2">
          <p class="font-bold text-amber-400">💡 Οδηγίες για το αρχείο CSV / Excel:</p>
          <p>Οι στήλες πρέπει να περιλαμβάνουν: <code class="bg-slate-800 text-amber-300 px-1 py-0.5 rounded">name, categoryName, price, purchasePrice, taxRate</code></p>
        </div>

        <div class="flex flex-wrap gap-3 items-center">
          <!-- Hidden Native File Input -->
          <input type="file" #fileInput (change)="onFileSelected($event)" accept=".csv, .json" class="hidden" />

          <!-- Import Button -->
          <button (click)="fileInput.click()" 
                  [disabled]="isUploading()"
                  class="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2">
            <span>{{ isUploading() ? 'Επεξεργασία...' : '📂 Επιλογή Αρχείου CSV / JSON' }}</span>
          </button>

          <!-- Download Sample CSV Template -->
          <button (click)="downloadSampleCSV()" 
                  class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer">
            ⬇️ Λήψη Προτύπου CSV (Excel)
          </button>
        </div>

        <!-- Status Message Alert -->
        @if (statusMessage()) {
          <div [class]="statusSuccess() ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-rose-500/10 border-rose-500/40 text-rose-400'"
               class="mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2">
            <span>{{ statusSuccess() ? '✅' : '⚠️' }}</span>
            <span>{{ statusMessage() }}</span>
          </div>
        }
      </div>
    } @else {
      <!-- Access Denied Card for Regular Employees -->
      <div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 max-w-md">
        <span class="text-3xl block mb-2">🔒</span>
        <h3 class="font-bold text-white text-base mb-1">Περιορισμένη Πρόσβαση</h3>
        <p class="text-xs">Η διαχείριση καταλόγου είναι διαθέσιμη μόνο σε Διαχειριστές (Managers).</p>
      </div>
    }
  `
})
export class CatalogSettingsComponent {
  private authShiftService = inject(AuthShiftService);
  private bulkImportService = inject(BulkImportService);

  public isUploading = signal<boolean>(false);
  public statusMessage = signal<string>('');
  public statusSuccess = signal<boolean>(true);

  // Check if logged-in employee is Manager or Admin
  public isManager = computed(() => {
    const role = (this.authShiftService.currentEmployee()?.role || '').toUpperCase();
    return role === 'MANAGER' || role === 'ADMIN';
  });

  public async onFileSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    this.statusMessage.set('Ανάγνωση αρχείου...');

    try {
      const text = await file.text();
      let rawProducts: RawImportProduct[] = [];

      if (file.name.toLowerCase().endsWith('.json')) {
        rawProducts = JSON.parse(text);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        rawProducts = this.bulkImportService.parseCSV(text);
      } else {
        throw new Error('Μη υποστηριζόμενος τύπος αρχείου. Επιλέξτε .csv ή .json');
      }

      const result = await this.bulkImportService.importProducts(rawProducts);
      
      this.statusSuccess.set(result.success);
      this.statusMessage.set(result.message);
    } catch (err: any) {
      this.statusSuccess.set(false);
      this.statusMessage.set(err?.message || 'Σφάλμα κατά την επεξεργασία του αρχείου.');
    } finally {
      this.isUploading.set(false);
      target.value = ''; // Reset input
    }
  }

  // Generates and downloads a sample template for Excel
  public downloadSampleCSV(): void {
    const sampleCSV = `name,categoryName,price,purchasePrice,taxRate,isPinnedToPOS
Freddo Espresso,Καφέδες & Ροφήματα,2.20,0.35,13,true
Freddo Cappuccino,Καφέδες & Ροφήματα,2.50,0.45,13,true
Club Sandwich Γαλοπούλα,Σάντουιτς & Snacks,5.80,1.90,13,true
Φρέσκος Χυμός Πορτοκάλι,Τσάι & Χυμοί,3.50,0.80,13,true`;

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