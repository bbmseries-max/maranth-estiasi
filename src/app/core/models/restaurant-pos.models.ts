/** Standard Greek VAT rate values (Συντελεστής ΦΠΑ Ελλάδας: 0%, 6%, 13%, 24%) */
export type GreekVatPercentage = 0 | 6 | 13 | 24;
export type GreekVatFactor = 0 | 0.06 | 0.13 | 0.24;
export type GreekVatRate = GreekVatPercentage | GreekVatFactor;

/** Greek VAT configuration helper interface */
export interface GreekVatTier {
  percentage: GreekVatPercentage;
  factor: GreekVatFactor;
  divisor: number; // e.g. 1.24 for 24%
  label: string;   // Display label in Greek
}

/** Pre-configured Greek VAT tiers for exact net revenue & tax calculations */
export const GREEK_VAT_TIERS: Record<GreekVatPercentage, GreekVatTier> = {
  24: { percentage: 24, factor: 0.24, divisor: 1.24, label: '24% - Κανονικός Συντελεστής' },
  13: { percentage: 13, factor: 0.13, divisor: 1.13, label: '13% - Μειωμένος Συντελεστής (Εστίαση/Καφές)' },
  6:  { percentage: 6,  factor: 0.06, divisor: 1.06, label: '6% - Υπερμειωμένος Συντελεστής' },
  0:  { percentage: 0,  factor: 0,    divisor: 1.00, label: '0% - Απαλλαγή ΦΠΑ' }
};


/** Greek character validation & normalization utility patterns */
export const GREEK_PATTERNS = {
  /** Greek Tax ID - ΑΦΜ: Exactly 9 numeric digits */
  AFM: /^[0-9]{9}$/,
  /** Greek Landline & Mobile Phones: Exactly 10 digits starting with 2 or 69 */
  PHONE: /^(2[0-9]{9}|69[0-9]{8})$/,
  /** Greek & English alphanumeric text filter */
  TEXT_SEARCH: /^[a-zA-Z0-9\u0370-\u03FF\u1F00-\u1FFF\s\-.,()]+$/
};

/**
 * Strips Greek tonal accents (διακριτικά) from string for accent-insensitive search.
 * e.g., "Φρέντο Εσπρέσο" -> "φρεντο εσπρεσο"
 */
export function stripGreekAccents(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Converts Greek text to unaccented uppercase for official receipt printing.
 * e.g., "Φρέντο Εσπρέσο" -> "ΦΡΕΝΤΟ ΕΣΠΡΕΣΟ"
 */
export function toGreekReceiptUppercase(text: string): string {
  if (!text) return '';
  const cleanText = stripGreekAccents(text);
  return cleanText.toUpperCase();
}


/** Employee system access roles (Ρόλοι δικαιωμάτων προσωπικού) */
export type EmployeeRole = 
  | 'ADMIN'        // Διαχειριστής
  | 'MANAGER'      // Υπεύθυνος Καταστήματος
  | 'HEAD_WAITER'  // Αρχισερβιτόρος
  | 'WAITER'       // Σερβιτόρος
  | 'BARISTA'      // Mπαρίστα
  | 'KITCHEN';     // Κουζίνα

/** Table status lifecycle states (Καταστάσεις τραπεζιού) */
export type TableStatus = 
  | 'AVAILABLE'     // Ελεύθερο (Πράσινο)
  | 'OCCUPIED'      // Κατειλημμένο (Κόκκινο)
  | 'BILL_PRINTED'  // Εκδόθηκε Λογαριασμός (Κίτρινο)
  | 'RESERVED';     // Κεκλεισμένο / Κρατημένο (Μπλε)

/** Order line item preparation workflow status (Κατάσταση προετοιμασίας παραγγελίας) */
export type ItemPreparationStatus = 
  | 'PENDING'          // Σε αναμονή
  | 'SENT_TO_KITCHEN'  // Στάλθηκε στην κουζίνα / μπαρ
  | 'PREPARING'        // Σε προετοιμασία
  | 'SERVED'           // Σερβιρίστηκε
  | 'VOIDED';          // Ακυρώθηκε

/** Measurement units for receiving goods & raw ingredients (Μονάδες μέτρησης παραλαβών) */
export type UnitOfMeasure = 
  | 'KG'    // Κιλά
  | 'GRAM'  // Γραμμάρια
  | 'LITER' // Λίτρα
  | 'ML'    // Χιλιοστόλιτρα
  | 'PCS'   // Τεμάχια
  | 'BOX'   // Κιβώτια
  | 'PACK'; // Συσκευασίες

/** Settlement payment methods (Τρόποι πληρωμής & εξόφλησης) */
export type PaymentMethod = 
  | 'CASH'          // Μετρητά
  | 'CARD'          // Κάρτα / POS
  | 'DEBIT'         // Χρεωστική
  | 'ROOM_CHARGE'   // Χρέωση Δωματίου / Πίστωση
  | 'COMPLIMENTARY'; // Κέρασμα / Δωρεάν

/** Action types recorded in the security audit trail (Τύποι ενεργειών καταγραφής ασφαλείας) */
export type AuditActionType = 
  | 'CLOCK_IN' 
  | 'CLOCK_OUT' 
  | 'ORDER_CREATED' 
  | 'ITEM_ADDED'
  | 'ITEM_VOIDED' 
  | 'TABLE_TRANSFERRED' 
  | 'TABLE_MERGED'
  | 'DISCOUNT_APPLIED' 
  | 'BILL_PRINTED' 
  | 'PAYMENT_RECEIVED' 
  | 'GOODS_RECEIVED'
  | 'VAULT_CLOSED';


/** Represents a staff member in the system (Στοιχεία εργαζομένου) */
export interface Employee {
  id: string;
  name: string;
  pinCode: string;
  role: EmployeeRole;
  hourlyRate: number;
  isActive: boolean;
  phone?: string;
  createdAt: string;
}

/** Tracks a single clock-in / clock-out shift session for payroll (Καταγραφή βάρδιας & ωρομετρητή) */
export interface WorkShiftLog {
  id: string;
  employeeId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHoursWorked?: number;
  hourlyRateAtShift: number;
  estimatedWage?: number;
  notes?: string;
  status: 'WORKING' | 'COMPLETED';
}

/** Represents a waiter's individual cash pouch / drawer session (Ταμείο & πορτοφόλι σερβιτόρου) */
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
  status: 'OPEN' | 'CLOSED';
}


/** Represents a customizable item option (π.χ. "Μέτριος", "Γάλα Βρώμης", "Έξτρα Δόση") */
export interface OrderModifier {
  id: string;
  name: string;
  priceExtra: number;
}

/** Group of customizable options attached to products (Ομάδες επιλογών προσαρμογής) */
export interface ModifierOptionGroup {
  id: string;
  title: string;
  required: boolean;
  maxSelection: number;
  options: OrderModifier[];
}

/** Represents a single line item within a table's order (Προϊόν παραγγελίας τραπεζιού) */
export interface TableOrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  taxRate: GreekVatRate;
  modifiers: OrderModifier[];
  finalItemPrice: number;
  itemNotes?: string;
  orderedByWaiterId: string;
  orderedByWaiterName: string;
  timestamp: string;
  status: ItemPreparationStatus;
}

/** Represents a dining table or service station (Τραπέζι / Σταθμός εξυπηρέτησης) */
export interface RestaurantTable {
  id: string;
  tableNumber: number;
  zone: string;
  status: TableStatus;
  capacity: number;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  activeOrder?: {
    orderId: string;
    openedAt: string;
    items: TableOrderItem[];
    subtotalNet: number;
    totalTax: number;
    grandTotal: number;
  };
}


/** Recipe raw ingredient link for automatic inventory deduction (Συνταγή & Ανάλωση υλικών) */
export interface RecipeIngredient {
  rawMaterialId: string;
  quantityUsed: number;
  unit: UnitOfMeasure;
}

/** Represents a sellable menu item (Προϊόν τιμοκαταλόγου) */
export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  purchasePrice: number;
  taxRate: GreekVatRate;
  isWeighted: boolean;
  modifierGroupIds?: string[];
  recipeIngredients?: RecipeIngredient[];
  isPinnedToPOS: boolean;
  isActive: boolean;
}

/** Menu classification category (Κατηγορία μενού) */
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  colorCode?: string;
}

/** Represents a supplier profile (Στοιχεία προμηθευτή) */
export interface Supplier {
  id: string;
  companyName: string;
  afm: string;
  contactPerson: string;
  phone: string;
  email: string;
  address?: string;
  outstandingBalance: number;
}

/** Raw material stock item (Πρώτη ύλη αποθήκης) */
export interface RawMaterial {
  id: string;
  name: string;
  unit: UnitOfMeasure;
  currentStock: number;
  minAlertStock: number;
  costPerUnit: number;
  supplierId?: string;
}

/** Single line item in a goods receiving invoice (Γραμμή παραλαβής τιμολογίου) */
export interface GoodsReceivingItem {
  rawMaterialId: string;
  rawMaterialName: string;
  quantityReceived: number;
  unitOfMeasure: UnitOfMeasure;
  unitCostNet: number;
  vatRate: GreekVatRate;
  totalGross: number;
  batchNumber?: string;
  expirationDate?: string;
}

/** Complete goods receiving invoice document (Τιμολόγιο / Δελτίο παραλαβής προμηθευτή) */
export interface SupplyInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  receivedDate: string;
  items: GoodsReceivingItem[];
  totalNet: number;
  totalVat: number;
  grandTotal: number;
  isPaid: boolean;
}

/** Spoilage and waste log entry (Καταγραφή φύρας & ζημιών) */
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

/** Immutable security audit trail record (Αρχείο καταγραφής συμβάντων ασφαλείας) */
export interface AuditLog {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  action: AuditActionType;
  tableNumber?: number;
  details: string;
  managerApprovedById?: string;
}