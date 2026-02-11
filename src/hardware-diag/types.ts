/**
 * QuickRefurbz - Hardware Diagnostics Types
 * Type definitions for automated hardware-level testing
 *
 * Integrates with existing DiagnosticSession system via
 * diagnostic_test_results table
 */

import { ProductCategory } from '../types.js';

// ==================== INSTRUMENT TYPES ====================

export type InstrumentType =
  | 'SCPI_MULTIMETER'
  | 'PROGRAMMABLE_PSU'
  | 'USB_PD_TESTER'
  | 'SIGROK_LOGIC_ANALYZER'
  | 'AC_POWER_METER'
  | 'THERMOCOUPLE'
  | 'CURRENT_CLAMP';

export type InstrumentStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'DISCONNECTED';

export type ConnectionType = 'SERIAL' | 'USB' | 'TCP' | 'GPIB';

export interface HardwareInstrument {
  id: string;
  name: string;
  type: InstrumentType;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  connectionType: ConnectionType;
  connectionPath: string;       // e.g. /dev/ttyUSB0, 192.168.1.50:5555
  baudRate?: number;
  status: InstrumentStatus;
  lastSeenAt?: Date;
  capabilities: string[];       // e.g. ['voltage', 'current', 'resistance']
  firmwareVersion?: string;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface HardwareInstrumentInput {
  name: string;
  type: InstrumentType;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  connectionType: ConnectionType;
  connectionPath: string;
  baudRate?: number;
  capabilities?: string[];
  firmwareVersion?: string;
  notes?: string;
}

// ==================== SERIAL PORT DETECTION ====================

export interface DetectedPort {
  path: string;
  manufacturer?: string;
  productId?: string;
  vendorId?: string;
  serialNumber?: string;
  pnpId?: string;
  friendlyName?: string;
}

export interface KnownInstrumentMatch {
  port: DetectedPort;
  type: InstrumentType;
  manufacturer: string;
  model: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Known VID/PID pairs for auto-detection
export const KNOWN_INSTRUMENTS: Array<{
  vendorId: string;
  productId?: string;
  type: InstrumentType;
  manufacturer: string;
  model: string;
}> = [
  // FTDI-based instruments (Rigol, Keysight)
  { vendorId: '0403', productId: '6001', type: 'SCPI_MULTIMETER', manufacturer: 'FTDI', model: 'Serial Adapter' },
  // Korad PSU
  { vendorId: '0416', productId: '5011', type: 'PROGRAMMABLE_PSU', manufacturer: 'Korad', model: 'KA3005P' },
  // Cypress fx2lafw (Saleae clone)
  { vendorId: '04B4', productId: '8613', type: 'SIGROK_LOGIC_ANALYZER', manufacturer: 'Cypress', model: 'fx2lafw' },
  { vendorId: '1D50', productId: '608C', type: 'SIGROK_LOGIC_ANALYZER', manufacturer: 'Saleae', model: 'Logic Clone' },
  // Uni-T current clamp
  { vendorId: '1A86', productId: '7523', type: 'CURRENT_CLAMP', manufacturer: 'QinHeng', model: 'CH340 Serial' },
  // Silicon Labs CP210x (many instruments)
  { vendorId: '10C4', productId: 'EA60', type: 'SCPI_MULTIMETER', manufacturer: 'Silicon Labs', model: 'CP210x' },
];

// ==================== SCPI TYPES ====================

export interface ScpiResponse {
  raw: string;
  value?: number;
  unit?: string;
  error?: string;
  timestamp: Date;
}

export interface ScpiMeasurement {
  command: string;
  response: ScpiResponse;
  instrumentId: string;
  measuredAt: Date;
}

// ==================== SIGROK TYPES ====================

export interface SigrokDevice {
  driver: string;
  description: string;
  channels: string[];
  sampleRates?: string[];
}

export interface SigrokCapture {
  id: string;
  instrumentId: string;
  filePath: string;
  driver: string;
  sampleRate: string;
  durationMs: number;
  channels: string[];
  triggerCondition?: string;
  capturedAt: Date;
  fileSize?: number;
}

export interface SigrokCaptureInput {
  instrumentId: string;
  driver: string;
  sampleRate?: string;
  durationMs?: number;
  channels?: string[];
  triggerCondition?: string;
  outputFormat?: 'sr' | 'csv' | 'vcd';
}

export interface SigrokDecodeResult {
  protocol: string;
  annotations: Array<{
    startSample: number;
    endSample: number;
    data: string;
    type: string;
  }>;
  decodedAt: Date;
}

// ==================== HARDWARE TEST PLAN ====================

export type MeasurementType =
  | 'DC_VOLTAGE'
  | 'AC_VOLTAGE'
  | 'DC_CURRENT'
  | 'AC_CURRENT'
  | 'RESISTANCE'
  | 'POWER_WATTS'
  | 'TEMPERATURE'
  | 'FREQUENCY'
  | 'CAPACITANCE'
  | 'SUCTION_CFM'
  | 'LOGIC_SIGNAL';

export interface HardwareTestStep {
  stepNumber: number;
  testCode: string;          // HW-APL-PWR-001
  name: string;
  description: string;
  measurementType: MeasurementType;
  scpiCommand?: string;      // e.g. 'MEAS:VOLT:DC?'
  sigrokConfig?: {
    driver: string;
    sampleRate: string;
    durationMs: number;
    decoder?: string;
  };
  expectedUnit: string;
  expectedMin: number;
  expectedMax: number;
  tolerancePercent?: number;
  isCritical: boolean;
  setupInstructions?: string;
  instrumentType: InstrumentType;
  timeoutMs?: number;
  retryCount?: number;
}

export interface HardwareTestPlan {
  id: string;
  category: ProductCategory;
  name: string;
  description: string;
  version: string;
  estimatedMinutes: number;
  requiredInstruments: InstrumentType[];
  steps: HardwareTestStep[];
  safetyWarnings?: string[];
  createdAt: string;
}

// ==================== TEST EXECUTION ====================

export type HardwareTestStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED'
  | 'ERROR';

export type StepResultStatus = 'PASS' | 'FAIL' | 'SKIP' | 'ERROR' | 'TIMEOUT';

export interface HardwareTestExecution {
  id: string;
  qlid: string;
  planId: string;
  category: ProductCategory;
  diagnosticSessionId?: string;  // Links to existing diagnostic_sessions
  status: HardwareTestStatus;
  operatorId?: string;
  operatorName?: string;
  stationId?: string;
  startedAt: Date;
  completedAt?: Date;
  totalSteps: number;
  completedSteps: number;
  passedSteps: number;
  failedSteps: number;
  overallResult?: 'PASS' | 'FAIL' | 'INCOMPLETE';
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface HardwareTestStepResult {
  id: string;
  executionId: string;
  stepNumber: number;
  testCode: string;
  status: StepResultStatus;
  measuredValue?: number;
  measuredUnit?: string;
  expectedMin?: number;
  expectedMax?: number;
  instrumentId?: string;
  scpiCommand?: string;
  rawResponse?: string;
  diagnosticTestResultId?: string;  // Links to diagnostic_test_results
  errorMessage?: string;
  durationMs?: number;
  measuredAt: Date;
}

export interface HardwareTestStepResultInput {
  executionId: string;
  stepNumber: number;
  testCode: string;
  status: StepResultStatus;
  measuredValue?: number;
  measuredUnit?: string;
  expectedMin?: number;
  expectedMax?: number;
  instrumentId?: string;
  scpiCommand?: string;
  rawResponse?: string;
  errorMessage?: string;
  durationMs?: number;
}

// ==================== DISPLAY HELPERS ====================

export const INSTRUMENT_TYPE_DISPLAY: Record<InstrumentType, string> = {
  SCPI_MULTIMETER: 'SCPI Multimeter',
  PROGRAMMABLE_PSU: 'Programmable PSU',
  USB_PD_TESTER: 'USB PD Tester',
  SIGROK_LOGIC_ANALYZER: 'Logic Analyzer',
  AC_POWER_METER: 'AC Power Meter',
  THERMOCOUPLE: 'Thermocouple',
  CURRENT_CLAMP: 'Current Clamp',
};

export const MEASUREMENT_TYPE_DISPLAY: Record<MeasurementType, string> = {
  DC_VOLTAGE: 'DC Voltage',
  AC_VOLTAGE: 'AC Voltage',
  DC_CURRENT: 'DC Current',
  AC_CURRENT: 'AC Current',
  RESISTANCE: 'Resistance',
  POWER_WATTS: 'Power (Watts)',
  TEMPERATURE: 'Temperature',
  FREQUENCY: 'Frequency',
  CAPACITANCE: 'Capacitance',
  SUCTION_CFM: 'Suction (CFM)',
  LOGIC_SIGNAL: 'Logic Signal',
};

export const CONNECTION_TYPE_DISPLAY: Record<ConnectionType, string> = {
  SERIAL: 'Serial (RS-232)',
  USB: 'USB',
  TCP: 'TCP/IP (LAN)',
  GPIB: 'GPIB (IEEE-488)',
};

export const STATUS_DISPLAY: Record<InstrumentStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ERROR: 'Error',
  DISCONNECTED: 'Disconnected',
};
