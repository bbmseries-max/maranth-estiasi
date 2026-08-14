export interface Category {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}
