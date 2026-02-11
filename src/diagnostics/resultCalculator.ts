/**
 * QuickDiagnosticz - Result Calculator
 * Calculates certification levels and pass/fail determinations
 */

import { CertificationLevel } from '../certification/types.js';
import {
  DiagnosticTest,
  DiagnosticTestResult,
  DiagnosticDefect,
  SessionResult,
} from './types.js';

/**
 * Calculate certification level based on test results
 *
 * EXCELLENT: 95%+ pass rate, no critical failures, 0-1 minor defects
 * GOOD: 85%+ pass rate, no critical failures, 2-3 minor defects
 * FAIR: 70%+ pass rate, no critical failures, 4+ minor defects
 * NOT_CERTIFIED: <70% pass rate OR any critical failures
 */
export function calculateCertificationLevel(
  passRate: number,
  criticalFailures: number,
  defectCount: number
): CertificationLevel {
  // Any critical failure = not certified
  if (criticalFailures > 0) {
    return 'NOT_CERTIFIED';
  }

  // Below 70% pass rate = not certified
  if (passRate < 70) {
    return 'NOT_CERTIFIED';
  }

  // Determine level based on pass rate and defects
  if (passRate >= 95 && defectCount <= 1) {
    return 'EXCELLENT';
  }

  if (passRate >= 85 && defectCount <= 3) {
    return 'GOOD';
  }

  if (passRate >= 70) {
    return 'FAIR';
  }

  return 'NOT_CERTIFIED';
}

/**
 * Calculate overall session result from individual test results
 */
export function calculateSessionResult(
  results: DiagnosticTestResult[],
  tests: DiagnosticTest[]
): SessionResult {
  // Not enough tests completed
  if (results.length < tests.length) {
    return 'INCOMPLETE';
  }

  // Check for critical failures
  const criticalTests = tests.filter(t => t.isCritical);
  const criticalResults = results.filter(r =>
    criticalTests.some(t => t.code === r.testCode)
  );
  const criticalFailures = criticalResults.filter(r => r.result === 'FAIL');

  if (criticalFailures.length > 0) {
    return 'FAIL';
  }

  return 'PASS';
}

/**
 * Calculate pass rate from test results
 */
export function calculatePassRate(results: DiagnosticTestResult[]): number {
  if (results.length === 0) return 0;

  const passedCount = results.filter(r => r.result === 'PASS').length;
  return (passedCount / results.length) * 100;
}

/**
 * Check if a measurement is within acceptable range
 */
export function isWithinRange(
  value: number,
  min?: number,
  max?: number
): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Validate measurement against test criteria
 */
export function validateMeasurement(
  test: DiagnosticTest,
  measurementValue?: number
): { passed: boolean; message: string } {
  if (test.measurementUnit && measurementValue === undefined) {
    return {
      passed: false,
      message: `Measurement required for test ${test.code}`,
    };
  }

  if (measurementValue !== undefined) {
    const withinRange = isWithinRange(
      measurementValue,
      test.measurementMin,
      test.measurementMax
    );

    if (!withinRange) {
      let message = `Measurement ${measurementValue}${test.measurementUnit || ''} out of range`;
      if (test.measurementMin !== undefined && test.measurementMax !== undefined) {
        message += ` (expected ${test.measurementMin}-${test.measurementMax})`;
      } else if (test.measurementMin !== undefined) {
        message += ` (minimum ${test.measurementMin})`;
      } else if (test.measurementMax !== undefined) {
        message += ` (maximum ${test.measurementMax})`;
      }

      return { passed: false, message };
    }
  }

  return { passed: true, message: 'OK' };
}

/**
 * Get severity score for defects (for sorting/prioritization)
 */
export function getDefectSeverityScore(severity: string): number {
  const scores: Record<string, number> = {
    CRITICAL: 100,
    MAJOR: 75,
    MINOR: 50,
    COSMETIC: 25,
  };
  return scores[severity] || 0;
}

/**
 * Sort defects by severity (most severe first)
 */
export function sortDefectsBySeverity(defects: DiagnosticDefect[]): DiagnosticDefect[] {
  return [...defects].sort(
    (a, b) => getDefectSeverityScore(b.severity) - getDefectSeverityScore(a.severity)
  );
}

/**
 * Calculate estimated repair time based on defects
 */
export function calculateEstimatedRepairTime(defects: DiagnosticDefect[]): number {
  return defects.reduce(
    (total, defect) => total + (defect.repairEstimateMinutes || 0),
    0
  );
}

/**
 * Determine if device can be certified based on results
 */
export function canBeCertified(
  results: DiagnosticTestResult[],
  tests: DiagnosticTest[],
  defects: DiagnosticDefect[]
): { canCertify: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check for incomplete tests
  if (results.length < tests.length) {
    const missingCount = tests.length - results.length;
    reasons.push(`${missingCount} test(s) not completed`);
  }

  // Check for critical failures
  const criticalTests = tests.filter(t => t.isCritical);
  const criticalResults = results.filter(r =>
    criticalTests.some(t => t.code === r.testCode)
  );
  const criticalFailures = criticalResults.filter(r => r.result === 'FAIL');

  if (criticalFailures.length > 0) {
    reasons.push(`${criticalFailures.length} critical test(s) failed`);
  }

  // Check for critical defects
  const criticalDefects = defects.filter(d => d.severity === 'CRITICAL');
  if (criticalDefects.length > 0) {
    reasons.push(`${criticalDefects.length} critical defect(s) found`);
  }

  // Calculate pass rate
  const passRate = calculatePassRate(results);
  if (passRate < 70) {
    reasons.push(`Pass rate ${passRate.toFixed(1)}% below minimum (70%)`);
  }

  return {
    canCertify: reasons.length === 0,
    reasons,
  };
}

/**
 * Generate summary statistics for a batch of sessions
 */
export function calculateBatchStats(sessions: Array<{
  passRate: number;
  criticalFailures: number;
  defectCount: number;
  certificationLevel: CertificationLevel;
}>): {
  totalSessions: number;
  averagePassRate: number;
  byLevel: Record<CertificationLevel, number>;
  certificationRate: number;
} {
  const total = sessions.length;

  const byLevel: Record<CertificationLevel, number> = {
    EXCELLENT: 0,
    GOOD: 0,
    FAIR: 0,
    NOT_CERTIFIED: 0,
  };

  let totalPassRate = 0;
  let certifiedCount = 0;

  for (const session of sessions) {
    totalPassRate += session.passRate;
    byLevel[session.certificationLevel]++;

    if (session.certificationLevel !== 'NOT_CERTIFIED') {
      certifiedCount++;
    }
  }

  return {
    totalSessions: total,
    averagePassRate: total > 0 ? totalPassRate / total : 0,
    byLevel,
    certificationRate: total > 0 ? (certifiedCount / total) * 100 : 0,
  };
}
