/**
 * QuickRefurbz - Type Definitions
 * Refurbishment tracking system with QLID identity
 *
 * QLID is the globally unique identifier for every unit
 * Format: QLID{SERIES}{10-digit} (e.g., QLID0000000001, QLIDA0000000000)
 * Barcode: {PalletID}-QLID{SERIES}{10-digit} (e.g., P1BBY-QLID0000000001)
 */

// ==================== RETAILERS ====================

/**
 * Retailer - Original store where products came from
 */
export type Retailer =
  | 'BESTBUY'
  | 'TARGET'
  | 'AMAZON'
  | 'COSTCO'
  | 'WALMART'
  | 'KOHLS'
  | 'HOMEDEPOT'
  | 'LOWES'
  | 'OTHER';

export const RETAILER_DISPLAY: Record<Retailer, string> = {
  BESTBUY: 'Best Buy',
  TARGET: 'Target',
  AMAZON: 'Amazon',
  COSTCO: 'Costco',
  WALMART: 'Walmart',
  KOHLS: "Kohl's",
  HOMEDEPOT: 'Home Depot',
  LOWES: "Lowe's",
  OTHER: 'Other'
};

/**
 * Retailer codes for legacy PalletID suffix (backwards compatibility)
 */
export type RetailerCode =
  | 'BBY'   // Best Buy
  | 'AMZ'   // Amazon
  | 'TGT'   // Target
  | 'CST'   // Costco
  | 'WMT'   // Walmart
  | 'KHL'   // Kohl's
  | 'HD'    // Home Depot
  | 'LOW'   // Lowe's
  | 'OTH';  // Other

export const RETAILER_CODE_DISPLAY: Record<RetailerCode, string> = {
  BBY: 'Best Buy',
  AMZ: 'Amazon',
  TGT: 'Target',
  CST: 'Costco',
  WMT: 'Walmart',
  KHL: "Kohl's",
  HD: 'Home Depot',
  LOW: "Lowe's",
  OTH: 'Other'
};

// ==================== LIQUIDATION SOURCES ====================

/**
 * LiquidationSource - Where pallets are purchased from
 */
export type LiquidationSource =
  | 'TECHLIQUIDATORS'
  | 'DIRECTLIQUIDATION'
  | 'BSTOCK'
  | 'BULQ'
  | 'QUICKLOTZ'
  | 'OTHER';

export const SOURCE_DISPLAY: Record<LiquidationSource, string> = {
  TECHLIQUIDATORS: 'TechLiquidators',
  DIRECTLIQUIDATION: 'DirectLiquidation',
  BSTOCK: 'B-Stock',
  BULQ: 'BULQ',
  QUICKLOTZ: 'QuickLotz',
  OTHER: 'Other'
};

// ==================== PALLET STATUS ====================

export type PalletStatus = 'RECEIVING' | 'IN_PROGRESS' | 'COMPLETE';

// ==================== WORKFLOW STAGES ====================

/**
 * 6-stage refurbishment workflow
 */
export type RefurbStage =
  | 'INTAKE'      // Received from QuickIntakez
  | 'TESTING'     // Diagnostic testing
  | 'REPAIR'      // Repair work
  | 'CLEANING'    // Cosmetic cleaning
  | 'FINAL_QC'    // Quality control
  | 'COMPLETE';   // Ready for next workflow

export const STAGE_ORDER: RefurbStage[] = [
  'INTAKE',
  'TESTING',
  'REPAIR',
  'CLEANING',
  'FINAL_QC',
  'COMPLETE'
];

export const STAGE_DISPLAY: Record<RefurbStage, string> = {
  INTAKE: 'Intake',
  TESTING: 'Testing',
  REPAIR: 'Repair',
  CLEANING: 'Cleaning',
  FINAL_QC: 'Final QC',
  COMPLETE: 'Complete'
};

// ==================== PRODUCT CATEGORIES ====================

export type ProductCategory =
  | 'PHONE'
  | 'TABLET'
  | 'LAPTOP'
  | 'DESKTOP'
  | 'TV'
  | 'MONITOR'
  | 'AUDIO'
  | 'APPLIANCE_SMALL'
  | 'APPLIANCE_LARGE'
  | 'GAMING'
  | 'WEARABLE'
  | 'OTHER';

export const CATEGORY_DISPLAY: Record<ProductCategory, string> = {
  PHONE: 'Phone',
  TABLET: 'Tablet',
  LAPTOP: 'Laptop',
  DESKTOP: 'Desktop',
  TV: 'TV',
  MONITOR: 'Monitor',
  AUDIO: 'Audio',
  APPLIANCE_SMALL: 'Small Appliance',
  APPLIANCE_LARGE: 'Large Appliance',
  GAMING: 'Gaming',
  WEARABLE: 'Wearable',
  OTHER: 'Other'
};

// ==================== PRIORITIES & STATUSES ====================

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export const PRIORITY_DISPLAY: Record<JobPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent'
};

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANNOT_REPAIR';

export type IssueSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'COSMETIC';

export const SEVERITY_DISPLAY: Record<IssueSeverity, string> = {
  CRITICAL: 'Critical - Non-functional',
  MAJOR: 'Major - Partial functionality',
  MINOR: 'Minor - Fully functional with issues',
  COSMETIC: 'Cosmetic - Appearance only'
};

// ==================== FINAL GRADES ====================

export type FinalGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'SALVAGE';

export const GRADE_DISPLAY: Record<FinalGrade, string> = {
  A: 'A - Like New',
  B: 'B - Excellent',
  C: 'C - Good',
  D: 'D - Fair',
  F: 'F - Poor',
  SALVAGE: 'Salvage - Parts Only'
};

// ==================== PARTS ====================

export type PartCategory =
  | 'SCREEN'
  | 'BATTERY'
  | 'CABLE'
  | 'CHARGER'
  | 'KEYBOARD'
  | 'MEMORY'
  | 'STORAGE'
  | 'FAN'
  | 'SPEAKER'
  | 'CAMERA'
  | 'OTHER';

export const PART_CATEGORY_DISPLAY: Record<PartCategory, string> = {
  SCREEN: 'Screen',
  BATTERY: 'Battery',
  CABLE: 'Cable',
  CHARGER: 'Charger',
  KEYBOARD: 'Keyboard',
  MEMORY: 'Memory',
  STORAGE: 'Storage',
  FAN: 'Fan',
  SPEAKER: 'Speaker',
  CAMERA: 'Camera',
  OTHER: 'Other'
};

// ==================== CORE INTERFACES ====================

/**
 * Pallet - Container of items from a liquidation source
 * Uses QR pallet ID system (QR0000001) mapped to source pallet IDs
 */
export interface Pallet {
  id: string;
  palletId: string;                      // QR0000001 (our system)

  // Origin
  retailer: Retailer;                    // Best Buy, Target (original store)
  liquidationSource: LiquidationSource;  // TechLiquidators, B-Stock, etc.
  sourcePalletId?: string;               // PTRF70336 (their pallet ID)
  sourceOrderId?: string;                // Their order/invoice number
  sourceManifestUrl?: string;            // Manifest file reference

  // Order info
  purchaseDate?: Date;
  totalCogs: number;                     // Total cost paid for pallet

  // Item counts
  expectedItems: number;                 // Expected from manifest
  receivedItems: number;                 // Actually received
  completedItems: number;                // Finished processing

  // Status
  status: PalletStatus;

  // Location
  warehouseId?: string;

  // Notes
  notes?: string;

  // Timestamps
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * RefurbItem - Unit being refurbished
 * QLID is the globally unique identifier
 */
export interface RefurbItem {
  id: string;

  // Identity (QLID-based)
  qlidTick: bigint;                    // Raw sequence number from Postgres
  qlid: string;                        // QLID0000000001 (canonical identifier)
  qrPalletId?: string;                 // QR0000001 (reference to Pallet)
  palletId: string;                    // P1BBY (barcode prefix - legacy)
  barcodeValue: string;                // P1BBY-QLID0000000001 (for scanning)

  // Cost tracking
  unitCogs?: number;                   // Cost attribution from pallet

  // Intake metadata
  intakeEmployeeId: string;            // Who intaked the item
  warehouseId: string;                 // Where it was intaked
  intakeTs: Date;                      // When it was intaked

  // Product info
  manufacturer: string;
  model: string;
  category: ProductCategory;
  serialNumber?: string;

  // Workflow state
  currentStage: RefurbStage;
  priority: JobPriority;

  // Assignment
  assignedTechnicianId?: string;

  // Final assessment
  finalGrade?: FinalGrade;
  estimatedValue?: number;

  // Routing decision
  nextWorkflow?: string;               // QuickListingz, QuickSalvage, etc.

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  notes?: string;
}

/**
 * StageTransition - Audit log for stage changes
 */
export interface StageTransition {
  id: string;
  qlid: string;                        // Reference by QLID
  fromStage: RefurbStage | null;
  toStage: RefurbStage;
  technicianId?: string;
  technicianName?: string;
  durationMinutes?: number;
  notes?: string;
  createdAt: Date;
}

/**
 * RepairTicket - Issues found and repairs performed
 */
export interface RepairTicket {
  id: string;
  ticketNumber: string;                // TK0000001
  qlid: string;                        // Reference by QLID

  // Issue details
  issueType: string;
  issueDescription: string;
  severity: IssueSeverity;

  // Repair details
  repairAction?: string;
  repairNotes?: string;

  // Status
  status: TicketStatus;

  // Assignment
  createdByTechnicianId: string;
  assignedTechnicianId?: string;
  resolvedByTechnicianId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

/**
 * Part - Parts inventory item
 */
export interface Part {
  id: string;
  partNumber: string;
  name: string;
  description?: string;
  category: PartCategory;

  // Compatibility
  compatibleCategories: ProductCategory[];
  compatibleManufacturers?: string[];

  // Inventory
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  reorderQuantity: number;

  // Cost
  unitCost: number;

  // Tracking
  location?: string;
  lastRestockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PartsUsage - Parts consumed by a repair
 */
export interface PartsUsage {
  id: string;
  qlid: string;                        // Reference by QLID
  ticketId?: string;
  ticketNumber?: string;

  partId: string;
  partNumber: string;
  partName: string;

  quantity: number;
  unitCost: number;
  totalCost: number;

  usedByTechnicianId: string;
  usedByTechnicianName?: string;
  notes?: string;
  createdAt: Date;
}

/**
 * Technician - Team member record
 */
export interface Technician {
  id: string;
  employeeId: string;
  name: string;
  email?: string;
  phone?: string;

  // Skills
  specialties: ProductCategory[];

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ==================== LABEL DATA ====================

/**
 * Label printing data
 * Barcode contains only: {PalletID}-QLID{SERIES}{10-digit}
 * Human-readable text includes employee, warehouse, timestamp
 */
export interface LabelData {
  barcodeValue: string;                // P1BBY-QLID0000000001 (Code128)
  qlid: string;                        // QLID0000000001
  palletId: string;                    // P1BBY
  employeeId: string;                  // For human-readable section
  warehouseId: string;                 // For human-readable section
  timestamp: Date;                     // For human-readable section
  manufacturer?: string;
  model?: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract Retailer Code from PalletID
 * P1BBY → BBY
 */
export function getRetailerFromPalletId(palletId: string): RetailerCode {
  const match = palletId.match(/^P\d+([A-Z]+)$/);
  if (match && match[1] in RETAILER_DISPLAY) {
    return match[1] as RetailerCode;
  }
  return 'OTH';
}

/**
 * Validate PalletID format
 * Valid: P1BBY, P23AMZ
 */
export function isValidPalletId(palletId: string): boolean {
  return /^P\d+[A-Z]{2,3}$/.test(palletId);
}
