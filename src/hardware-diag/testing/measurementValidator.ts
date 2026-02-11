/**
 * Hardware Diagnostics - Measurement Validator
 * Validates hardware measurements against expected ranges
 */

import type {
  HardwareTestStep,
  StepResultStatus,
} from '../types.js';

export interface ValidationResult {
  status: StepResultStatus;
  message: string;
  withinRange: boolean;
  deviationPercent?: number;
}

export class MeasurementValidator {
  /**
   * Validate a measured value against a test step's expected range
   */
  validate(step: HardwareTestStep, measuredValue?: number): ValidationResult {
    if (measuredValue === undefined || measuredValue === null) {
      return {
        status: 'ERROR',
        message: `No measurement received for ${step.testCode}`,
        withinRange: false,
      };
    }

    const { expectedMin, expectedMax, tolerancePercent } = step;

    // Apply tolerance if specified
    let min = expectedMin;
    let max = expectedMax;

    if (tolerancePercent !== undefined && tolerancePercent > 0) {
      const midpoint = (expectedMin + expectedMax) / 2;
      const range = expectedMax - expectedMin;
      const toleranceAmount = midpoint * (tolerancePercent / 100);
      min = expectedMin - toleranceAmount;
      max = expectedMax + toleranceAmount;
    }

    const withinRange = measuredValue >= min && measuredValue <= max;

    // Calculate deviation from the nearest boundary
    let deviationPercent: number | undefined;
    if (!withinRange) {
      const midpoint = (expectedMin + expectedMax) / 2;
      if (midpoint !== 0) {
        deviationPercent = Math.abs(
          ((measuredValue - midpoint) / midpoint) * 100
        );
      }
    }

    if (withinRange) {
      return {
        status: 'PASS',
        message: `${measuredValue} ${step.expectedUnit} within range [${expectedMin}-${expectedMax}]`,
        withinRange: true,
      };
    }

    return {
      status: 'FAIL',
      message: `${measuredValue} ${step.expectedUnit} out of range [${expectedMin}-${expectedMax}]${
        deviationPercent !== undefined
          ? ` (${deviationPercent.toFixed(1)}% deviation)`
          : ''
      }`,
      withinRange: false,
      deviationPercent,
    };
  }

  /**
   * Check if a value is within range (simple helper)
   */
  isWithinRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Calculate deviation percentage from expected midpoint
   */
  calculateDeviation(
    measured: number,
    expectedMin: number,
    expectedMax: number
  ): number {
    const midpoint = (expectedMin + expectedMax) / 2;
    if (midpoint === 0) return measured === 0 ? 0 : 100;
    return Math.abs(((measured - midpoint) / midpoint) * 100);
  }

  /**
   * Determine pass/fail based on critical flag and measurement
   */
  determineStepStatus(
    step: HardwareTestStep,
    measuredValue?: number,
    timedOut?: boolean
  ): StepResultStatus {
    if (timedOut) return 'TIMEOUT';
    if (measuredValue === undefined) return 'ERROR';

    const result = this.validate(step, measuredValue);
    return result.status;
  }
}
