/**
 * QuickDiagnosticz - Diagnostics Module
 * Comprehensive diagnostic testing for consumer electronics
 */

// Types
export * from './types.js';

// Test Definitions
export {
  SMALL_APPLIANCE_TESTS,
  ICE_MAKER_TESTS,
  VACUUM_TESTS,
  getTestsForCategory,
  getTestSuite,
  getCategoryConfig,
  getAllTestSuites,
  getCriticalTests,
  isValidTestCode,
  getTestByCode,
  getCategoryFromTestCode,
} from './testDefinitions.js';

// Session Manager
export {
  startSession,
  getSession,
  getActiveSession,
  recordTestResult,
  completeSession,
  getSessionResults,
  getSessionSummary,
  getSessionDefects,
  listSessions,
  getTechnicianDiagnosticStats,
  getAllTechnicianDiagnosticStats,
} from './sessionManager.js';
export type { TechnicianDiagnosticStats } from './sessionManager.js';

// Result Calculator
export {
  calculateCertificationLevel,
  calculateSessionResult,
  calculatePassRate,
  isWithinRange,
  validateMeasurement,
  getDefectSeverityScore,
  sortDefectsBySeverity,
  calculateEstimatedRepairTime,
  canBeCertified,
  calculateBatchStats,
} from './resultCalculator.js';

// External Checks
export {
  performExternalCheck,
  getExternalChecks,
  getExternalChecksForCertification,
  hasFlags,
  runAllChecks,
} from './externalChecks.js';
