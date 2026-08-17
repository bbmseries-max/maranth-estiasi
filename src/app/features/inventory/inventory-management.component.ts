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
  templateUrl: `./inventory-management.component.html`
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
  public tableNumberInput: string = '1';
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

  private getInitialTab(): 'RECEIVING' | 'STOCK' | 'TABLES' | 'STAFF' | 'SPOILAGE' {
    const saved = sessionStorage.getItem('inv_active_tab') as any;
    return ['RECEIVING', 'STOCK', 'TABLES', 'STAFF', 'SPOILAGE'].includes(saved) ? saved : 'RECEIVING';
  }

  public setTab(tab: 'RECEIVING' | 'STOCK' | 'TABLES' | 'STAFF' | 'SPOILAGE'): void {
    this.activeTab.set(tab);
    sessionStorage.setItem('inv_active_tab', tab);
  }

  public openNewTableModal(): void {
    this.editingTableId.set(null);
    this.tableNumberInput = String((this.posService.tables().length || 0) + 1);
    this.tableSeatsInput = 4;
    this.tableZoneInput = 'Σάλα';
    this.tableErrorMessage.set('');
    this.showTableModal.set(true);
  }

  // 3. Update openEditTableModal
  public openEditTableModal(table: RestaurantTable): void {
    this.editingTableId.set(table.id);
    this.tableNumberInput = String(table.number || table.tableNumber || '1');
    this.tableSeatsInput = table.seats || table.capacity || 4;
    this.tableZoneInput = table.zone || table.section || 'Σάλα';
    this.tableErrorMessage.set('');
    this.showTableModal.set(true);
  }

public saveTableDetails(): void {
    const targetId = this.editingTableId();
    const cleanNumber = this.tableNumberInput.trim().toUpperCase();

    if (!cleanNumber) {
      this.tableErrorMessage.set('Ο αριθμός / κωδικός τραπεζιού είναι υποχρεωτικός.');
      return;
    }

    const section = this.tableZoneInput === 'Αυλή' ? 'OUTDOOR' : 
                    this.tableZoneInput === 'Bar' ? 'BAR' : 
                    this.tableZoneInput === 'VIP' ? 'VIP' : 'INDOOR';

    if (targetId) {
      this.posService.updateTable(targetId, {
        number: cleanNumber,
        seats: Number(this.tableSeatsInput) || 4,
        zone: this.tableZoneInput,
        section: section
      });
      this.showTableModal.set(false);
    } else {
      const result = this.posService.addTable({
        number: cleanNumber,
        seats: Number(this.tableSeatsInput) || 4,
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