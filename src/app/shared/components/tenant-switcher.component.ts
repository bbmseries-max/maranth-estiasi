// src/app/shared/components/tenant-switcher/tenant-switcher.component.ts

import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantContextService } from '../../core/services/tenant-context.service'; 

interface TenantOption {
  id: string;
  name: string;
  storeId: string;
}

@Component({
  selector: 'app-tenant-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-2 bg-slate-800/90 p-2 rounded-xl border border-slate-700">
      <label class="text-xs text-slate-400 font-bold uppercase tracking-wider">Κατάστημα:</label>
      <select 
        [value]="tenantContext.currentTenantId()" 
        (change)="onTenantChange($event)"
        class="bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-amber-500 cursor-pointer">
        
        <!-- Render available stores dynamically -->
        @for (opt of availableTenants(); track opt.id) {
          <option [value]="opt.id">{{ opt.name }}</option>
        }
      </select>
    </div>
  `
})
export class TenantSwitcherComponent {
  public tenantContext = inject(TenantContextService);

  private presetTenants: TenantOption[] = [
    { id: 'coffee-shop-demo', name: '☕ Coffee Shop Demo', storeId: 'store-1' },
    { id: 'Tirane kafe 1974', name: '📍 Tirane kafe 1974', storeId: 'store-2' },
    { id: 'mothership-estiasi', name: '🏛️ Mothership Estiasi', storeId: 'store-1' },
    { id: 'beach-bar-client', name: '🏖️ Beach Bar Client', storeId: 'store-1' }
  ];

  public availableTenants = computed<TenantOption[]>(() => {
    const current = this.tenantContext.currentTenantId();
    const storeId = this.tenantContext.currentStoreId();

    const list = [...this.presetTenants];

    // If current store is custom and not in preset list, add it dynamically
    if (current && !list.some(t => t.id === current)) {
      list.unshift({
        id: current,
        name: `📍 ${current}`,
        storeId: storeId || 'store-1'
      });
    }

    return list;
  });

  public onTenantChange(event: Event): void {
    const selectedId = (event.target as HTMLSelectElement).value;
    const match = this.availableTenants().find(t => t.id === selectedId);
    
    const storeId = match?.storeId || 'store-1';
    this.tenantContext.setTenantAndStore(selectedId, storeId);
  }
}