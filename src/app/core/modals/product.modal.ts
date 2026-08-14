import { GreekVatRate, UnitOfMeasure } from './common.modal';
import { SelectedModifier } from './modifier.modal';

export interface RecipeIngredient {
  rawMaterialId: string;
  storeId: string;
  rawMaterialName: string;
  quantityUsed: number;
  unit: UnitOfMeasure;
}

export interface Product {
  id: string;
  storeId?: string;
  tenantId?: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  price: number;
  purchasePrice?: number;
  costPrice?: number;
  taxRate: GreekVatRate;
  stockCount?: number;
  isPinnedToPOS?: boolean;
  isActive?: boolean;
  modifierGroupIds?: string[];
  selectedModifiers?: SelectedModifier[];
  recipeIngredients?: RecipeIngredient[];
}

// Re-export modifier interfaces so imports from product.model remain valid
// export { ModifierOption, ModifierGroup, SelectedModifier };