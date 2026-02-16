/**
 * QuickRefurbz - Type Definitions
 * Refurbishment tracking system with QLID identity
 *
 * Part of QuickWMS - Works seamlessly with QuickIntakez and other modules
 *
 * QLID is the globally unique identifier for every unit
 * Format: QLID{9-digit} (e.g., QLID000000001)
 * Barcode: {InternalPalletId}-{QLID} (e.g., P1BBY-QLID000000001)
 */

// ==================== RETAILERS ====================

/**
 * Retailer - Original store where products came from
 * Matches QuickIntakez retailer definitions
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
  | 'SAMSCLUB'
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
  SAMSCLUB: "Sam's Club",
  OTHER: 'Other'
};

/**
 * Retailer codes for internal PalletID (P1BBY, P2TGT, etc.)
 * Matches QuickIntakez format exactly
 */
export const RETAILER_CODE: Record<Retailer, string> = {
  BESTBUY: 'BBY',
  TARGET: 'TGT',
  AMAZON: 'AMZ',
  COSTCO: 'CST',
  WALMART: 'WMT',
  KOHLS: 'KHL',
  HOMEDEPOT: 'HDP',
  LOWES: 'LOW',
  SAMSCLUB: 'SAM',
  OTHER: 'OTH'
};

/**
 * Reverse lookup: code -> retailer
 */
export const CODE_TO_RETAILER: Record<string, Retailer> = Object.entries(RETAILER_CODE)
  .reduce((acc, [retailer, code]) => ({ ...acc, [code]: retailer as Retailer }), {} as Record<string, Retailer>);

/**
 * Legacy type for backwards compatibility
 */
export type RetailerCode = 'BBY' | 'TGT' | 'AMZ' | 'CST' | 'WMT' | 'KHL' | 'HDP' | 'LOW' | 'SAM' | 'OTH';

export const RETAILER_CODE_DISPLAY: Record<RetailerCode, string> = {
  BBY: 'Best Buy',
  TGT: 'Target',
  AMZ: 'Amazon',
  CST: 'Costco',
  WMT: 'Walmart',
  KHL: "Kohl's",
  HDP: 'Home Depot',
  LOW: "Lowe's",
  SAM: "Sam's Club",
  OTH: 'Other'
};

// ==================== LIQUIDATION SOURCES ====================

/**
 * LiquidationSource - Where pallets are purchased from
 */
export type LiquidationSource =
  | 'QUICKLOTZ'
  | 'DIRECTLIQUIDATION'
  | 'BSTOCK'
  | 'BULQ'
  | 'LIQUIDATION_COM'
  | 'OTHER';

export const SOURCE_DISPLAY: Record<LiquidationSource, string> = {
  QUICKLOTZ: 'QuickLotz',
  DIRECTLIQUIDATION: 'DirectLiquidation',
  BSTOCK: 'B-Stock',
  BULQ: 'BULQ',
  LIQUIDATION_COM: 'Liquidation.com',
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
  | 'ICE_MAKER'
  | 'VACUUM'
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
  ICE_MAKER: 'Ice Maker',
  VACUUM: 'Vacuum',
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
 * Supports both RFB IDs (standalone) and QLIDs (QuickIntakez)
 */
export interface RefurbItem {
  id: string;

  // Identity (RFB ID or QLID)
  qlidTick: bigint;                    // Raw sequence number
  qlid: string;                        // RFB100001 or QLID0000000001
  qrPalletId?: string;                 // QR0000001 (reference to Pallet)
  palletId: string;                    // RFB-P-0001 or P1BBY
  barcodeValue: string;                // RFB-P-0001-RFB100001 (for scanning)

  // Cost tracking
  unitCogs?: number;                   // Cost attribution from pallet

  // Intake metadata
  intakeEmployeeId: string;            // Who intaked the item
  warehouseId: string;                 // Where it was intaked
  intakeTs: Date;                      // When it was intaked

  // Product identification
  manufacturer: string;
  model: string;
  category: ProductCategory;
  upc?: string;                        // UPC barcode
  asin?: string;                       // Amazon ASIN
  serialNumber?: string;
  conditionNotes?: string;             // Initial condition assessment

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

/**
 * Refurbished item label data
 * QSKU format: RFB-{QLID} (e.g., RFB-QLID000000001)
 * Used for completed/certified items ready for sale
 */
export interface RefurbLabelData {
  qsku: string;                        // RFB-QLID000000001 (barcode value)
  qlid: string;                        // QLID000000001
  manufacturer: string;
  model: string;
  category: ProductCategory;
  finalGrade: FinalGrade;
  warrantyEligible: boolean;
  certificationId?: string;            // If certified
  completedAt: Date;
  retailer?: Retailer;                 // Original retailer
  serialNumber?: string;
  rack?: number;                       // Warehouse rack number
  shelf?: number;                      // Shelf number within rack
  fullRfbSku?: string;                 // Extended RFB cert SKU: RFB-P1BBY-QLID100001Z-A-R14S06
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract Retailer from internal PalletID
 * P1BBY → BESTBUY
 */
export function getRetailerFromPalletId(palletId: string): Retailer {
  const match = palletId.match(/^P\d+([A-Z]{3})$/);
  if (match && match[1] in CODE_TO_RETAILER) {
    return CODE_TO_RETAILER[match[1]];
  }
  return 'OTHER';
}

/**
 * Extract Retailer Code from PalletID
 * P1BBY → BBY
 */
export function getRetailerCodeFromPalletId(palletId: string): RetailerCode {
  const match = palletId.match(/^P\d+([A-Z]{3})$/);
  if (match && match[1] in CODE_TO_RETAILER) {
    return match[1] as RetailerCode;
  }
  return 'OTH';
}

/**
 * Validate internal PalletID format (from QuickIntakez)
 * Valid: P1BBY, P23TGT, P100AMZ
 */
export function isValidInternalPalletId(palletId: string): boolean {
  return /^P\d+[A-Z]{3}$/.test(palletId);
}

/**
 * Validate PalletID format (accepts QuickIntakez format)
 * Valid: P1BBY, P23TGT (QuickIntakez format)
 */
export function isValidPalletId(palletId: string): boolean {
  return isValidInternalPalletId(palletId);
}

/**
 * Parse internal pallet ID to extract components
 * P1BBY → { sequence: 1, retailerCode: 'BBY' }
 */
export function parseInternalPalletId(palletId: string): { sequence: number; retailerCode: string } | null {
  const match = palletId.match(/^P(\d+)([A-Z]{3})$/);
  if (!match) return null;
  return {
    sequence: parseInt(match[1], 10),
    retailerCode: match[2]
  };
}

/**
 * Validate QLID format
 * Valid: QLID000000001 (9 digits)
 */
export function isValidQLID(qlid: string): boolean {
  return /^QLID\d{9}$/.test(qlid);
}

/**
 * Parse QLID to extract sequence number
 * QLID000000001 → { sequence: 1 }
 */
export function parseQLID(qlid: string): { sequence: number } | null {
  const match = qlid.match(/^QLID(\d{9})$/);
  if (!match) return null;
  return { sequence: parseInt(match[1], 10) };
}

/**
 * Build label/barcode from pallet ID and QLID
 * (P1BBY, QLID000000001) → P1BBY-QLID000000001
 */
export function buildLabelId(internalPalletId: string, qlid: string): string {
  return `${internalPalletId}-${qlid}`;
}

/**
 * Parse a scanned barcode into components
 * P1BBY-QLID000000001 → { palletId: 'P1BBY', qlid: 'QLID000000001' }
 */
export function parseBarcode(barcode: string): { palletId: string; qlid: string } | null {
  const match = barcode.match(/^(P\d+[A-Z]{3})-(QLID\d{9})$/);
  if (!match) return null;
  return {
    palletId: match[1],
    qlid: match[2]
  };
}

// ==================== QSKU (REFURBISHED SKU) ====================

/**
 * Build QSKU from QLID
 * QLID000000001 → RFB-QLID000000001
 */
export function buildQSKU(qlid: string): string {
  return `RFB-${qlid}`;
}

/**
 * Validate QSKU format
 * Valid: RFB-QLID000000001
 */
export function isValidQSKU(qsku: string): boolean {
  return /^RFB-QLID\d{9}$/.test(qsku);
}

/**
 * Parse QSKU to extract QLID
 * RFB-QLID000000001 → { qlid: 'QLID000000001' }
 */
export function parseQSKU(qsku: string): { qlid: string } | null {
  const match = qsku.match(/^RFB-(QLID\d{9})$/);
  if (!match) return null;
  return { qlid: match[1] };
}

// ==================== WORKFLOW STATE MACHINE ====================

/**
 * RefurbState - 15-state workflow for refurbishment
 * Normal flow: QUEUED → ASSIGNED → IN_PROGRESS → SECURITY_PREP_COMPLETE → DIAGNOSED
 *   → REPAIR_IN_PROGRESS → REPAIR_COMPLETE → FINAL_TEST_IN_PROGRESS
 *   → FINAL_TEST_PASSED → CERTIFIED → COMPLETE
 * Escape routes: BLOCKED, ESCALATED, FINAL_TEST_FAILED, FAILED_DISPOSITION
 */
export type RefurbState =
  // Normal flow
  | 'REFURBZ_QUEUED'
  | 'REFURBZ_ASSIGNED'
  | 'REFURBZ_IN_PROGRESS'
  | 'SECURITY_PREP_COMPLETE'
  | 'DIAGNOSED'
  | 'REPAIR_IN_PROGRESS'
  | 'REPAIR_COMPLETE'
  | 'FINAL_TEST_IN_PROGRESS'
  | 'FINAL_TEST_PASSED'
  | 'CERTIFIED'
  | 'REFURBZ_COMPLETE'
  // Escape routes
  | 'REFURBZ_BLOCKED'
  | 'REFURBZ_ESCALATED'
  | 'FINAL_TEST_FAILED'
  | 'REFURBZ_FAILED_DISPOSITION';

export const REFURB_STATE_ORDER: RefurbState[] = [
  'REFURBZ_QUEUED',
  'REFURBZ_ASSIGNED',
  'REFURBZ_IN_PROGRESS',
  'SECURITY_PREP_COMPLETE',
  'DIAGNOSED',
  'REPAIR_IN_PROGRESS',
  'REPAIR_COMPLETE',
  'FINAL_TEST_IN_PROGRESS',
  'FINAL_TEST_PASSED',
  'CERTIFIED',
  'REFURBZ_COMPLETE'
];

export const REFURB_STATE_DISPLAY: Record<RefurbState, string> = {
  REFURBZ_QUEUED: 'Queued',
  REFURBZ_ASSIGNED: 'Assigned',
  REFURBZ_IN_PROGRESS: 'In Progress',
  SECURITY_PREP_COMPLETE: 'Security Prep Complete',
  DIAGNOSED: 'Diagnosed',
  REPAIR_IN_PROGRESS: 'Repair In Progress',
  REPAIR_COMPLETE: 'Repair Complete',
  FINAL_TEST_IN_PROGRESS: 'Final Test In Progress',
  FINAL_TEST_PASSED: 'Final Test Passed',
  CERTIFIED: 'Certified',
  REFURBZ_COMPLETE: 'Complete',
  REFURBZ_BLOCKED: 'Blocked',
  REFURBZ_ESCALATED: 'Escalated',
  FINAL_TEST_FAILED: 'Final Test Failed',
  REFURBZ_FAILED_DISPOSITION: 'Failed - Disposition Required'
};

export type StateType = 'NORMAL' | 'ESCAPE' | 'TERMINAL';

export const REFURB_STATE_TYPE: Record<RefurbState, StateType> = {
  REFURBZ_QUEUED: 'NORMAL',
  REFURBZ_ASSIGNED: 'NORMAL',
  REFURBZ_IN_PROGRESS: 'NORMAL',
  SECURITY_PREP_COMPLETE: 'NORMAL',
  DIAGNOSED: 'NORMAL',
  REPAIR_IN_PROGRESS: 'NORMAL',
  REPAIR_COMPLETE: 'NORMAL',
  FINAL_TEST_IN_PROGRESS: 'NORMAL',
  FINAL_TEST_PASSED: 'NORMAL',
  CERTIFIED: 'NORMAL',
  REFURBZ_COMPLETE: 'TERMINAL',
  REFURBZ_BLOCKED: 'ESCAPE',
  REFURBZ_ESCALATED: 'ESCAPE',
  FINAL_TEST_FAILED: 'ESCAPE',
  REFURBZ_FAILED_DISPOSITION: 'TERMINAL'
};

/**
 * TransitionAction - Actions that trigger state transitions
 */
export type TransitionAction = 'ADVANCE' | 'BLOCK' | 'ESCALATE' | 'FAIL' | 'RESOLVE' | 'RETRY';

// ==================== WORKFLOW STEPS ====================

/**
 * StepType - Types of workflow steps
 */
export type StepType = 'CHECKLIST' | 'INPUT' | 'MEASUREMENT' | 'PHOTO' | 'CONFIRMATION';

/**
 * WorkflowStep - Definition of a step/prompt in the workflow
 */
export interface WorkflowStep {
  id: string;
  code: string;                    // PHONE_FACTORY_RESET, LAPTOP_BIOS_RESET
  name: string;                    // Human-readable name
  type: StepType;
  prompt: string;                  // Main prompt text
  helpText?: string;               // SOP instructions
  required: boolean;
  order: number;                   // Order within the state

  // Type-specific configuration
  checklistItems?: string[];       // For CHECKLIST type
  inputSchema?: Record<string, unknown>;  // JSON Schema for INPUT/MEASUREMENT types
  photoConfig?: {
    required: boolean;
    maxPhotos: number;
    photoTypes: ('BEFORE' | 'AFTER' | 'DEFECT' | 'SERIAL')[];
  };
}

/**
 * StateConfig - Configuration for a workflow state
 */
export interface StateConfig {
  code: RefurbState;
  name: string;
  type: StateType;
  order: number;
  steps: WorkflowStep[];
  allowedTransitions: {
    action: TransitionAction;
    toState: RefurbState;
  }[];
}

// ==================== REFURB JOB ====================

/**
 * RefurbJob - Main job entity for workflow tracking
 */
export interface RefurbJob {
  id: string;
  qlid: string;                    // P1BBY-QLID000000001
  palletId: string;                // P1BBY
  category: ProductCategory;
  manufacturer?: string;
  model?: string;

  // Current workflow position
  currentState: RefurbState;
  currentStepIndex: number;        // Index within current state's steps

  // Assignment
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  assignedAt?: Date;

  // Attempts tracking (for retest loop)
  attemptCount: number;
  maxAttempts: number;             // Default 2

  // Final outcome
  finalGrade?: FinalGrade;
  warrantyEligible?: boolean;
  disposition?: string;            // LISTING, SALVAGE, RECYCLE

  // Priority
  priority: JobPriority;

  // Timestamps
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StepCompletion - Audit trail for completed steps
 */
export interface StepCompletion {
  id: string;
  jobId: string;
  stateCode: RefurbState;
  stepCode: string;

  // Captured data
  checklistResults?: Record<string, boolean>;
  inputValues?: Record<string, unknown>;
  measurements?: Record<string, number>;
  notes?: string;
  photoUrls?: string[];
  photoTypes?: string[];

  // Completion info
  completedBy: string;             // Technician ID
  completedByName?: string;
  durationSeconds?: number;
  completedAt: Date;
}

/**
 * JobDiagnosis - Diagnosis record with defect codes
 */
export interface JobDiagnosis {
  id: string;
  jobId: string;
  defectCode: string;              // SCR001, BAT002
  severity: IssueSeverity;

  // Assessment data
  measurements?: Record<string, number>;
  notes?: string;
  photoUrls?: string[];

  // Repair plan
  repairAction?: 'REPLACE' | 'REPAIR' | 'CLEAN' | 'SKIP';
  partsRequired?: { partId: string; quantity: number }[];
  estimatedMinutes?: number;

  // Repair tracking
  repairStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'SKIPPED';
  repairedAt?: Date;
  repairedBy?: string;
  repairNotes?: string;
  partsUsed?: { partId: string; partNumber: string; quantity: number }[];

  // Timestamps
  diagnosedBy: string;
  diagnosedAt: Date;
}

/**
 * DefectCode - Master list of defect codes
 */
export interface DefectCode {
  id: string;
  code: string;                    // SCR001, BAT002
  category: ProductCategory | 'ALL';
  component: string;               // SCREEN, BATTERY, KEYBOARD
  severity: IssueSeverity;
  description: string;
  repairSop?: string;              // Reference to repair procedure
  estimatedMinutes?: number;
}

// ==================== CATEGORY SOP ====================

/**
 * CategorySOP - Category-specific SOP configuration
 */
export interface CategorySOP {
  category: ProductCategory;
  stateSteps: Map<RefurbState, WorkflowStep[]>;
}

/**
 * SOPOverride - Database override for category SOPs
 */
export interface SOPOverride {
  id: string;
  category: ProductCategory;
  stateCode: RefurbState;
  stepCode: string;
  isApplicable: boolean;           // false = skip this step
  overridePrompt?: string;
  overrideHelpText?: string;
  overrideChecklist?: string[];
  overrideInputSchema?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== WORKFLOW PROMPT ====================

/**
 * WorkflowPrompt - Current prompt state returned by API
 */
export interface WorkflowPrompt {
  job: RefurbJob;
  state: RefurbState;
  stateName: string;

  // Current step
  totalSteps: number;
  currentStepIndex: number;
  currentStep?: WorkflowStep;
  completedSteps: StepCompletion[];

  // Progress
  progress: {
    statesCompleted: number;
    totalStates: number;
    overallPercent: number;
  };

  // Available actions
  canAdvance: boolean;
  canBlock: boolean;
  canEscalate: boolean;
  canRetry: boolean;
}

/**
 * StepCompletionData - Data submitted when completing a step
 */
export interface StepCompletionData {
  checklistResults?: Record<string, boolean>;
  inputValues?: Record<string, unknown>;
  measurements?: Record<string, number>;
  notes?: string;
  photos?: { url: string; type: string }[];
}

/**
 * TransitionData - Data submitted with state transition
 */
export interface TransitionData {
  reason?: string;
  notes?: string;
  finalGrade?: FinalGrade;
  warrantyEligible?: boolean;
  disposition?: string;
}
