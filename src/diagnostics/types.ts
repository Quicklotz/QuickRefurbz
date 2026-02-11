/**
 * QuickDiagnosticz - Diagnostic Types
 * Comprehensive diagnostic testing and certification system
 *
 * Part of QuickRefurbz - Extends the DIAGNOSED workflow state
 */

import { ProductCategory, IssueSeverity } from '../types.js';

// ==================== DIAGNOSTIC TEST TYPES ====================

/**
 * TestType - Classification of diagnostic tests
 */
export type DiagnosticTestType =
  | 'FUNCTIONAL'    // Does the component work?
  | 'MEASUREMENT'   // Quantifiable metric (suction power, temperature, etc.)
  | 'VISUAL'        // Visual inspection (cosmetic, damage)
  | 'SAFETY';       // Safety-related checks (electrical, heat)

/**
 * TestResult - Outcome of a single test
 */
export type TestResult = 'PASS' | 'FAIL' | 'SKIP' | 'N/A';

/**
 * SessionResult - Overall outcome of a diagnostic session
 */
export type SessionResult = 'PASS' | 'FAIL' | 'INCOMPLETE';

// ==================== DIAGNOSTIC TEST DEFINITION ====================

/**
 * DiagnosticTest - Master definition of a diagnostic test
 * Stored in diagnostic_tests table
 */
export interface DiagnosticTest {
  id: string;
  code: string;                        // SA-PWR-001, IM-CMP-001, VC-SUC-001
  name: string;                        // "Power On Test"
  category: ProductCategory;           // Which product category this applies to

  testType: DiagnosticTestType;        // FUNCTIONAL, MEASUREMENT, VISUAL, SAFETY
  description: string;                 // Full description
  instructions: string;                // Step-by-step test instructions
  passCriteria: string;                // What constitutes a pass

  // For MEASUREMENT tests
  measurementUnit?: string;            // null, 'dB', 'watts', '%', 'CFM', 'F', 'C'
  measurementMin?: number;             // Minimum acceptable value
  measurementMax?: number;             // Maximum acceptable value

  // Criticality
  isCritical: boolean;                 // If failed, device cannot be certified

  // Display
  displayOrder: number;                // Order within the category test suite

  // Metadata
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * DiagnosticTestInput - Input for creating a diagnostic test
 */
export interface DiagnosticTestInput {
  code: string;
  name: string;
  category: ProductCategory;
  testType: DiagnosticTestType;
  description: string;
  instructions: string;
  passCriteria: string;
  measurementUnit?: string;
  measurementMin?: number;
  measurementMax?: number;
  isCritical: boolean;
  displayOrder: number;
}

// ==================== DIAGNOSTIC SESSION ====================

/**
 * DiagnosticSession - A testing session for a single item
 * Created when technician starts diagnosing an item
 */
export interface DiagnosticSession {
  id: string;
  sessionNumber: string;               // DS-20260208-0001

  // References
  jobId?: string;                      // Reference to RefurbJob if in workflow
  qlid: string;                        // QLID of the item
  category: ProductCategory;           // Category determines test suite

  // Technician
  technicianId: string;
  technicianName?: string;

  // Timing
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;

  // Test counts
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;

  // Outcome
  overallResult?: SessionResult;       // PASS, FAIL, INCOMPLETE
  notes?: string;

  // Metadata
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * DiagnosticSessionInput - Input for creating a session
 */
export interface DiagnosticSessionInput {
  qlid: string;
  jobId?: string;
  category: ProductCategory;
  technicianId: string;
  technicianName?: string;
}

// ==================== DIAGNOSTIC TEST RESULT ====================

/**
 * DiagnosticTestResult - Result of a single test within a session
 */
export interface DiagnosticTestResult {
  id: string;
  sessionId: string;                   // Reference to DiagnosticSession
  testId: string;                      // Reference to DiagnosticTest
  testCode: string;                    // Denormalized for convenience

  result: TestResult;                  // PASS, FAIL, SKIP, N/A

  // For MEASUREMENT tests
  measurementValue?: number;
  measurementUnit?: string;

  // Evidence
  notes?: string;
  photoUrls?: string[];

  // Technician
  testedBy: string;
  testedAt: Date;
}

/**
 * DiagnosticTestResultInput - Input for recording a test result
 */
export interface DiagnosticTestResultInput {
  sessionId: string;
  testId: string;
  testCode: string;
  result: TestResult;
  measurementValue?: number;
  measurementUnit?: string;
  notes?: string;
  photoUrls?: string[];
  testedBy: string;
}

// ==================== DIAGNOSTIC DEFECT ====================

/**
 * DiagnosticDefect - A defect found during diagnosis
 * Linked to failed tests
 */
export interface DiagnosticDefect {
  id: string;
  sessionId: string;
  testResultId?: string;               // Optional link to specific test

  defectCode: string;                  // PWR-FAIL, MTR-FAIL, etc.
  component: string;                   // MOTOR, COMPRESSOR, FILTER, etc.
  severity: IssueSeverity;

  description: string;
  notes?: string;
  photoUrls?: string[];

  // Repair recommendation
  repairAction?: 'REPLACE' | 'REPAIR' | 'CLEAN' | 'ADJUST' | 'NO_ACTION';
  repairEstimateMinutes?: number;
  partsRequired?: string[];

  // Timestamps
  createdAt: Date;
}

// ==================== CATEGORY TEST SUITES ====================

/**
 * TestSuite - Collection of tests for a category
 */
export interface TestSuite {
  category: ProductCategory;
  categoryName: string;
  tests: DiagnosticTest[];
  criticalTestCount: number;
  totalTestCount: number;
}

/**
 * CategoryTestConfig - Configuration for category-specific testing
 */
export interface CategoryTestConfig {
  category: ProductCategory;
  estimatedMinutes: number;            // Estimated time to complete
  requiresSpecialEquipment: boolean;
  equipmentList?: string[];
  additionalInstructions?: string;
}

// ==================== SESSION SUMMARY ====================

/**
 * DiagnosticSessionSummary - Summary of a completed session
 */
export interface DiagnosticSessionSummary {
  session: DiagnosticSession;
  results: DiagnosticTestResult[];
  defects: DiagnosticDefect[];

  // Calculated fields
  passRate: number;                    // 0-100
  criticalFailures: number;
  canCertify: boolean;                 // No critical failures

  // Recommended certification level based on results
  recommendedCertification?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NOT_CERTIFIED';
}

// ==================== TEST PLAN ====================

/**
 * TestPlan - Customizable test plan for a category
 * Allows enabling/disabling specific tests
 */
export interface TestPlan {
  id: string;
  category: ProductCategory;
  name: string;                        // "Standard Small Appliance Plan"
  description?: string;

  // Test configuration
  enabledTests: string[];              // Array of test codes
  disabledTests: string[];             // Tests explicitly disabled

  // Settings
  isDefault: boolean;                  // Default plan for this category
  requireAllCritical: boolean;         // Must pass all critical tests

  // Metadata
  createdBy?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ==================== EXTERNAL CHECKS ====================

/**
 * ExternalCheckType - Types of external API checks
 */
export type ExternalCheckType =
  | 'IMEI'           // Phone/tablet IMEI check
  | 'SERIAL'         // Serial number lookup
  | 'WARRANTY'       // Warranty status check
  | 'RECALL'         // Product recall check
  | 'STOLEN';        // Stolen device database

/**
 * ExternalCheckProvider - API providers
 */
export type ExternalCheckProvider =
  | 'IMEI_INFO'
  | 'CHECKMEND'
  | 'APPLE_GSX'
  | 'SAMSUNG_CHECK'
  | 'CPSC_RECALL'    // Consumer Product Safety Commission
  | 'MANUAL';        // Manual entry

/**
 * ExternalCheckStatus - Result of external check
 */
export type ExternalCheckStatus = 'CLEAR' | 'FLAGGED' | 'ERROR' | 'PENDING' | 'NOT_CHECKED';

/**
 * ExternalCheck - Result of an external API check
 */
export interface ExternalCheck {
  id: string;
  certificationId?: string;
  sessionId?: string;
  qlid: string;

  checkType: ExternalCheckType;
  provider: ExternalCheckProvider;

  // Request/Response
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;

  // Result
  status: ExternalCheckStatus;
  statusDetails?: string;

  // For specific checks
  isStolen?: boolean;                  // STOLEN check
  isBlacklisted?: boolean;             // IMEI blacklist
  hasFinancialHold?: boolean;          // Unpaid device
  warrantyStatus?: string;             // WARRANTY check
  recallStatus?: string;               // RECALL check

  // Timestamps
  checkedAt: Date;
  expiresAt?: Date;                    // When to re-check
}

// ==================== STATISTICS ====================

/**
 * DiagnosticStats - Aggregated statistics
 */
export interface DiagnosticStats {
  period: 'today' | 'week' | 'month' | 'all';

  totalSessions: number;
  completedSessions: number;
  passedSessions: number;
  failedSessions: number;

  passRate: number;

  byCategory: Record<ProductCategory, {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  }>;

  commonDefects: Array<{
    defectCode: string;
    component: string;
    count: number;
    percentage: number;
  }>;

  averageDurationSeconds: number;
}

// ==================== API TYPES ====================

/**
 * StartSessionRequest - API request to start a session
 */
export interface StartSessionRequest {
  qlid: string;
  jobId?: string;
  category: ProductCategory;
  technicianId: string;
  technicianName?: string;
  testPlanId?: string;                 // Optional custom test plan
}

/**
 * RecordTestResultRequest - API request to record a test result
 */
export interface RecordTestResultRequest {
  testCode: string;
  result: TestResult;
  measurementValue?: number;
  notes?: string;
  photoUrls?: string[];
}

/**
 * CompleteSessionRequest - API request to complete a session
 */
export interface CompleteSessionRequest {
  notes?: string;
  defects?: Array<{
    defectCode: string;
    component: string;
    severity: IssueSeverity;
    description: string;
    notes?: string;
    photoUrls?: string[];
    repairAction?: 'REPLACE' | 'REPAIR' | 'CLEAN' | 'ADJUST' | 'NO_ACTION';
  }>;
}

/**
 * SessionResponse - API response for session operations
 */
export interface SessionResponse {
  success: boolean;
  session: DiagnosticSession;
  tests?: DiagnosticTest[];
  results?: DiagnosticTestResult[];
  summary?: DiagnosticSessionSummary;
  message?: string;
}
