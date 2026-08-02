import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RestaurantPosService } from '../../core/services/restaurant-pos.service';
import { 
  RawMaterial, 
  SpoilageLog, 
  UnitOfMeasure, 
  GreekVatRate,
  EmployeeRole
} from '../../core/models/restaurant-pos.models';

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      <!-- TOP NAVIGATION BAR -->
      <header class="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shadow-lg">
        <div class="flex items-center gap-4">
          <a routerLink="/floor-plan" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs no-underline flex items-center gap-1.5 transition-all">
            <span>⬅️</span>
            <span>Πλάνο</span>
          </a>
          <div>
            <h1 class="text-lg font-black text-white m-0 flex items-center gap-2">
              <span>📦</span>
              <span>Διαχείριση Αποθήκης & Προσωπικού</span>
            </h1>
            <span class="text-[10px] text-amber-400 font-bold">Πρώτες Ύλες, Τιμοκατάλογος, Ζημιές & PINs</span>
          </div>
        </div>

        <!-- TAB SELECTOR BUTTONS -->
        <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <button (click)="activeTab.set('RECEIVING')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap"
                  [ngClass]="activeTab() === 'RECEIVING' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            📥 Παραλαβή Τιμολογίου
          </button>
          <button (click)="activeTab.set('STOCK')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap"
                  [ngClass]="activeTab() === 'STOCK' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🏷️ Τιμοκατάλογος & ΦΠΑ
          </button>
          <button (click)="activeTab.set('STAFF')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap"
                  [ngClass]="activeTab() === 'STAFF' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            👥 Προσωπικό & PINs
          </button>
          <button (click)="activeTab.set('SPOILAGE')"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap"
                  [ngClass]="activeTab() === 'SPOILAGE' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'">
            🗑️ Φύρα & Ζημιές
          </button>
        </div>
      </header>

      <div class="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
        
        <!-- TAB 1: GOODS RECEIVING INVOICE FORM -->
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
                      class="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs transition-all shadow-md active:scale-95 mt-2">
                ✓ Ενημέρωση Αποθέματος
              </button>
            </div>

            <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <div class="flex justify-between items-center">
                <h2 class="text-sm font-black text-white uppercase tracking-wider m-0">📋 Υπόλοιπα Πρώτων Υλών</h2>
                <span class="text-xs font-bold text-amber-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                  {{ rawMaterials().length }} Υλικά
                </span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-2.5 px-3">Υλικό</th>
                      <th class="py-2.5 px-3">Μονάδα</th>
                      <th class="py-2.5 px-3">Απόθεμα</th>
                      <th class="py-2.5 px-3">Κόστος / Μον.</th>
                      <th class="py-2.5 px-3">Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (mat of rawMaterials(); track mat.id) {
                      <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        <td class="py-3 px-3 font-bold text-white">{{ mat.name }}</td>
                        <td class="py-3 px-3 text-slate-400 font-medium">{{ mat.unit }}</td>
                        <td class="py-3 px-3 font-black text-amber-400">{{ mat.currentStock.toFixed(2) }}</td>
                        <td class="py-3 px-3 text-emerald-400 font-bold">€{{ mat.costPerUnit.toFixed(2) }}</td>
                        <td class="py-3 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                                [ngClass]="mat.currentStock <= mat.minAlertStock ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'">
                            {{ mat.currentStock <= mat.minAlertStock ? '⚠️ Χαμηλό' : 'OK' }}
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="py-8 text-center text-slate-500 font-bold">
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

        <!-- TAB 2: MENU PRODUCTS CATALOG & CREATOR -->
        @if (activeTab() === 'STOCK') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">🏷️ Τιμοκατάλογος & Προϊόντα POS</h2>
                <span class="text-xs text-slate-400">Διαχείριση λιανικής τιμής, συντελεστών ΦΠΑ και προσθήκη νέων ειδών (π.χ. Burger, Τσάι)</span>
              </div>

              <button (click)="showNewProductModal.set(true)"
                      class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
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
                    <th class="py-2.5 px-3">Τιμή Λιανικής</th>
                    <th class="py-2.5 px-3">Κόστος Αγοράς</th>
                    <th class="py-2.5 px-3">ΦΠΑ</th>
                    <th class="py-2.5 px-3">Κατάσταση</th>
                  </tr>
                </thead>
                <tbody>
                  @for (prod of posService.products(); track prod.id) {
                    <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3 font-bold text-white">{{ prod.name }}</td>
                      <td class="py-3 px-3 text-slate-400 font-medium">{{ prod.categoryName }}</td>
                      <td class="py-3 px-3 font-black text-emerald-400">€{{ prod.price.toFixed(2) }}</td>
                      <td class="py-3 px-3 text-slate-300 font-bold">€{{ prod.purchasePrice.toFixed(2) }}</td>
                      <td class="py-3 px-3 font-bold text-amber-400">{{ prod.taxRate }}%</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          Ενεργό
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- TAB 3: STAFF & PIN MANAGEMENT -->
        @if (activeTab() === 'STAFF') {
          <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-base font-black text-white uppercase tracking-wider m-0">👥 Διαχείριση Προσωπικού & PINs</h2>
                <span class="text-xs text-slate-400">Προσθήκη νέων υπαλλήλων, ορισμός 4-ψήφιων PIN, ρόλων & αποδέσμευση/απόλυση</span>
              </div>

              <button (click)="showNewStaffModal.set(true)"
                      class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
                <span>➕</span>
                <span>Νέος Υπάλληλος / Manager</span>
              </button>
            </div>

            <!-- STAFF MEMBERS TABLE -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-2.5 px-3">Ονοματεπώνυμο</th>
                    <th class="py-2.5 px-3">Ρόλος</th>
                    <th class="py-2.5 px-3">PIN Εισόδου</th>
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
                        •••• ({{ emp.pinCode }})
                      </td>
                      <td class="py-3 px-3 text-emerald-400 font-bold">€{{ emp.hourlyRate.toFixed(2) }}</td>
                      <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black border"
                              [ngClass]="emp.isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40'">
                          {{ emp.isActive ? '🟢 Ενεργός' : '🔴 Ανενεργός (Απολυμένος)' }}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right">
                        @if (emp.isActive) {
                          <button (click)="toggleEmployeeStatus(emp.id, false)"
                                  class="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/40 text-[10px] font-bold transition-all active:scale-95">
                            🚫 Αποδέσμευση (Απόλυση)
                          </button>
                        } @else {
                          <button (click)="toggleEmployeeStatus(emp.id, true)"
                                  class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold transition-all active:scale-95">
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

        <!-- TAB 4: SPOILAGE LOGS -->
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
                      class="py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs transition-all shadow-md active:scale-95 mt-2">
                🗑️ Καταγραφή Ζημιάς
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
                    @for (log of spoilageLogs(); track log.id) {
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

      <!-- MODAL 1: ADD NEW MENU PRODUCT -->
      @if (showNewProductModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">➕ Προσθήκη Νέου Είδους</h3>
              <button (click)="showNewProductModal.set(false)" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Όνομα Προϊόντος</label>
                <input type="text" [(ngModel)]="newProdName" placeholder="π.χ. Τσάι Βουνού ή Burger Bacon"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Κατηγορία</label>
                <select [(ngModel)]="newProdCategoryId"
                        class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  @for (cat of posService.categories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.name }}</option>
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
                <select [(ngModel)]="newProdVat"
                        class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400">
                  <option [ngValue]="13">13% (Εστίαση & Καφές)</option>
                  <option [ngValue]="24">24% (Ποτά & Αλκοόλ)</option>
                  <option [ngValue]="6">6% (Υπερμειωμένος)</option>
                  <option [ngValue]="0">0% (Απαλλαγή)</option>
                </select>
              </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-700">
              <button (click)="showNewProductModal.set(false)" 
                      class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs">
                Ακύρωση
              </button>
              <button (click)="saveNewProduct()" 
                      [disabled]="!newProdName.trim() || newProdPrice <= 0"
                      class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md">
                ✓ Αποθήκευση & Εμφάνιση στο POS
              </button>
            </div>

          </div>
        </div>
      }

      <!-- MODAL 2: ADD NEW STAFF MEMBER / MANAGER -->
      @if (showNewStaffModal()) {
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            
            <div class="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 class="text-lg font-black text-white m-0">👤 Νέος Υπάλληλος / Manager</h3>
              <button (click)="showNewStaffModal.set(false)" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] font-bold text-slate-400 uppercase">Ονοματεπώνυμο</label>
                <input type="text" [(ngModel)]="newStaffName" placeholder="π.χ. Κώστας (Σερβιτόρος)"
                       class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-[11px] font-bold text-slate-400 uppercase">4-ψήφιο PIN</label>
                  <input type="text" maxlength="4" [(ngModel)]="newStaffPin" placeholder="π.χ. 4444"
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
                  <option value="BARISTA">Μπαρίστα (Barista)</option>
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
                      class="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-slate-200 text-xs">
                Ακύρωση
              </button>
              <button (click)="saveNewStaff()" 
                      [disabled]="!newStaffName.trim() || newStaffPin.length < 4"
                      class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-white text-xs shadow-md">
                ✓ Δημιουργία & Ενεργοποίηση
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
  public activeTab = signal<'RECEIVING' | 'STOCK' | 'STAFF' | 'SPOILAGE'>('RECEIVING');
  public showNewProductModal = signal<boolean>(false);
  public showNewStaffModal = signal<boolean>(false);

  // New Product Form Models
  public newProdName = '';
  public newProdCategoryId = 'CAT-COFFEE';
  public newProdPrice: number = 3.50;
  public newProdCost: number = 0.80;
  public newProdVat: GreekVatRate = 13;

  // New Staff Form Models
  public newStaffName = '';
  public newStaffPin = '';
  public newStaffRole: EmployeeRole = 'WAITER';
  public newStaffHourlyRate: number = 7.00;
  public staffErrorMessage = signal<string>('');

  public rawMaterials = signal<RawMaterial[]>([
    { id: 'RM-01', name: 'Καφές Espresso Beans 1kg', unit: 'KG', currentStock: 12.5, minAlertStock: 3.0, costPerUnit: 14.50 },
    { id: 'RM-02', name: 'Γάλα Πλήρες 1.5% 1L', unit: 'LITER', currentStock: 24.0, minAlertStock: 5.0, costPerUnit: 1.10 },
    { id: 'RM-03', name: 'Γάλα Βρώμης 1L', unit: 'LITER', currentStock: 8.0, minAlertStock: 2.0, costPerUnit: 1.80 },
    { id: 'RM-04', name: 'Ψωμί Τοστ 500g', unit: 'PACK', currentStock: 10.0, minAlertStock: 2.0, costPerUnit: 1.40 }
  ]);

  public spoilageLogs = signal<SpoilageLog[]>([]);

  // Goods Receiving Form
  public receivingItemName = '';
  public receivingQuantity: number = 1;
  public receivingUnit: UnitOfMeasure = 'KG';
  public receivingUnitPrice: number = 0;
  public receivingVat: GreekVatRate = 13;

  // Spoilage Form
  public spoilageItemName = '';
  public spoilageQty: number = 1;
  public spoilageUnit: UnitOfMeasure = 'KG';
  public spoilageReason = '';

  public getRoleLabel(role: EmployeeRole): string {
    switch (role) {
      case 'MANAGER':
      case 'ADMIN': return 'Manager / Owner';
      case 'WAITER': return 'Σερβιτόρος';
      case 'BARISTA': return 'Barista';
      case 'KITCHEN': return 'Κουζίνα';
      default: return role;
    }
  }

  public saveNewProduct(): void {
    if (!this.newProdName.trim() || this.newProdPrice <= 0) return;

    this.posService.addProduct({
      name: this.newProdName.trim(),
      categoryId: this.newProdCategoryId,
      price: this.newProdPrice,
      purchasePrice: this.newProdCost,
      taxRate: this.newProdVat,
      isPinnedToPOS: true
    });

    this.showNewProductModal.set(false);
    this.newProdName = '';
    this.newProdPrice = 3.50;
    this.newProdCost = 0.80;
  }

  public saveNewStaff(): void {
    if (!this.newStaffName.trim() || this.newStaffPin.length < 4) {
      this.staffErrorMessage.set('Το PIN πρέπει να είναι ακριβώς 4 ψηφία.');
      return;
    }

    const result = this.posService.addEmployee({
      name: this.newStaffName.trim(),
      pinCode: this.newStaffPin.trim(),
      role: this.newStaffRole,
      hourlyRate: this.newStaffHourlyRate
    });

    if (result.success) {
      this.showNewStaffModal.set(false);
      this.newStaffName = '';
      this.newStaffPin = '';
      this.newStaffHourlyRate = 7.00;
      this.staffErrorMessage.set('');
    } else {
      this.staffErrorMessage.set(result.message);
    }
  }

  public toggleEmployeeStatus(empId: string, isActive: boolean): void {
    this.posService.toggleEmployeeActiveStatus(empId, isActive);
  }

  public addMaterialStock(): void {
    if (!this.receivingItemName.trim() || this.receivingQuantity <= 0) return;

    const existing = this.rawMaterials().find(m => m.name.toLowerCase() === this.receivingItemName.trim().toLowerCase());

    if (existing) {
      const updated = this.rawMaterials().map(m => {
        if (m.id === existing.id) {
          return {
            ...m,
            currentStock: m.currentStock + this.receivingQuantity,
            costPerUnit: this.receivingUnitPrice > 0 ? this.receivingUnitPrice : m.costPerUnit
          };
        }
        return m;
      });
      this.rawMaterials.set(updated);
    } else {
      const newMat: RawMaterial = {
        id: `RM-${Date.now()}`,
        name: this.receivingItemName.trim(),
        unit: this.receivingUnit,
        currentStock: this.receivingQuantity,
        minAlertStock: 2.0,
        costPerUnit: this.receivingUnitPrice
      };
      this.rawMaterials.set([...this.rawMaterials(), newMat]);
    }

    this.receivingItemName = '';
    this.receivingQuantity = 1;
    this.receivingUnitPrice = 0;
  }

  public logSpoilageEntry(): void {
    if (!this.spoilageItemName.trim() || this.spoilageQty <= 0) return;

    const emp = this.posService.currentEmployee() || { id: 'SYSTEM', name: 'Υπάλληλος' };

    const newLog: SpoilageLog = {
      id: `SPOIL-${Date.now()}`,
      itemId: `ITEM-${Date.now()}`,
      itemName: this.spoilageItemName.trim(),
      quantityWasted: this.spoilageQty,
      unit: this.spoilageUnit,
      costLossNet: 0,
      reason: this.spoilageReason.trim() || 'Φύρα',
      loggedByEmployeeId: emp.id,
      loggedByEmployeeName: emp.name,
      timestamp: new Date().toISOString()
    };

    this.spoilageLogs.set([newLog, ...this.spoilageLogs()]);

    this.spoilageItemName = '';
    this.spoilageQty = 1;
    this.spoilageReason = '';
  }
}