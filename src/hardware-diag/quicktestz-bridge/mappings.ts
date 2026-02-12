/**
 * QuickTestz Bridge - Type Mappings
 * Pure functions to convert hardware-diag types into QuickTestz types
 */

import type { HardwareTestStep, HardwareTestStepResult, MeasurementType } from '../types.js';
import type { InstantReadings } from '../../quicktestz/types.js';

/**
 * Map a hardware-diag measurement type to the corresponding InstantReadings field
 */
const MEASUREMENT_TO_FIELD: Partial<Record<MeasurementType, keyof Pick<InstantReadings, 'watts' | 'volts' | 'amps'>>> = {
  POWER_WATTS: 'watts',
  AC_VOLTAGE: 'volts',
  DC_VOLTAGE: 'volts',
  AC_CURRENT: 'amps',
  DC_CURRENT: 'amps',
};

/**
 * Convert a HardwareTestStepResult into QuickTestz InstantReadings
 * so it can be recorded via readingsCollector.recordReading()
 */
export function mapMeasurementToReading(
  step: HardwareTestStep,
  result: HardwareTestStepResult
): InstantReadings {
  const readings: InstantReadings = {
    raw: {
      source: 'hardware-diag',
      testCode: step.testCode,
      stepNumber: step.stepNumber,
      scpiCommand: result.scpiCommand ?? step.scpiCommand,
      status: result.status,
      expectedMin: result.expectedMin ?? step.expectedMin,
      expectedMax: result.expectedMax ?? step.expectedMax,
      instrumentId: result.instrumentId,
      rawResponse: result.rawResponse,
      measuredUnit: result.measuredUnit ?? step.expectedUnit,
      measurementType: step.measurementType,
    },
  };

  if (result.measuredValue === undefined) {
    return readings;
  }

  const field = MEASUREMENT_TO_FIELD[step.measurementType];
  if (field) {
    readings[field] = result.measuredValue;
  }

  // If we have volts and amps in raw but not watts, calculate watts
  if (readings.volts !== undefined && readings.amps !== undefined && readings.watts === undefined) {
    readings.watts = readings.volts * readings.amps;
  }

  return readings;
}
