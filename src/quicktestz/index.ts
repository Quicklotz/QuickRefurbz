/**
 * QuickTestz - Barrel Export
 * Test bench system for automated electrical/functional testing
 */

// Types
export type {
  ControllerType,
  NetworkType,
  IntegrationType,
  EquipmentCatalogItem,
  EquipmentCatalogInput,
  SafetyFlags,
  TestStation,
  TestStationInput,
  TestOutlet,
  TestOutletInput,
  TestThresholds,
  ChecklistItem,
  TestProfile,
  TestProfileInput,
  TestRunStatus,
  TestRunResult,
  TestRunAnomaly,
  TestRunAttachment,
  TestRun,
  TestRunCreateInput,
  TestReading,
  InstantReadings,
  HealthCheckResult,
  TestRunCompletedEvent,
} from './types.js';

export {
  CONTROLLER_TYPE_DISPLAY,
  TEST_RUN_STATUS_DISPLAY,
  TEST_RUN_RESULT_DISPLAY,
} from './types.js';

// Adapters
export type { PowerControllerAdapter } from './adapters/interface.js';
export { getAdapter } from './adapters/interface.js';

// Services
export * as equipmentCatalog from './services/equipmentCatalog.js';
export * as stationManager from './services/stationManager.js';
export * as profileManager from './services/profileManager.js';
export * as testRunManager from './services/testRunManager.js';
export * as readingsCollector from './services/readingsCollector.js';
export * as safetyMonitor from './services/safetyMonitor.js';

// SCPI Instrument Adapter (re-export from hardware-diag bridge)
export { ScpiInstrumentAdapter } from '../hardware-diag/quicktestz-bridge/scpiAdapter.js';

// Seed
export { seedEquipmentAndProfiles } from './seed/equipmentSeed.js';
