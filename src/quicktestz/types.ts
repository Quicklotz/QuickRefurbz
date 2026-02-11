/**
 * QuickTestz - Type Definitions
 * Test bench system for automated electrical/functional testing
 *
 * Safety first: never energize without configured station + GFCI acknowledgement
 * Human-in-the-loop: operator confirmations alongside sensor readings
 * Deterministic logging: every test run produces durable record tied to QLID
 */

// ==================== CONTROLLER / ADAPTER TYPES ====================

export type ControllerType =
  | 'SHELLY_GEN2_HTTP'
  | 'IOTAWATT_HTTP'
  | 'SNMP_PDU'
  | 'MANUAL';

export type NetworkType = 'LAN' | 'WiFi' | 'None';

export type IntegrationType =
  | 'SHELLY_GEN2_HTTP'
  | 'IOTAWATT_HTTP'
  | 'SNMP_PDU'
  | 'MANUAL';

// ==================== EQUIPMENT CATALOG ====================

export interface EquipmentCatalogItem {
  id: string;
  name: string;
  category: string;
  vendor: string;
  model: string;
  integrationType: IntegrationType;
  connection: string[];             // ['LAN', 'WiFi']
  capabilities: string[];           // ['outlet_on_off', 'per_channel_power_metering']
  linkUrl: string;
  requiredForCategories: string[];  // ['VACUUM', 'ICE_MAKER', 'SMALL_APPLIANCE']
  notes?: string;
  isCustom: boolean;                // Admin-added vs seed
  createdAt: Date;
  updatedAt?: Date;
}

export interface EquipmentCatalogInput {
  name: string;
  category: string;
  vendor: string;
  model: string;
  integrationType: IntegrationType;
  connection?: string[];
  capabilities?: string[];
  linkUrl?: string;
  requiredForCategories?: string[];
  notes?: string;
}

// ==================== TEST STATIONS ====================

export interface SafetyFlags {
  gfciPresent?: boolean;
  surgeProtection?: boolean;
  fireSafeArea?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface TestStation {
  id: string;
  name: string;
  location?: string;
  controllerType: ControllerType;
  controllerBaseUrl?: string;       // IP or hostname for network controllers
  networkType?: NetworkType;
  safetyFlags: SafetyFlags;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TestStationInput {
  name: string;
  location?: string;
  controllerType: ControllerType;
  controllerBaseUrl?: string;
  networkType?: NetworkType;
  safetyFlags?: SafetyFlags;
}

// ==================== TEST OUTLETS ====================

export interface TestOutlet {
  id: string;
  stationId: string;
  label: string;
  controllerChannel: string;        // e.g. '0', '1', '2', '3' for Shelly 4-channel
  maxAmps?: number;
  supportsOnOff: boolean;
  supportsPowerMetering: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TestOutletInput {
  stationId: string;
  label: string;
  controllerChannel: string;
  maxAmps?: number;
  supportsOnOff?: boolean;
  supportsPowerMetering?: boolean;
  enabled?: boolean;
}

// ==================== TEST PROFILES ====================

export interface TestThresholds {
  maxPeakWatts: number;
  minStableWatts: number;
  maxStableWatts: number;
  spikeShutdownWatts: number;
  minRunSeconds: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  type: 'boolean' | 'number' | 'text';
  required: boolean;
}

export interface TestProfile {
  id: string;
  category: string;                  // 'VACUUM' | 'ICE_MAKER' | 'SMALL_APPLIANCE'
  name: string;
  thresholds: TestThresholds;
  operatorChecklist: ChecklistItem[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface TestProfileInput {
  category: string;
  name: string;
  thresholds: TestThresholds;
  operatorChecklist: ChecklistItem[];
}

// ==================== TEST RUNS ====================

export type TestRunStatus =
  | 'CREATED'       // Run record created, not started
  | 'ENERGIZED'     // Outlet powered on, collecting readings
  | 'COLLECTING'    // Actively collecting readings
  | 'CHECKLIST'     // Waiting for operator checklist
  | 'COMPUTING'     // Computing results
  | 'COMPLETED'     // Finished
  | 'ABORTED'       // Manually stopped
  | 'ERROR';        // System error

export type TestRunResult =
  | 'PASS'
  | 'FAIL'
  | 'ANOMALY'       // Passed but with anomalies flagged
  | 'INCOMPLETE';

export interface TestRunAnomaly {
  type: string;                      // 'SPIKE', 'OVERCURRENT', 'HEALTH_FAIL'
  message: string;
  timestamp: string;
  value?: number;
  threshold?: number;
}

export interface TestRunAttachment {
  type: 'photo' | 'document' | 'video';
  url: string;
  name: string;
  uploadedAt: string;
}

export interface TestRun {
  id: string;
  qlid: string;
  palletId?: string;
  profileId: string;
  stationId: string;
  outletId: string;
  operatorUserId?: string;
  status: TestRunStatus;
  startedAt?: Date;
  endedAt?: Date;
  result?: TestRunResult;
  score?: number;                    // 0-100
  anomalies: TestRunAnomaly[];
  notes?: string;
  attachments: TestRunAttachment[];
  checklistValues?: Record<string, unknown>;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TestRunCreateInput {
  qlid: string;
  palletId?: string;
  profileId: string;
  stationId: string;
  outletId: string;
  operatorUserId?: string;
}

// ==================== TEST READINGS ====================

export interface TestReading {
  id: string;
  testRunId: string;
  ts: Date;
  watts?: number;
  volts?: number;
  amps?: number;
  tempC?: number;
  pressure?: number;
  raw: Record<string, unknown>;
}

// ==================== ADAPTER INTERFACES ====================

export interface InstantReadings {
  watts?: number;
  volts?: number;
  amps?: number;
  raw: Record<string, unknown>;
}

export interface HealthCheckResult {
  ok: boolean;
  details: Record<string, unknown>;
}

// ==================== EVENTS ====================

export interface TestRunCompletedEvent {
  topic: 'quicktestz.test_run.completed';
  testRunId: string;
  qlid: string;
  profileId: string;
  result: TestRunResult;
  score?: number;
  anomalies: TestRunAnomaly[];
  stationId: string;
  outletId: string;
  startedAt: string;
  endedAt: string;
}

// ==================== DISPLAY HELPERS ====================

export const CONTROLLER_TYPE_DISPLAY: Record<ControllerType, string> = {
  SHELLY_GEN2_HTTP: 'Shelly Gen2 (HTTP)',
  IOTAWATT_HTTP: 'IoTaWatt (HTTP)',
  SNMP_PDU: 'SNMP PDU',
  MANUAL: 'Manual',
};

export const TEST_RUN_STATUS_DISPLAY: Record<TestRunStatus, string> = {
  CREATED: 'Created',
  ENERGIZED: 'Energized',
  COLLECTING: 'Collecting Readings',
  CHECKLIST: 'Awaiting Checklist',
  COMPUTING: 'Computing Results',
  COMPLETED: 'Completed',
  ABORTED: 'Aborted',
  ERROR: 'Error',
};

export const TEST_RUN_RESULT_DISPLAY: Record<TestRunResult, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  ANOMALY: 'Pass (Anomalies)',
  INCOMPLETE: 'Incomplete',
};
