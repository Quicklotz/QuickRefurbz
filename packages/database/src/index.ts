/**
 * @quickwms/database
 * Shared PostgreSQL database library for all QuickWMS modules
 */

// ============================================
// Database Connection
// ============================================

export {
  getPool,
  query,
  transaction,
  transactionQueries,
  getClient,
  closePool,
  healthCheck,
  getPoolStats,
} from './connection.js';

export type { QueryResult, PoolClient, Pool } from './connection.js';

// ============================================
// Database Class (Singleton)
// ============================================

export { Database, db } from './database.js';

// ============================================
// Sequence Generators
// ============================================

export {
  generateQLID,
  generateQLIDBatch,
  parseQLID,
  isValidQLID,
  generateInternalPalletId,
  generateDatedPalletId,
  parseInternalPalletId,
  isValidInternalPalletId,
  generateSessionId,
  generateManifestId,
  generateOrderId,
  generateSupplierId,
  generateBarcodeString,
  parseBarcodeString,
  ensureSequences,
  getSequenceValues,
} from './sequences.js';

// ============================================
// Models
// ============================================

// Base Model
export { BaseModel, buildWhereClause, paginate, buildSearchQuery, safeOrderColumn } from './models/BaseModel.js';
export type { ModelConfig, ColumnMapping } from './models/BaseModel.js';

// Item Model
export { ItemModel } from './models/item.js';

// Pallet Model
export { PalletModel } from './models/pallet.js';

// Manifest Model
export { ManifestModel } from './models/manifest.js';

// Supplier Model
export { SupplierModel } from './models/SupplierModel.js';

// Order Model
export { OrderModel } from './models/OrderModel.js';

// Session Model
export { SessionModel } from './models/SessionModel.js';

// Activity Log Model
export { ActivityLogModel } from './models/activityLog.js';

// ============================================
// Types - From Types Module
// ============================================

export type {
  // Common
  UUID,
  Timestamp,
  Money,

  // Item Types
  ItemStatus,
  ItemCondition,
  ItemGrade,
  Item,
  CreateItemInput,
  UpdateItemInput,

  // Pallet Types
  PalletStatus,
  Pallet,
  CreatePalletInput,
  UpdatePalletInput,

  // Manifest Types
  ManifestStatus,
  Manifest,
  CreateManifestInput,
  UpdateManifestInput,

  // Supplier Types
  SupplierStatus,
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,

  // Order Types
  OrderStatus,
  OrderType,
  Order,
  CreateOrderInput,
  UpdateOrderInput,

  // Session Types
  SessionStatus,
  ReceivingSession,
  CreateSessionInput,
  UpdateSessionInput,

  // Activity Log Types
  ActivityLog,
  CreateActivityLogInput,

  // Label Types
  LabelData,

  // Query Types
  PaginationOptions,
  PaginatedResult,
  WhereCondition,

  // Database Types
  DbRow,
} from './types.js';

// ============================================
// Query Utilities (from utils)
// ============================================

export { batchInsert } from './utils/query.js';

// ============================================
// Re-export everything from models index
// ============================================

export * from './models/index.js';
