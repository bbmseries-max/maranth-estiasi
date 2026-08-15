// src/app/core/modals/modifier.modal.ts

export interface ModifierOption {
  id: string;
  storeId?: string;
  tenantId?: string;
  name: string;
  priceExtra?: number;
  available?: boolean;
}

export interface ModifierGroup {
  id: string;
  tenantId?: string;
  storeId?: string;
  name: string;
  required?: boolean;
  minSelect?: number;        // 0 = optional, 1 = required
  maxSelect?: number;        // Max allowed selections (e.g. 5)
  minSelections?: number;    // Compatibility alias
  maxSelections?: number;    // Compatibility alias
  options: ModifierOption[];
}

export interface SelectedModifier {
  groupId?: string;
  storeId?: string;
  tenantId?: string;
  groupName?: string;
  optionId?: string;
  optionName?: string;
  id?: string;
  name?: string;
  priceExtra?: number;
  price?: number;
}