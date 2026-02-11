/**
 * Shared Database Types for QuickWMS
 * Types matching the new label format and warehouse operations
 */

// ============================================
// Common Types
// ============================================

export type UUID = string;
export type Timestamp = Date;
export type Money = number; // Stored as decimal, represented as number

// ============================================
// Item Types
// ============================================

export type ItemStatus =
  | 'intake'
  | 'received'
  | 'grading'
  | 'graded'
  | 'refurbishing'
  | 'refurbished'
  | 'listing'
  | 'listed'
  | 'sold'
  | 'shipped'
  | 'returned'
  | 'salvage';

export type ItemCondition =
  | 'new'
  | 'open-box'
  | 'like-new'
  | 'refurbished'
  | 'good'
  | 'fair'
  | 'salvage'
  | 'parts-only';

export type ItemGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'S';

export interface Item {
  id: UUID;
  qlid: string;
  upc?: string;
  sku?: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  condition?: ItemCondition;
  grade?: ItemGrade;
  cost?: Money;
  msrp?: Money;
  listedPrice?: Money;
  soldPrice?: Money;
  status: ItemStatus;
  location?: string;
  warehouse?: string;
  palletId?: string;
  manifestId?: string;
  supplierId?: string;
  sessionId?: string;
  images: string[];
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateItemInput {
  qlid?: string;
  upc?: string;
  sku?: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  condition?: ItemCondition;
  grade?: ItemGrade;
  cost?: Money;
  msrp?: Money;
  status?: ItemStatus;
  location?: string;
  warehouse?: string;
  palletId?: string;
  manifestId?: string;
  supplierId?: string;
  sessionId?: string;
  images?: string[];
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface UpdateItemInput {
  upc?: string;
  sku?: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  condition?: ItemCondition;
  grade?: ItemGrade;
  cost?: Money;
  msrp?: Money;
  listedPrice?: Money;
  soldPrice?: Money;
  status?: ItemStatus;
  location?: string;
  warehouse?: string;
  palletId?: string;
  manifestId?: string;
  supplierId?: string;
  sessionId?: string;
  images?: string[];
  metadata?: Record<string, any>;
  updatedBy?: string;
}

// ============================================
// Pallet Types
// ============================================

export type PalletStatus = 'open' | 'building' | 'full' | 'staged' | 'shipped' | 'received';

export interface Pallet {
  id: UUID;
  palletId: string;
  internalId?: string; // P1BBY format
  type?: string;
  status: PalletStatus;
  location?: string;
  warehouse?: string;
  itemCount: number;
  totalCost?: Money;
  totalMsrp?: Money;
  manifestId?: string;
  supplierId?: string;
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreatePalletInput {
  palletId: string;
  internalId?: string;
  type?: string;
  status?: PalletStatus;
  location?: string;
  warehouse?: string;
  manifestId?: string;
  supplierId?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePalletInput {
  internalId?: string;
  type?: string;
  status?: PalletStatus;
  location?: string;
  warehouse?: string;
  itemCount?: number;
  totalCost?: Money;
  totalMsrp?: Money;
  manifestId?: string;
  supplierId?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Manifest Types
// ============================================

export type ManifestStatus =
  | 'pending'
  | 'received'
  | 'processing'
  | 'processed'
  | 'closed';

export interface Manifest {
  id: UUID;
  manifestId: string;
  supplierId?: string;
  supplierName?: string;
  source?: string;
  totalItems: number;
  receivedItems: number;
  totalCost?: Money;
  totalMsrp?: Money;
  receivedDate?: Date;
  status: ManifestStatus;
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateManifestInput {
  manifestId: string;
  supplierId?: string;
  supplierName?: string;
  source?: string;
  totalItems?: number;
  totalCost?: Money;
  totalMsrp?: Money;
  receivedDate?: Date;
  status?: ManifestStatus;
  metadata?: Record<string, any>;
}

export interface UpdateManifestInput {
  supplierId?: string;
  supplierName?: string;
  source?: string;
  totalItems?: number;
  receivedItems?: number;
  totalCost?: Money;
  totalMsrp?: Money;
  receivedDate?: Date;
  status?: ManifestStatus;
  metadata?: Record<string, any>;
}

// ============================================
// Supplier Types
// ============================================

export type SupplierStatus = 'active' | 'inactive' | 'pending' | 'blocked';

export interface Supplier {
  id: UUID;
  supplierId: string;
  name: string;
  code: string; // Short code like "TL", "BBY", "QL"
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  status: SupplierStatus;
  paymentTerms?: string;
  notes?: string;
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateSupplierInput {
  supplierId?: string;
  name: string;
  code: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  status?: SupplierStatus;
  paymentTerms?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSupplierInput {
  name?: string;
  code?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  status?: SupplierStatus;
  paymentTerms?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Order Types
// ============================================

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type OrderType = 'purchase' | 'sale' | 'transfer' | 'return';

export interface Order {
  id: UUID;
  orderId: string;
  type: OrderType;
  status: OrderStatus;
  supplierId?: string;
  customerId?: string;
  manifestId?: string;
  totalItems: number;
  totalCost?: Money;
  totalPrice?: Money;
  shippingCost?: Money;
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  metadata: Record<string, any>;
  orderedAt?: Timestamp;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateOrderInput {
  orderId?: string;
  type: OrderType;
  status?: OrderStatus;
  supplierId?: string;
  customerId?: string;
  manifestId?: string;
  totalItems?: number;
  totalCost?: Money;
  totalPrice?: Money;
  shippingCost?: Money;
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  metadata?: Record<string, any>;
  orderedAt?: Timestamp;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  totalItems?: number;
  totalCost?: Money;
  totalPrice?: Money;
  shippingCost?: Money;
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  metadata?: Record<string, any>;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
}

// ============================================
// Receiving Session Types
// ============================================

export type SessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface ReceivingSession {
  id: UUID;
  sessionId: string;
  manifestId?: string;
  palletId?: string;
  supplierId?: string;
  status: SessionStatus;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  userId?: string;
  userName?: string;
  warehouse?: string;
  totalItems: number;
  receivedItems: number;
  lastItemQlid?: string;
  notes?: string;
  metadata: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateSessionInput {
  sessionId?: string;
  manifestId?: string;
  palletId?: string;
  supplierId?: string;
  userId?: string;
  userName?: string;
  warehouse?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSessionInput {
  status?: SessionStatus;
  palletId?: string;
  completedAt?: Timestamp;
  totalItems?: number;
  receivedItems?: number;
  lastItemQlid?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

// ============================================
// Activity Log Types
// ============================================

export interface ActivityLog {
  id: UUID;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Timestamp;
}

export interface CreateActivityLogInput {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// Label Types (matching new label format)
// ============================================

export interface LabelData {
  qlid: string;
  internalPalletId?: string; // P1BBY format
  manifestId?: string;
  upc?: string;
  title?: string;
  brand?: string;
  model?: string;
  condition?: ItemCondition;
  grade?: ItemGrade;
  cost?: Money;
  msrp?: Money;
  category?: string;
  date: string;
}

// ============================================
// Query Types
// ============================================

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
}

// ============================================
// Database Row Types (snake_case for DB)
// ============================================

export interface DbRow {
  id: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: any;
}
