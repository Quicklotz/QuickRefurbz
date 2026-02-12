/**
 * QuickRefurbz - Hardware Diagnostics Module
 * Automated hardware-level testing using real instruments
 *
 * Integrates with existing DiagnosticSession system
 */

// Types
export * from './types.js';

// Instruments
export { detectPorts, matchKnownInstruments } from './instruments/detector.js';
export { ScpiController } from './instruments/scpi.js';
export { SigrokWrapper } from './instruments/sigrok.js';
export {
  registerInstrument,
  getInstrument,
  listInstruments,
  updateInstrumentStatus,
  deleteInstrument,
} from './instruments/registry.js';

// Testing
export { MeasurementValidator } from './testing/measurementValidator.js';
export { ResultRecorder } from './testing/resultRecorder.js';
export { TestPlanLoader } from './testing/testPlanLoader.js';
export { HardwareTestRunner } from './testing/testRunner.js';

// QuickTestz Bridge
export { QuickTestzBridge, ScpiInstrumentAdapter, mapMeasurementToReading } from './quicktestz-bridge/index.js';
