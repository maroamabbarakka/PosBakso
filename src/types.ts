export type NavKey =
  | 'kasir'
  | 'pesanan'
  | 'dapur'
  | 'dashboard'
  | 'laporan'
  | 'produk'
  | 'stok'
  | 'shift'
  | 'pengguna'
  | 'printer'
  | 'pengaturan'

export type RoleKey = 'owner' | 'manager' | 'supervisor' | 'cashier' | 'kitchen' | 'warehouse'
export type Permission =
  | 'sale.create' | 'sale.discount' | 'sale.void' | 'sale.refund' | 'sale.reprint'
  | 'shift.open' | 'shift.close' | 'cash.move'
  | 'product.view' | 'product.manage'
  | 'inventory.view' | 'inventory.adjust' | 'inventory.purchase'
  | 'report.view' | 'report.profit'
  | 'user.manage' | 'settings.manage' | 'printer.manage' | 'audit.view' | 'kitchen.view' | 'backup.restore'

export interface ProductModifierOption {
  id: string
  name: string
  price: number
  recipeItems?: RecipeItem[]
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  price: number
  cost: number
  image: string
  stock?: number
  unit?: string
  active: boolean
  trackStock?: boolean
  kitchenRoute?: 'kitchen' | 'bar' | 'none'
  modifierOptions?: ProductModifierOption[]
}

export interface CartModifier {
  id?: string
  name: string
  price: number
  recipeItems?: RecipeItem[]
}

export interface CartItem extends Product {
  lineId?: string
  qty: number
  note?: string
  modifiers?: CartModifier[]
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery'
export type OrderStatus = 'held' | 'paid' | 'void' | 'refunded'
export type KitchenStatus = 'new' | 'preparing' | 'ready' | 'served'
export type KitchenStation = 'kitchen' | 'bar'
export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'card' | 'other'

export interface Payment {
  method: PaymentMethod
  label: string
  amount: number
  tendered?: number
  change?: number
  reference?: string
  paidAt: string
}

export interface Order {
  id: string
  number: string
  queueNumber: string
  terminalCode?: string
  createdAt: string
  updatedAt: string
  businessDate?: string
  cashierId: string
  cashierName: string
  shiftId?: string
  type: OrderType
  tableName?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  note?: string
  status: OrderStatus
  /** Legacy aggregate status. New code derives this from stationStatus. */
  kitchenStatus?: KitchenStatus
  stationStatus?: Partial<Record<KitchenStation, KitchenStatus>>
  items: CartItem[]
  subtotal: number
  discount: number
  tax: number
  service: number
  total: number
  payment?: Payment
  payments?: Payment[]
  inventoryCommitted?: boolean
  holdExpiresAt?: string
  voidReason?: string
  voidedAt?: string
  voidDate?: string
  refundReason?: string
  refundedAt?: string
  refundDate?: string
  reversalShiftId?: string
}

export interface Ingredient {
  id: string
  name: string
  sku: string
  stock: number
  unit: string
  minStock: number
  averageCost: number
  active: boolean
  updatedAt?: string
}

export interface RecipeItem {
  ingredientId: string
  qty: number
}

export interface Recipe {
  productId: string
  items: RecipeItem[]
}

export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'waste' | 'opname' | 'return'
export interface StockMovement {
  id: string
  ingredientId: string
  type: StockMovementType
  qty: number
  before: number
  after: number
  unit: string
  unitCostSnapshot?: number
  note: string
  reference?: string
  userId: string
  userName: string
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  note?: string
  active: boolean
}

export interface PurchaseItem {
  ingredientId: string
  name: string
  qty: number
  unit: string
  unitCost: number
}
export interface Purchase {
  id: string
  number: string
  supplierId?: string
  supplierName: string
  createdAt: string
  status: 'draft' | 'received'
  items: PurchaseItem[]
  total: number
  note?: string
}

export interface CashMovement {
  id: string
  shiftId: string
  type: 'in' | 'out'
  amount: number
  note: string
  createdAt: string
  userId: string
  userName: string
}

export interface Shift {
  id: string
  cashierId: string
  cashierName: string
  openedAt: string
  closedAt?: string
  openingCash: number
  actualClosingCash?: number
  status: 'open' | 'closed'
  note?: string
}

export interface RoleDefinition {
  key: RoleKey
  label: string
  permissions: Permission[]
}

export interface UserProfile {
  id: string
  name: string
  email: string
  role: RoleKey
  roleLabel: string
  active: boolean
  avatarInitials: string
  pinHash?: string
  lastLoginAt?: string
}

export interface PrinterConfig {
  id: string
  name: string
  type: 'cashier' | 'kitchen' | 'bar'
  paperWidth: 58 | 80
  /** Actual printable head width. Common values: 384 (58mm), 512/576 (80mm). */
  printWidthDots?: number
  transport: 'auto' | 'local-bridge' | 'browser' | 'bluetooth' | 'usb' | 'network' | 'web-bluetooth' | 'web-serial'
  /** Hardware profile. Bindings stay local to this device and are never synced to Firestore. */
  profileId?: 'generic-58' | 'generic-80' | 'iware-x58bt2'
  deviceName?: string
  deviceAddress?: string
  autoPrint: boolean
  printLogo: boolean
  cutPaper: boolean
  openDrawer: boolean
  drawerMode?: 'cash' | 'always' | 'never'
  routeCategories: string[]
  /** Cached hint only. Runtime status must come from native getStatus(). */
  connected: boolean
  copies?: number
  characterSet?: 'CP437' | 'CP850' | 'CP858' | 'Windows-1252'
}

export type ReceiptLogoAlignment = 'left' | 'center' | 'right'
export type ReceiptRasterMode = 'threshold' | 'floyd_steinberg'
export type ReceiptDensity = 'compact' | 'normal' | 'large'
export interface ReceiptDesignSettings {
  showLogo: boolean
  logoUrl: string
  logoAlignment: ReceiptLogoAlignment
  logoWidthMm: number
  rasterMode: ReceiptRasterMode
  rasterThreshold: number
  headerTitle: string
  headerSubtitle: string
  documentTitle: string
  headerLines: string[]
  showAddress: boolean
  showPhone: boolean
  showQueueNumber: boolean
  showCashier: boolean
  showOrderType: boolean
  showCustomer: boolean
  showItemSku: boolean
  showModifiers: boolean
  showItemNotes: boolean
  showOrderNote: boolean
  showPaymentReference: boolean
  showTaxBreakdown: boolean
  density: ReceiptDensity
  footerLines: string[]
  showTagline: boolean
  qrEnabled: boolean
  qrLabel: string
  qrValue: string
  qrSize: number
  barcodeEnabled: boolean
  barcodeSource: 'order_number' | 'queue_number'
  barcodeHeight: number
  copies: number
  feedLines: number
}

export interface OutletSettings {
  outletName: string
  brandName: string
  tagline: string
  address: string
  phone: string
  footerReceipt: string
  taxEnabled: boolean
  taxPercent: number
  serviceEnabled: boolean
  servicePercent: number
  currency: 'IDR'
  queuePrefix: string
  receiptPrefix: string
  logoUrl: string
  tables: string[]
  holdExpiryMinutes: number
  receipt: ReceiptDesignSettings
}

export interface AuditEvent {
  id: string
  createdAt: string
  userId: string
  userName: string
  action: string
  entity: string
  entityId?: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
}

export interface SaleSummary {
  sales: number
  transactions: number
  average: number
  items: number
  grossProfit: number
}

export interface AppData {
  schemaVersion: number
  products: Product[]
  ingredients: Ingredient[]
  recipes: Recipe[]
  orders: Order[]
  shifts: Shift[]
  cashMovements: CashMovement[]
  users: UserProfile[]
  roles: RoleDefinition[]
  suppliers: Supplier[]
  purchases: Purchase[]
  stockMovements: StockMovement[]
  printers: PrinterConfig[]
  settings: OutletSettings
  audit: AuditEvent[]
}

export type PrintJobStatus = 'pending' | 'printing' | 'printed' | 'failed'
export type PrintJobKind = 'receipt' | 'kitchen' | 'bar' | 'test'
export interface PrintJob {
  id: string
  printerId: string
  printerName: string
  kind: PrintJobKind
  orderId?: string
  orderNumber?: string
  status: PrintJobStatus
  attempts: number
  createdAt: string
  updatedAt: string
  businessDate?: string
  lastError?: string
  payload: Record<string, unknown>
}
