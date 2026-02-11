/**
 * QuickTestz - Safety Monitor Service
 * Watches active test runs for dangerous conditions and auto-shuts-off.
 *
 * Auto-shutdown rules:
 *   1. watts >= spikeShutdownWatts for >250ms → turnOff + flag anomaly
 *   2. amps exceed outlet maxAmps → turnOff + flag anomaly
 *   3. controller healthCheck fails mid-test → stop test + require operator action
 *
 * Safety first: never energize without configured station + GFCI acknowledgement
 */

import { getAdapter } from '../adapters/interface.js';
import * as testRunManager from './testRunManager.js';
import * as readingsCollector from './readingsCollector.js';
import type {
  TestStation,
  TestOutlet,
  TestProfile,
  TestRunAnomaly,
} from '../types.js';

const SPIKE_WINDOW_MS = 250;
const HEALTH_CHECK_INTERVAL_MS = 30_000;

interface MonitoredRun {
  testRunId: string;
  station: TestStation;
  outlet: TestOutlet;
  profile: TestProfile;
  spikeStartMs: number | null;
  healthTimer: ReturnType<typeof setInterval>;
  monitorTimer: ReturnType<typeof setInterval>;
}

const monitoredRuns = new Map<string, MonitoredRun>();

/**
 * Validate safety preconditions before energizing
 */
export function validateSafety(station: TestStation, outlet: TestOutlet): string[] {
  const errors: string[] = [];

  if (!station.safetyFlags.gfciPresent) {
    errors.push('GFCI presence not acknowledged for this station');
  }
  if (!station.safetyFlags.acknowledgedBy) {
    errors.push('Station safety not acknowledged by any operator');
  }
  if (!outlet.enabled) {
    errors.push('Outlet is disabled');
  }
  if (!outlet.supportsOnOff && station.controllerType !== 'MANUAL') {
    errors.push('Outlet does not support automated on/off control');
  }

  return errors;
}

/**
 * Start monitoring a test run for safety violations
 */
export function startMonitoring(
  testRunId: string,
  station: TestStation,
  outlet: TestOutlet,
  profile: TestProfile
): void {
  if (monitoredRuns.has(testRunId)) return;

  // Monitor readings every 250ms for spike detection
  const monitorTimer = setInterval(async () => {
    try {
      await checkReadings(testRunId);
    } catch (err) {
      console.error(`[SafetyMonitor] Reading check error for ${testRunId}:`, err);
    }
  }, SPIKE_WINDOW_MS);

  // Periodic health check
  const healthTimer = setInterval(async () => {
    try {
      await checkHealth(testRunId);
    } catch (err) {
      console.error(`[SafetyMonitor] Health check error for ${testRunId}:`, err);
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  monitoredRuns.set(testRunId, {
    testRunId,
    station,
    outlet,
    profile,
    spikeStartMs: null,
    healthTimer,
    monitorTimer,
  });
}

/**
 * Stop monitoring a test run
 */
export function stopMonitoring(testRunId: string): void {
  const monitored = monitoredRuns.get(testRunId);
  if (!monitored) return;

  clearInterval(monitored.monitorTimer);
  clearInterval(monitored.healthTimer);
  monitoredRuns.delete(testRunId);
}

/**
 * Stop all monitoring (cleanup on shutdown)
 */
export function stopAll(): void {
  for (const [id] of monitoredRuns) {
    stopMonitoring(id);
  }
}

/**
 * Check if a run is being monitored
 */
export function isMonitored(testRunId: string): boolean {
  return monitoredRuns.has(testRunId);
}

// ==================== PRIVATE ====================

async function checkReadings(testRunId: string): Promise<void> {
  const monitored = monitoredRuns.get(testRunId);
  if (!monitored) return;

  const latest = await readingsCollector.getLatestReading(testRunId);
  if (!latest) return;

  const { profile, outlet } = monitored;
  const now = Date.now();

  // Check spike threshold
  if (latest.watts !== undefined && latest.watts >= profile.thresholds.spikeShutdownWatts) {
    if (monitored.spikeStartMs === null) {
      monitored.spikeStartMs = now;
    } else if (now - monitored.spikeStartMs >= SPIKE_WINDOW_MS) {
      // Spike exceeded 250ms window → emergency shutdown
      await emergencyShutdown(testRunId, {
        type: 'SPIKE',
        message: `Power spike ${latest.watts}W exceeded shutdown threshold ${profile.thresholds.spikeShutdownWatts}W for >250ms`,
        timestamp: new Date().toISOString(),
        value: latest.watts,
        threshold: profile.thresholds.spikeShutdownWatts,
      });
      return;
    }
  } else {
    monitored.spikeStartMs = null;
  }

  // Check overcurrent
  if (latest.amps !== undefined && outlet.maxAmps && latest.amps > outlet.maxAmps) {
    await emergencyShutdown(testRunId, {
      type: 'OVERCURRENT',
      message: `Current ${latest.amps}A exceeds outlet max ${outlet.maxAmps}A`,
      timestamp: new Date().toISOString(),
      value: latest.amps,
      threshold: outlet.maxAmps,
    });
  }
}

async function checkHealth(testRunId: string): Promise<void> {
  const monitored = monitoredRuns.get(testRunId);
  if (!monitored) return;

  const adapter = getAdapter(monitored.station.controllerType);
  const health = await adapter.healthCheck(monitored.station);

  if (!health.ok) {
    await emergencyShutdown(testRunId, {
      type: 'HEALTH_FAIL',
      message: `Controller health check failed: ${JSON.stringify(health.details)}`,
      timestamp: new Date().toISOString(),
    });
  }
}

async function emergencyShutdown(
  testRunId: string,
  anomaly: TestRunAnomaly
): Promise<void> {
  const monitored = monitoredRuns.get(testRunId);
  if (!monitored) return;

  console.error(`[SafetyMonitor] EMERGENCY SHUTDOWN for ${testRunId}: ${anomaly.message}`);

  // 1. Turn off outlet immediately
  const adapter = getAdapter(monitored.station.controllerType);
  await adapter.turnOff(monitored.station, monitored.outlet);

  // 2. Stop readings collection
  readingsCollector.stopCollecting(testRunId);

  // 3. Record anomaly
  await testRunManager.addAnomaly(testRunId, anomaly);

  // 4. Set run status to ABORTED
  await testRunManager.updateTestRunStatus(testRunId, 'ABORTED');

  // 5. Stop monitoring
  stopMonitoring(testRunId);
}
