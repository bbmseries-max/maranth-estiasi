// src/app/core/services/menu.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';
import { Category, Product, ModifierGroup } from '../modals';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private firestore = inject(Firestore);
  private tenantContext = inject(TenantContextService);

  public getCategories(): Observable<Category[]> {
    const tenantId = this.tenantContext.currentTenantId();
    const catRef = collection(this.firestore, `tenants/${tenantId}/categories`);
    return collectionData(catRef, { idField: 'id' }) as Observable<Category[]>;
  }

  public getProducts(): Observable<Product[]> {
    const tenantId = this.tenantContext.currentTenantId();
    const prodRef = collection(this.firestore, `tenants/${tenantId}/products`);
    return collectionData(prodRef, { idField: 'id' }) as Observable<Product[]>;
  }

  public getModifierGroups(): Observable<ModifierGroup[]> {
    const tenantId = this.tenantContext.currentTenantId();
    const modRef = collection(this.firestore, `tenants/${tenantId}/modifierGroups`);
    return collectionData(modRef, { idField: 'id' }) as Observable<ModifierGroup[]>;
  }
}