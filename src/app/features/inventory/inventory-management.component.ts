import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GreekVatRate } from '../../core/modals/restaurant-pos.modals';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { 
  RawMaterial, 
  Product, 
  Category, 
  Employee, 
  RestaurantTable,
  Role,
  UnitOfMeasure
} from '../../core/modals/restaurant-pos.modals';

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      <!-- TOP NAVIGATION BAR -->
      <header class="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shadow-lg sticky top-0 z-30">
        <div class="flex items-center gap-4">
          <a routerLink="/floor-plan" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs no-underline flex items-center gap-1.5 transition-all">
            <span>⬅️</span>
            <span>Πλάνο</span>
          </a>
          <div>
            <h1 class="text-lg font-black text-white m-0 flex items-center gap-2">
             <!-- <span>🪄 magicBoard</span> -->
            </h1>
            <span class="text-[20px] text-amber-400 font-bold">🪄Board</span>
          </div>
        </div>

        <!-- TAB SELECTOR BUTTONS & MASTER RESET -->
        <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <button (click)="activeTab.set('RECEIVING')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="activeTab() === 'RECEIVING' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700'">
            📥 Παραλαβή & Πρώτες Ύλες
          </button>
          <button (click)="activeTab.set('STOCK')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="activeTab() === 'STOCK' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🏷️ Τιμοκατάλογος & ΦΠΑ
          </button>
          <button (click)="activeTab.set('TABLES')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="activeTab() === 'TABLES' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🪑 Τραπέζια & Ζώνες
          </button>
          <button (click)="activeTab.set('STAFF')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="activeTab() === 'STAFF' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700'">
            👥 Προσωπικό & PINs
          </button>
          <button (click)="activeTab.set('SPOILAGE')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer"
                  [ngClass]="activeTab() === 'SPOILAGE' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🗑️ Φύρα & Ζημιές
          </button>

          <!-- MASTER FRESH START RESET BUTTON 
          @if (posService.canManageSystem()) {
            <button (click)="triggerFreshStartReset()"
                    class="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-sm">
              <span>🔥</span>
              <span>Fresh Start</span>
            </button>
          }-->
        </div>
      </header>

      <div class="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        
        <!-- TAB 1: GOODS RECEIVING & RAW MATERIAL CONTROL -->
        @if (activeTab() === 'RECEIVING') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <h2 class="text-sm font-black text-amber-400 uppercase tracking-wider m-0">📥 Νέα Καταχώριση Παραλαβής</h2>

              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Πρώτη Ύλη / Υλικό</label>
                <input type="text" [(ngModel)]="receivingItemName" placeholder="π.χ. Καφές Espresso Blend 1kg"
                       class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Ποσότητα</label>
                  <input type="number" step="0.1" [(ngModel)]="receivingQuantity"
                         class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400" />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Μονάδα</label>
                  <select [(ngModel)]="receivingUnit"
                          class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                    <option value="KG">Κιλά (KG)</option>
                    <option value="LITER">Λίτρα (LITER)</option>
                    <option value="PCS">Τεμάχια (PCS)</option>
                    <option value="PACK">Συσκευασίες (PACK)</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Καθαρή Τιμή Μονάδος (€)</label>
                  <input type="number" step="0.01" [(ngModel)]="receivingUnitPrice"
                         class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400" />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Συντελεστής ΦΠΑ</label>
                  <select [(ngModel)]="receivingVat"
                          class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                    <option [ngValue]="13">13% (Μειωμένος)</option>
                    <option [ngValue]="24">24% (Κανονικός)</option>
                    <option [ngValue]="6">6% (Υπερμειωμένος)</option>
                    <option [ngValue]="0">0% (Απαλλαγή)</option>
                  </select>
                </div>
              </div>

              <button (click)="addMaterialStock()"
                      [disabled]="!receivingItemName || receivingQuantity <= 0"
                      class="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs transition-all shadow-md active:scale-95 mt-2 cursor-pointer">
                ✓ Ενημέρωση Αποθέματος (Cloud Sync)
              </button>
            </div>

            <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <div class="flex justify-between items-center">
                <div>
                  <h2 class="text-sm font-black text-white uppercase tracking-wider m-0">📋 Υπόλοιπα Πρώτων Υλών</h2>
                  <span class="text-[11px] text-slate-400">Πλήρης έλεγχος αποθεμάτων, απογραφή & επεξεργασία ορίων</span>
                </div>
                <div class="flex gap-2">
                  <button (click)="openNewRawMaterialModal()"
                          class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer">
                    <span>➕</span>
                    <span>Νέο Υλικό</span>
                  </button>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-2.5 px-3">Υλικό</th>
                      <th class="py-2.5 px-3">Μονάδα</th>
                      <th class="py-2.5 px-3">Απόθεμα</th>
                      <th class="py-2.5 px-3">Όριο Alert</th>
                      <th class="py-2.5 px-3">Κόστος / Μον.</th>
                      <th class="py-2.5 px-3">Κατάσταση</th>
                      <th class="py-2.5 px-3 text-right">Ενέργειες</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (mat of posService.rawMaterials(); track mat.id) {
                      <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        <td class="py-3 px-3 font-bold text-white">{{ mat.name }}</td>
                        <td class="py-3 px-3 text-slate-400 font-medium">{{ mat.unit }}</td>
                        <td class="py-3 px-3 font-black text-amber-400 text-sm">{{ mat.currentStock.toFixed(2) }}</td>
                        <td class="py-3 px-3 text-slate-400 font-bold">{{ mat.minAlertStock.toFixed(2) }} {{ mat.unit }}</td>
                        <td class="py-3 px-3 text-emerald-400 font-bold">€{{ mat.costPerUnit.toFixed(2) }}</td>
                        <td class="py-3 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                                [ngClass]="mat.currentStock <= mat.minAlertStock ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'">
                            {{ mat.currentStock <= mat.minAlertStock ? '⚠️ Χαμηλό' : '🟢 OK' }}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-right flex justify-end gap-1.5">
                          <button (click)="openStockAdjustModal(mat)"
                                  class="px-2 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-500/30 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                                  title="Απογραφή / Διόρθωση">
                            ⚖️ Απογραφή
                          </button>
                          <button (click)="openEditRawMaterialModal(mat)"
                                  class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                                  title="Επεξεργασία">
                            ✏️
                          </button>
                          <button (click)="deleteRawMaterial(mat.id)"
                                  class="px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                                  title="Διαγραφή">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="py-8 text-center text-slate-500 font-bold">
                          Δεν υπάρχουν καταχωρημένες πρώτες ύλες.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        }

        <!-- TAB 2: MENU PRODUCTS CATALOG & CATEGORIES -->
        @if (activeTab() === 'STOCK') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <h3 class="text-xs font-black text-amber-400 uppercase tracking-wider m-0">📁 Κατηγορίες Μενού ({{ posService.categories().length }})</h3>
                <span class="text-[11px] text-slate-400">Δημιουργία νέων ομάδων προϊόντων</span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                @for (cat of posService.categories(); track cat.id) {
                  <div class="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-xl text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{{ cat.icon || '📁' }}</span>
                    <span>{{ cat.name }}</span>
                    <button (click)="deleteCategory(cat.id)" class="text-red-400 hover:text-red-300 ml-1 text-xs font-bold cursor-pointer" title="Διαγραφή">✕</button>
                  </div>
                }
                <button (click)="showNewCategoryModal.set(true)"
                        class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer">
                  <span>➕</span>
                  <span>Νέα Κατηγορία</span>
                </button>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">🏷️ Τιμοκατάλογος & Προϊόντα POS</h2>
                <span class="text-xs text-slate-400">Διαχείριση λιανικής τιμής, κόστους, συντελεστών ΦΠΑ και επεξεργασία ειδών</span>
              </div>

              <button (click)="showNewProductModal.set(true)"
                      class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
                <span>➕</span>
                <span>Νέο Προϊόν / Είδος</span>
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-2.5 px-3">Προϊόν</th>
                    <th class="py-2.5 px-3">Κατηγορία</th>
                    <th class="py-2.5 px-3">Τιμή Πώλησης</th>
                    <th class="py-2.5 px-3">Κόστος Αγοράς</th>
                    <th class="py-2.5 px-3">ΦΠΑ</th>
                    <th class="py-2.5 px-3">Κατάσταση</th>
                    <th class="py-2.5 px-3 text-right">Ενέργειες</th>
                  </tr>
                </thead>
                <tbody>
                  @for (prod of posService.products(); track prod.id) {
                    <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3 font-bold text-white">{{ prod.name }}</td>
                      <td class="py-3 px-3 text-slate-400 font-medium">{{ prod.categoryName || 'Γενικά' }}</td>
                      <td class="py-3 px-3 font-black text-emerald-400">€{{ prod.price.toFixed(2) }}</td>
                      <td class="py-3 px-3 text-slate-300 font-bold">€{{ (prod.purchasePrice || prod.costPrice || 0).toFixed(2) }}</td>
                      <td class="py-3 px-3 font-bold text-amber-400">{{ prod.taxRate || 13 }}%</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                              [ngClass]="(prod.isActive ?? true) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40'">
                          {{ (prod.isActive ?? true) ? '🟢 Ενεργό' : '🔴 Ανενεργό' }}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right flex justify-end gap-2">
                        <button (click)="openEditProductModal(prod)"
                                class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-[10px] font-bold transition-all active:scale-95 cursor-pointer">
                          ✏️ Επεξεργασία
                        </button>
                        <button (click)="deleteProduct(prod.id)"
                                class="px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all active:scale-95 cursor-pointer">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 3: TABLE & ZONE MANAGEMENT -->
        @if (activeTab() === 'TABLES') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">🪑 Διαχείριση Τραπεζιών & Ζωνών Σάλας</h2>
                <span class="text-xs text-slate-400">Προσθήκη, επεξεργασία αριθμών, χωρητικότητας και αλλαγή ζώνης (Σάλα, Αυλή, Bar, VIP)</span>
              </div>

              <button (click)="openNewTableModal()"
                      class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
                <span>➕</span>
                <span>Νέο Τραπέζι</span>
              </button>
            </div>

            @if (tableErrorMessage()) {
              <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-bold text-red-400 text-center">
                {{ tableErrorMessage() }}
              </div>
            }

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-2.5 px-3">Αριθμός</th>
                    <th class="py-2.5 px-3">Ονομασία</th>
                    <th class="py-2.5 px-3">Ζώνη / Τομέας</th>
                    <th class="py-2.5 px-3">Χωρητικότητα</th>
                    <th class="py-2.5 px-3">Κατάσταση</th>
                    <th class="py-2.5 px-3 text-right">Ενέργειες</th>
                  </tr>
                </thead>
                <tbody>
                  @for (table of posService.tables(); track table.id) {
                    @if (table.id !== 'takeaway-counter') {
                      <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        <td class="py-3 px-3 font-black text-amber-400 text-sm">#{{ table.number || table.tableNumber }}</td>
                        <td class="py-3 px-3 font-bold text-white">{{ table.name || ('Τραπέζι ' + (table.number || table.tableNumber)) }}</td>
                        <td class="py-3 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                            📍 {{ table.zone || table.section || 'Σάλα' }}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-slate-300 font-bold">👥 {{ table.seats || table.capacity || 4 }} άτομα</td>
                        <td class="py-3 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                                [ngClass]="table.status === 'FREE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40'">
                            {{ table.status === 'FREE' ? '🟢 Ελεύθερο' : '🔴 Κατειλημμένο' }}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-right flex justify-end gap-2">
                          <button (click)="openEditTableModal(table)"
                                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-[10px] font-bold transition-all active:scale-95 cursor-pointer">
                            ✏️ Επεξεργασία
                          </button>
                          <button (click)="deleteTable(table.id)"
                                  class="px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all active:scale-95 cursor-pointer">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 4: STAFF, PIN & BIOMETRIC FINGERPRINT MANAGEMENT -->
        @if (activeTab() === 'STAFF') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">👥 Διαχείριση Προσωπικού, PINs & Αποτυπωμάτων</h2>
                <span class="text-xs text-slate-400">Προσθήκη υπαλλήλων, ορισμός PINs, βιομετρική ταυτοποίηση (Fingerprint) & ρόλων</span>
              </div>

              <button (click)="showNewStaffModal.set(true)"
                      class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
                <span>➕</span>
                <span>Νέος Υπάλληλος / Manager</span>
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-2.5 px-3">Ονοματεπώνυμο</th>
                    <th class="py-2.5 px-3">Ρόλος</th>
                    <th class="py-2.5 px-3">PIN Εισόδου</th>
                    <th class="py-2.5 px-3">Βιομετρικό (Fingerprint)</th>
                    <th class="py-2.5 px-3">Ωρομίσθιο (€/h)</th>
                    <th class="py-2.5 px-3">Κατάσταση</th>
                    <th class="py-2.5 px-3 text-right">Ενέργεια</th>
                  </tr>
                </thead>
                <tbody>
                  @for (emp of posService.employees(); track emp.id) {
                    <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span class="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-[10px]">
                          {{ emp.name.charAt(0) }}
                        </span>
                        <span>{{ emp.name }}</span>
                      </td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border"
                              [ngClass]="{
                                'bg-purple-500/20 text-purple-400 border-purple-500/40': emp.role === 'MANAGER' || emp.role === 'ADMIN',
                                'bg-amber-500/20 text-amber-400 border-amber-500/40': emp.role === 'WAITER',
                                'bg-sky-500/20 text-sky-400 border-sky-500/40': emp.role === 'BARISTA',
                                'bg-emerald-500/20 text-emerald-400 border-emerald-500/40': emp.role === 'KITCHEN'
                              }">
                          {{ getRoleLabel(emp.role) }}
                        </span>
                      </td>
                      <td class="py-3 px-3 font-mono font-bold text-amber-400 text-sm tracking-widest">
                        •••• ({{ emp.pinCode || emp.pin }})
                      </td>
                      <td class="py-3 px-3">
                        <button type="button"
                                (click)="onRegisterFingerprint(emp)"
                                [disabled]="isRegisteringBiometrics()"
                                class="px-2.5 py-1 rounded-xl font-bold text-[10px] border transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                                [ngClass]="emp.biometricPublicKey ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'">
                          <span>👆</span>
                          <span>{{ emp.biometricPublicKey ? 'Ενημέρωση Αποτυπώματος' : '➕ Καταχώρηση' }}</span>
                        </button>
                      </td>
                      <td class="py-3 px-3 text-emerald-400 font-bold">€{{ (emp.hourlyRate || 0).toFixed(2) }}</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                              [ngClass]="(emp.isActive ?? emp.active ?? true) ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40'">
                          {{ (emp.isActive ?? emp.active ?? true) ? '🟢 Ενεργός' : '🔴 Ανενεργός' }}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right">
                        @if (emp.isActive ?? emp.active ?? true) {
                          <button (click)="toggleEmployeeStatus(emp.id, false)"
                                  class="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/40 text-[10px] font-bold transition-all active:scale-95 cursor-pointer">
                            🚫 Αποδέσμευση
                          </button>
                        } @else {
                          <button (click)="toggleEmployeeStatus(emp.id, true)"
                                  class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold transition-all active:scale-95 cursor-pointer">
                            🟢 Επαναφορά
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 5: SPOILAGE LOGS -->
        @if (activeTab() === 'SPOILAGE') {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <h2 class="text-sm font-black text-red-400 uppercase tracking-wider m-0">🗑️ Καταγραφή Φύρας & Απωλειών</h2>

              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Όνομα Υλικού / Προϊόντος</label>
                <input type="text" [(ngModel)]="spoilageItemName" placeholder="π.χ. Γάλα Πλήρες 1L"
                       class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Ποσότητα</label>
                  <input type="number" step="0.1" [(ngModel)]="spoilageQty"
                         class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-red-400" />
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Μονάδα</label>
                  <select [(ngModel)]="spoilageUnit"
                          class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400">
                    <option value="KG">KG</option>
                    <option value="LITER">LITER</option>
                    <option value="PCS">PCS</option>
                  </select>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Αιτιολογία Ζημιάς</label>
                <input type="text" [(ngModel)]="spoilageReason" placeholder="π.χ. Ημερομηνία λήξης, Χύθηκε..."
                       class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400" />
              </div>

              <button (click)="logSpoilageEntry()"
                      [disabled]="!spoilageItemName || spoilageQty <= 0"
                      class="py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs transition-all shadow-md active:scale-95 mt-2 cursor-pointer">
                🗑️ Καταγραφή Ζημιάς (Cloud Sync)
              </button>
            </div>

            <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <h2 class="text-sm font-black text-white uppercase tracking-wider m-0">📜 Ιστορικό Φύρας</h2>
              
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-2.5 px-3">Ημερομηνία</th>
                      <th class="py-2.5 px-3">Είδος</th>
                      <th class="py-2.5 px-3">Ποσότητα</th>
                      <th class="py-2.5 px-3">Αιτιολογία</th>
                      <th class="py-2.5 px-3">Υπάλληλος</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (log of posService.spoilageLogs(); track log.id) {
                      <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        <td class="py-3 px-3 text-slate-400">{{ log.timestamp | date:'shortTime' }}</td>
                        <td class="py-3 px-3 font-bold text-white">{{ log.itemName }}</td>
                        <td class="py-3 px-3 font-black text-red-400">{{ log.quantityWasted }} {{ log.unit }}</td>
                        <td class="py-3 px-3 text-slate-300 italic">{{ log.reason }}</td>
                        <td class="py-3 px-3 text-amber-400 font-bold">{{ log.loggedByEmployeeName }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="py-8 text-center text-slate-500 font-bold">
                          Δεν υπάρχουν καταχωρήσεις φύρας.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        }

      </div>

      <!-- MODAL 1: ADD CATEGORY -->
      @if (showNewCategoryModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">📁 Νέα Κατηγορία Μενού</h3>
              <button (click)="showNewCategoryModal.set(false)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Ονομασία Κατηγορίας</label>
                <input type="text" [(ngModel)]="newCatName" placeholder="π.χ. Σάντουιτς & Πίτσες"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Εικονίδιο / Emoji</label>
                <input type="text" [(ngModel)]="newCatIcon" placeholder="π.χ. 🍕"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="showNewCategoryModal.set(false)" class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="saveNewCategory()" [disabled]="!newCatName.trim()" class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md cursor-pointer">
                ✓ Δημιουργία
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 2: ADD PRODUCT -->
      @if (showNewProductModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">🏷️ Νέο Προϊόν / Είδος POS</h3>
              <button (click)="showNewProductModal.set(false)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Όνομα Προϊόντος</label>
                <input type="text" [(ngModel)]="newProdName" placeholder="π.χ. Cappuccino Diplos"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Κατηγορία</label>
                <select [(ngModel)]="newProdCategoryId" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  @for (cat of posService.categories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Τιμή Πώλησης (€)</label>
                  <input type="number" step="0.1" [(ngModel)]="newProdPrice"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400" />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Κόστος Αγοράς (€)</label>
                  <input type="number" step="0.1" [(ngModel)]="newProdCost"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400" />
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Συντελεστής ΦΠΑ</label>
                <select [(ngModel)]="newProdVat" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  <option [ngValue]="13">13% (Εστίαση & Καφέδες)</option>
                  <option [ngValue]="24">24% (Ποτά & Αλκοόλ)</option>
                  <option [ngValue]="6">6% (Υπερμειωμένος)</option>
                  <option [ngValue]="0">0% (Απαλλαγή)</option>
                </select>
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="showNewProductModal.set(false)" class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="saveNewProduct()" [disabled]="!newProdName.trim() || newProdPrice <= 0" class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md cursor-pointer">
                ✓ Προσθήκη Προϊόντος
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 3: EDIT PRODUCT -->
      @if (editingProduct(); as targetProd) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">✏️ Επεξεργασία Προϊόντος</h3>
              <button (click)="editingProduct.set(null)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Όνομα Προϊόντος</label>
                <input type="text" [(ngModel)]="editProdName"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Κατηγορία</label>
                <select [(ngModel)]="editProdCategoryId" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  @for (cat of posService.categories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Τιμή Πώλησης (€)</label>
                  <input type="number" step="0.1" [(ngModel)]="editProdPrice"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400" />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Κόστος Αγοράς (€)</label>
                  <input type="number" step="0.1" [(ngModel)]="editProdCost"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400" />
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Συντελεστής ΦΠΑ</label>
                <select [(ngModel)]="editProdVat" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  <option [ngValue]="13">13% (Εστίαση & Καφέδες)</option>
                  <option [ngValue]="24">24% (Ποτά & Αλκοόλ)</option>
                  <option [ngValue]="6">6% (Υπερμειωμένος)</option>
                  <option [ngValue]="0">0% (Απαλλαγή)</option>
                </select>
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="editingProduct.set(null)" class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="saveProductEdit()" [disabled]="!editProdName.trim() || editProdPrice <= 0" class="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-black text-slate-950 text-xs shadow-md cursor-pointer">
                ✓ Αποθήκευση Αλλαγών
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 4: ADD OR EDIT TABLE -->
      @if (showTableModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">
                {{ editingTableId() ? '✏️ Επεξεργασία Τραπεζιού' : '🪑 Νέο Τραπέζι' }}
              </h3>
              <button (click)="showTableModal.set(false)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Αριθμός Τραπεζιού</label>
                  <input type="number" [(ngModel)]="tableNumberInput" placeholder="π.χ. 7"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-400" />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Χωρητικότητα (Άτομα)</label>
                  <input type="number" [(ngModel)]="tableSeatsInput" placeholder="4"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400" />
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Ζώνη / Τομέας</label>
                <select [(ngModel)]="tableZoneInput" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  <option value="Σάλα">🏠 Σάλα (INDOOR)</option>
                  <option value="Αυλή">🌿 Αυλή (OUTDOOR)</option>
                  <option value="Bar">☕ Bar</option>
                  <option value="VIP">⭐ VIP / Lounge</option>
                </select>
              </div>

              @if (tableErrorMessage()) {
                <div class="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold text-center">
                  {{ tableErrorMessage() }}
                </div>
              }
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="showTableModal.set(false)" class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="saveTableDetails()" [disabled]="tableNumberInput <= 0" class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md cursor-pointer">
                ✓ Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 5: ADD STAFF -->
      @if (showNewStaffModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">👤 Νέος Υπάλληλος / Manager</h3>
              <button (click)="showNewStaffModal.set(false)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Ονοματεπώνυμο</label>
                <input type="text" [(ngModel)]="newStaffName" placeholder="π.χ. Αλέξης (Barman)"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">PIN Εισόδου (4 - 8 ψηφία)</label>
                  <input type="text" maxlength="8" [(ngModel)]="newStaffPin" placeholder="π.χ. 5555"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold text-center tracking-widest focus:outline-none focus:border-amber-400" />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Ωρομίσθιο (€/h)</label>
                  <input type="number" step="0.5" [(ngModel)]="newStaffHourlyRate"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400" />
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Ρόλος & Δικαιώματα</label>
                <select [(ngModel)]="newStaffRole"
                        class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  <option value="WAITER">Σερβιτόρος (Waiter)</option>
                  <option value="BARISTA">Barman / Μπαρίστα</option>
                  <option value="KITCHEN">Κουζίνα (Kitchen)</option>
                  <option value="MANAGER">Manager / Ιδιοκτήτης</option>
                </select>
              </div>

              @if (staffErrorMessage()) {
                <div class="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold text-center">
                  {{ staffErrorMessage() }}
                </div>
              }
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="showNewStaffModal.set(false)" 
                      class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="saveNewStaff()" 
                      [disabled]="!newStaffName.trim() || newStaffPin.length < 4"
                      class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md cursor-pointer">
                ✓ Δημιουργία & Ενεργοποίηση
              </button>
            </div>

          </div>
        </div>
      }

      <!-- MODAL 6: ADD / EDIT RAW MATERIAL -->
      @if (showRawMaterialModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">
                {{ editingRawMaterialId() ? '✏️ Επεξεργασία Πρώτης Ύλης' : '📥 Νέα Πρώτη Ύλη' }}
              </h3>
              <button (click)="showRawMaterialModal.set(false)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Ονομασία Υλικού</label>
                <input type="text" [(ngModel)]="rawMatNameInput" placeholder="π.χ. Καφές Espresso Beans 1kg"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Μονάδα Μέτρησης</label>
                  <select [(ngModel)]="rawMatUnitInput" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                    <option value="KG">Κιλά (KG)</option>
                    <option value="LITER">Λίτρα (LITER)</option>
                    <option value="PCS">Τεμάχια (PCS)</option>
                    <option value="PACK">Συσκευασίες (PACK)</option>
                  </select>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Αρχικό Απόθεμα</label>
                  <input type="number" step="0.1" [(ngModel)]="rawMatStockInput" placeholder="10.0"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-400" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Όριο Ειδοποίησης (Alert)</label>
                  <input type="number" step="0.1" [(ngModel)]="rawMatAlertInput" placeholder="2.0"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400" />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">Κόστος / Μονάδα (€)</label>
                  <input type="number" step="0.1" [(ngModel)]="rawMatCostInput" placeholder="12.50"
                         class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400" />
                </div>
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="showRawMaterialModal.set(false)" class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="saveRawMaterialDetails()" [disabled]="!rawMatNameInput.trim()" class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md cursor-pointer">
                ✓ Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 7: RAW MATERIAL DIRECT STOCK ADJUSTMENT (ΑΠΟΓΡΑΦΗ) -->
      @if (adjustingRawMaterial(); as mat) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">⚖️ Απογραφή: {{ mat.name }}</h3>
              <button (click)="adjustingRawMaterial.set(null)" class="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl flex justify-between items-center text-xs">
              <span class="text-slate-400 font-bold">Τρέχον Καταγεγραμμένο Υπόλοιπο:</span>
              <span class="font-black text-amber-400 text-sm">{{ mat.currentStock.toFixed(2) }} {{ mat.unit }}</span>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Νέο Καταμετρημένο Απόθεμα ({{ mat.unit }})</label>
                <input type="number" step="0.1" [(ngModel)]="adjustNewStockCount"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-lg font-black text-emerald-400 focus:outline-none focus:border-amber-400" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Αιτιολογία Απογραφής / Διόρθωσης</label>
                <input type="text" [(ngModel)]="adjustReasonInput" placeholder="π.χ. Τακτική καταμέτρηση τέλους μήνα"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="adjustingRawMaterial.set(null)" class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs cursor-pointer">
                Ακύρωση
              </button>
              <button (click)="confirmStockAdjustment()" class="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-black text-slate-950 text-xs shadow-md cursor-pointer">
                ✓ Ενημέρωση Απογραφής
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class InventoryManagementComponent {
  public posService = inject(RestaurantPosService);

  public activeTab = signal<'RECEIVING' | 'STOCK' | 'TABLES' | 'STAFF' | 'SPOILAGE'>('RECEIVING');
  public isRegisteringBiometrics = signal<boolean>(false);

  // Receiving Tab Fields
  public receivingItemName = '';
  public receivingQuantity = 1;
  public receivingUnit: 'KG' | 'LITER' | 'PCS' | 'PACK' = 'KG';
  public receivingUnitPrice = 0;
  public receivingVat = 13;

  // Spoilage Tab Fields
  public spoilageItemName = '';
  public spoilageQty = 1;
  public spoilageUnit = 'KG';
  public spoilageReason = '';

  // Category Modal Fields
  public showNewCategoryModal = signal<boolean>(false);
  public newCatName = '';
  public newCatIcon = '📁';

  // Product Modal Fields
  public showNewProductModal = signal<boolean>(false);
  public newProdName = '';
  public newProdCategoryId = '';
  public newProdPrice = 0;
  public newProdCost = 0;
  public newProdVat = 13;

  // Edit Product Modal Fields
  public editingProduct = signal<Product | null>(null);
  public editProdName = '';
  public editProdCategoryId = '';
  public editProdPrice = 0;
  public editProdCost = 0;
  public editProdVat = 13;

  // Table Modal Fields
  public showTableModal = signal<boolean>(false);
  public editingTableId = signal<string | null>(null);
  public tableNumberInput = 1;
  public tableSeatsInput = 4;
  public tableZoneInput = 'Σάλα';
  public tableErrorMessage = signal<string>('');

  // Staff Modal Fields
  public showNewStaffModal = signal<boolean>(false);
  public newStaffName = '';
  public newStaffPin = '';
  public newStaffRole: Role = 'WAITER';
  public newStaffHourlyRate = 7.0;
  public staffErrorMessage = signal<string>('');

  // Raw Material Modal Fields
  public showRawMaterialModal = signal<boolean>(false);
  public editingRawMaterialId = signal<string | null>(null);
  public rawMatNameInput = '';
  public rawMatUnitInput: 'KG' | 'LITER' | 'PCS' | 'PACK' = 'KG';
  public rawMatStockInput = 10;
  public rawMatAlertInput = 2;
  public rawMatCostInput = 5;

  // Stock Adjustment Modal Fields
  public adjustingRawMaterial = signal<RawMaterial | null>(null);
  public adjustNewStockCount = 0;
  public adjustReasonInput = '';

  public getRoleLabel(role: Role): string {
    switch (role) {
      case 'WAITER': return 'Σερβιτόρος';
      case 'BAR':
      case 'BARISTA': return 'Barman / Barista';
      case 'KITCHEN': return 'Κουζίνα';
      case 'MANAGER':
      case 'ADMIN': return 'Manager / Ιδιοκτήτης';
      default: return role;
    }
  }

 public addMaterialStock(): void {
  if (!this.receivingItemName.trim() || this.receivingQuantity <= 0) return;

  this.posService.recordGoodsReceiving({
    itemName: this.receivingItemName.trim(), // 👈 Change 'itemName' to 'name'
    quantity: this.receivingQuantity,
    unit: this.receivingUnit,
    unitPrice: this.receivingUnitPrice,
    vatRate: Number(this.receivingVat) || 13
  });

  this.receivingItemName = '';
  this.receivingQuantity = 1;
  this.receivingUnitPrice = 0;
}

  public logSpoilageEntry(): void {
  if (!this.spoilageItemName.trim()) return;

  this.posService.logSpoilage({
    itemName: this.spoilageItemName.trim(),
    quantityWasted: Number(this.spoilageQty) || 1,
    unit: this.spoilageUnit as UnitOfMeasure, // 👈 Cast to UnitOfMeasure
    reason: this.spoilageReason.trim() || 'Φύρα / Ζημιά'
  });

  this.spoilageItemName = '';
  this.spoilageQty = 1;
  this.spoilageReason = '';
}

 public saveNewCategory(): void {
  if (!this.newCatName.trim()) return;

  // 👈 Pass name and icon as two separate string arguments:
  this.posService.addCategory(
    this.newCatName.trim(), 
    this.newCatIcon.trim() || '📁'
  );

  this.newCatName = '';
  this.newCatIcon = '📁';
  this.showNewCategoryModal.set(false);
}

  public deleteCategory(id: string): void {
    if (confirm('Είστε βέβαιοι για τη διαγραφή της κατηγορίας;')) {
      this.posService.deleteCategory(id);
    }
  }

  public saveNewProduct(): void {
    if (!this.newProdName.trim()) return;

    this.posService.addProduct({
  name: this.newProdName.trim(),
  categoryId: this.newProdCategoryId || (this.posService.categories()[0]?.id ?? 'CAT-COFFEE'),
  price: Number(this.newProdPrice) || 0,
  purchasePrice: Number(this.newProdCost) || 0,
  taxRate: (Number(this.newProdVat) || 13) as GreekVatRate, // 👈 Cast as GreekVatRate
  isPinnedToPOS: true
});

    this.newProdName = '';
    this.newProdPrice = 0;
    this.newProdCost = 0;
    this.showNewProductModal.set(false);
  }

  public openEditProductModal(prod: Product): void {
    this.editingProduct.set(prod);
    this.editProdName = prod.name;
    this.editProdCategoryId = prod.categoryId;
    this.editProdPrice = prod.price;
    this.editProdCost = prod.purchasePrice || prod.costPrice || 0;
    this.editProdVat = prod.taxRate || 13;
  }

  public saveProductEdit(): void {
    const prod = this.editingProduct();
    if (!prod || !this.editProdName.trim()) return;

   this.posService.updateProduct(prod.id, {
  name: this.editProdName.trim(),
  categoryId: this.editProdCategoryId,
  price: Number(this.editProdPrice) || 0,
  costPrice: Number(this.editProdCost) || 0,
  taxRate: (Number(this.editProdVat) || 13) as GreekVatRate // 👈 Cast as GreekVatRate
});

    this.editingProduct.set(null);
  }

  public deleteProduct(id: string): void {
    if (confirm('Διαγραφή προϊόντος από τον τιμοκατάλογο;')) {
      this.posService.deleteProduct(id);
    }
  }

  public openNewTableModal(): void {
    this.editingTableId.set(null);
    this.tableNumberInput = (this.posService.tables().length || 0) + 1;
    this.tableSeatsInput = 4;
    this.tableZoneInput = 'Σάλα';
    this.tableErrorMessage.set('');
    this.showTableModal.set(true);
  }

  public openEditTableModal(table: RestaurantTable): void {
    this.editingTableId.set(table.id);
    this.tableNumberInput = table.number || table.tableNumber || 1;
    this.tableSeatsInput = table.seats || table.capacity || 4;
    this.tableZoneInput = table.zone || table.section || 'Σάλα';
    this.tableErrorMessage.set('');
    this.showTableModal.set(true);
  }

 public saveTableDetails(): void {
  const targetId = this.editingTableId();
  // Map Greek UI zones to English sections if needed
  const section = this.tableZoneInput === 'Αυλή' ? 'OUTDOOR' : this.tableZoneInput === 'Bar' ? 'BAR' : this.tableZoneInput === 'VIP' ? 'VIP' : 'INDOOR';

  if (targetId) {
    // 👈 Removed 'capacity' and 'tableNumber'
    this.posService.updateTable(targetId, {
      number: this.tableNumberInput,
      seats: this.tableSeatsInput,
      zone: this.tableZoneInput,
      section: section
    });
    this.showTableModal.set(false);
  } else {
    // 👈 Removed 'capacity'
    const result = this.posService.addTable({
      number: this.tableNumberInput,
      seats: this.tableSeatsInput,
      zone: this.tableZoneInput,
      section: section
    });

    if (result.success) {
      this.showTableModal.set(false);
    } else {
      this.tableErrorMessage.set(result.message);
    }
  }
}

  public deleteTable(id: string): void {
    if (confirm('Διαγραφή τραπεζιού;')) {
      this.posService.deleteTable(id);
    }
  }

  public saveNewStaff(): void {
    if (!this.newStaffName.trim() || this.newStaffPin.length < 4) {
      this.staffErrorMessage.set('Το όνομα και το PIN (4-8 ψηφία) είναι υποχρεωτικά.');
      return;
    }

    const res = this.posService.addEmployee({
      name: this.newStaffName.trim(),
      pinCode: this.newStaffPin.trim(),
      role: this.newStaffRole,
      hourlyRate: Number(this.newStaffHourlyRate) || 7.0
    });

    if (res.success) {
      this.newStaffName = '';
      this.newStaffPin = '';
      this.staffErrorMessage.set('');
      this.showNewStaffModal.set(false);
    } else {
      this.staffErrorMessage.set(res.message);
    }
  }

  public toggleEmployeeStatus(id: string, active: boolean): void {
    this.posService.toggleEmployeeActiveStatus(id, active);
  }

  public async onRegisterFingerprint(emp: Employee): Promise<void> {
    this.isRegisteringBiometrics.set(true);
    try {
      const result = await this.posService.registerEmployeeBiometrics(emp);
      alert(result.message);
    } catch (err) {
      alert('Αποτυχία καταχώρησης αποτυπώματος.');
    } finally {
      this.isRegisteringBiometrics.set(false);
    }
  }

  public openNewRawMaterialModal(): void {
    this.editingRawMaterialId.set(null);
    this.rawMatNameInput = '';
    this.rawMatUnitInput = 'KG';
    this.rawMatStockInput = 10;
    this.rawMatAlertInput = 2;
    this.rawMatCostInput = 5;
    this.showRawMaterialModal.set(true);
  }

  public openEditRawMaterialModal(mat: RawMaterial): void {
    this.editingRawMaterialId.set(mat.id);
    this.rawMatNameInput = mat.name;
    this.rawMatUnitInput = mat.unit as any;
    this.rawMatStockInput = mat.currentStock;
    this.rawMatAlertInput = mat.minAlertStock;
    this.rawMatCostInput = mat.costPerUnit;
    this.showRawMaterialModal.set(true);
  }

  public saveRawMaterialDetails(): void {
    if (!this.rawMatNameInput.trim()) return;

    const id = this.editingRawMaterialId();
    if (id) {
      this.posService.updateRawMaterial(id, {
        name: this.rawMatNameInput.trim(),
        unit: this.rawMatUnitInput,
        currentStock: Number(this.rawMatStockInput) || 0,
        minAlertStock: Number(this.rawMatAlertInput) || 0,
        costPerUnit: Number(this.rawMatCostInput) || 0
      });
    } else {
      this.posService.addRawMaterial({
        name: this.rawMatNameInput.trim(),
        unit: this.rawMatUnitInput,
        currentStock: Number(this.rawMatStockInput) || 0,
        minAlertStock: Number(this.rawMatAlertInput) || 0,
        costPerUnit: Number(this.rawMatCostInput) || 0
      });
    }

    this.showRawMaterialModal.set(false);
  }

  public deleteRawMaterial(id: string): void {
    if (confirm('Διαγραφή πρώτης ύλης;')) {
      this.posService.deleteRawMaterial(id);
    }
  }

  public openStockAdjustModal(mat: RawMaterial): void {
    this.adjustingRawMaterial.set(mat);
    this.adjustNewStockCount = mat.currentStock;
    this.adjustReasonInput = 'Τακτική απογραφή';
  }

  public confirmStockAdjustment(): void {
    const mat = this.adjustingRawMaterial();
    if (!mat) return;

    this.posService.adjustRawMaterialStock(
      mat.id, 
      Number(this.adjustNewStockCount) || 0, 
      this.adjustReasonInput.trim() || 'Διόρθωση απογραφής'
    );

    this.adjustingRawMaterial.set(null);
  }

  public triggerFreshStartReset(): void {
    if (confirm('🔥 ΠΡΟΣΟΧΗ: Θέλετε να πραγματοποιήσετε Fresh Start Reset;')) {
      this.posService.resetDatabaseToDefaults();
    }
  }
}