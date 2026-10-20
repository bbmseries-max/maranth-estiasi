// src/app/shared/components/tenant-switcher/tenant-switcher.component.ts

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantContextService, StoreProfile } from '../../core/services/tenant-context.service';

@Component({
  selector: 'app-tenant-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-2 bg-slate-800/90 p-2 rounded-xl border border-slate-700">
      <label for="tenantSelect" class="text-xs text-slate-400 font-bold uppercase tracking-wider">
        Κατάστημα:
      </label>
      <select 
        id="tenantSelect"
        [value]="tenantContext.currentTenantId()" 
        (change)="onTenantChange($event)"
        class="bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-amber-500 cursor-pointer">
        @for (store of tenantContext.registeredStores; track store.tenantId + store.storeId) {
          <option [value]="store.tenantId">
            {{ store.icon }} {{ store.name }} ({{ store.city }})
          </option>
        }
      </select>
    </div>
  `
})
export class TenantSwitcherComponent {
  public tenantContext = inject(TenantContextService);

  public onTenantChange(event: Event): void {
    const selectedTenantId = (event.target as HTMLSelectElement).value;
    const currentTenantId = this.tenantContext.currentTenantId();

    if (selectedTenantId === currentTenantId) return;

    const matchedStore = this.tenantContext.registeredStores.find(
      s => s.tenantId === selectedTenantId
    );

    const storeId = matchedStore ? matchedStore.storeId : 'store-1';
    this.tenantContext.setTenantAndStore(selectedTenantId, storeId);
  }
}