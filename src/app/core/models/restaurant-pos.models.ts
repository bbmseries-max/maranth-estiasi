// ==========================================
// Types & Enums
// ==========================================
export type UnitOfMeasure = 'KG' | 'LITER' | 'PCS' | 'PACK';
export type Role = 'MANAGER' | 'WAITER' | 'KITCHEN' | 'BAR' | 'ADMIN' | 'BARISTA';
export type EmployeeRole = Role;
export type KdsOrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
export type GreekVatRate = 13 | 24 | 0;
export type ItemPreparationStatus = 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'SERVED' | 'VOIDED';
export type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'SERVED';

// ==========================================
// Order & Product Interfaces
// ==========================================
export interface OrderModifier {
  id: string;
  name: string;
  priceExtra: number;
  category?: string;
  notes?: string;
}

export interface TableOrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  taxRate: GreekVatRate;
  modifiers?: OrderModifier[];
  finalItemPrice: number;
  itemNotes?: string;
  orderedByWaiterId: string;
  orderedByWaiterName: string;
  timestamp: string;
  status: ItemPreparationStatus;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
}

export interface ActiveOrder {
  id?: string;
  orderId: string;
  openedAt: string;
  tableNumber?: number;
  items: TableOrderItem[];
  subtotalNet: number;
  totalTax: number;
  grandTotal: number;
  notes?: string;
}

// ==========================================
// KDS Specific Interfaces
// ==========================================
export interface KdsOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string | Date;
}

export interface KdsOrder {
  id: string;
  orderId?: string;
  tableNumber: number | string;
  waiterName: string;
  createdAt: string | Date;
  status: KdsOrderStatus;
  items: KdsOrderItem[];
  isCancelled?: boolean;
  cancelReason?: string;
  isAcknowledged?: boolean;
}

// ==========================================
// Restaurant Floor & Staff Interfaces
// ==========================================
export interface Table {
  id: string;
  number: number;
  tableNumber?: number;
  name?: string;
  seats: number;
  capacity?: number;
  section?: 'INDOOR' | 'OUTDOOR' | 'BAR' | 'TAKEAWAY' | 'VIP';
  zone?: string;
  status: 'FREE' | 'AVAILABLE' | 'OCCUPIED' | 'BILL_PRINTED';
  currentTotal: number;
  activeOrder?: ActiveOrder;
  activeOrderId?: string;
  waiterId?: string;
  waiterName?: string;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
}

export type RestaurantTable = Table;

export interface Employee {
  id: string;
  name: string;
  pinCode: string;
  pin?: string;
  role: Role;
  hourlyRate: number;
  isActive: boolean;
  active?: boolean;
  createdAt?: string;
  biometricPublicKey?: string;
}

// ==========================================
// Inventory & Menu Interfaces
// ==========================================
export interface RecipeIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  quantityUsed: number;
  unit: UnitOfMeasure;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: UnitOfMeasure;
  currentStock: number;
  minAlertStock: number;
  costPerUnit: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  sortOrder?: number;
}

export interface Product {
  id: string;
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
  recipeIngredients?: RecipeIngredient[];
}

// ==========================================
// Shift, Vault & Financial Models
// ==========================================
export interface WorkShiftLog {
  id: string;
  employeeId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string;
  hourlyRateAtShift: number;
  totalHoursWorked?: number;
  earnedAmount?: number;
  status: 'WORKING' | 'COMPLETED';
  notes?: string;
}

export interface WaiterVaultSession {
  id: string;
  shiftLogId: string;
  waiterId: string;
  waiterName: string;
  openedAt: string;
  closedAt?: string;
  startingFloat: number;
  cashCollected: number;
  cardCollected: number;
  expectedCash?: number;
  cashHandedOver?: number;
  cashVariance?: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  action: string;
  tableNumber?: number;
  details: string;
}

export interface SpoilageLog {
  id: string;
  itemId: string;
  itemName: string;
  quantityWasted: number;
  unit: UnitOfMeasure;
  costLossNet: number;
  reason: string;
  loggedByEmployeeId: string;
  loggedByEmployeeName: string;
  timestamp: string;
}

export interface DailyZReportSnapshot {
  id: string;
  dateStr: string;
  timestamp: string;
  closedByEmployeeId: string;
  closedByEmployeeName: string;
  totalCash: number;
  totalCard: number;
  totalGrossRevenue: number;
  net13: number;
  vat13: number;
  net24: number;
  vat24: number;
  totalNetRevenue: number;
  totalVatLiability: number;
}

export interface SaleRecord {
  id: string;
  orderId: string;
  tableId: string;
  tableNumber: number;
  waiterId: string;
  waiterName: string;
  paymentMethod: 'CASH' | 'CARD' | 'DEBT';
  items: TableOrderItem[];
  subtotalNet: number;
  totalTax: number;
  grandTotal: number;
  timestamp: string;
  notes?: string;
}

export interface ReadyNotification {
  id: string;
  tableId: string;
  tableNumber: number;
  zone: string;
  itemSummary: string;
  readyAt: string;
}

// ==========================================
// Helper Utility Functions
// ==========================================
export function stripGreekAccents(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}