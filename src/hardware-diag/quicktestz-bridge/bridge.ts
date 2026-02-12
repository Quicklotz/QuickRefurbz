/**
 * QuickTestz Bridge - Main Orchestrator
 * Wires hardware-diag CLI to QuickTestz station/run management.
 *
 * Enables the CLI to:
 *   - Use QuickTestz stations to energize/de-energize via Shelly/IoTaWatt
 *     while hardware-diag takes SCPI measurements
 *   - Record SCPI results as QuickTestz test_readings
 *   - Create/start/stop/complete QuickTestz test runs from the CLI
 *   - Show a unified view of stations + instruments
 */

import { getAdapter } from '../../quicktestz/adapters/interface.js';
import type { PowerControllerAdapter } from '../../quicktestz/adapters/interface.js';
import * as stationManager from '../../quicktestz/services/stationManager.js';
import * as profileManager from '../../quicktestz/services/profileManager.js';
import * as testRunManager from '../../quicktestz/services/testRunManager.js';
import * as readingsCollector from '../../quicktestz/services/readingsCollector.js';
import * as safetyMonitor from '../../quicktestz/services/safetyMonitor.js';
import { HardwareTestRunner } from '../testing/testRunner.js';
import { listInstruments } from '../instruments/registry.js';
import { mapMeasurementToReading } from './mappings.js';
import type {
  TestStation,
  TestOutlet,
  TestProfile,
  TestRun,
} from '../../quicktestz/types.js';
import type { HardwareTestExecution } from '../types.js';

export interface IntegratedTestOptions {
  qlid: string;
  category: string;
  stationId: string;
  outletId?: string;
  operatorId?: string;
  operatorName?: string;
  skipUnavailable?: boolean;
  onProgress?: (completed: number, total: number, message: string) => void;
}

export interface IntegratedTestResult {
  testRun: TestRun;
  hardwareExecution: HardwareTestExecution;
  stepsRecorded: number;
  readingsRecorded: number;
}

export class QuickTestzBridge {
  /**
   * Run an integrated test: energize via station, run hardware-diag plan,
   * record SCPI measurements as QuickTestz readings, then complete.
   */
  async startIntegratedTest(options: IntegratedTestOptions): Promise<IntegratedTestResult> {
    // 1. Look up station + outlet + profile
    const station = await stationManager.getStation(options.stationId);
    if (!station) throw new Error(`Station not found: ${options.stationId}`);

    const outlets = await stationManager.listOutlets(station.id);
    const outlet = options.outletId
      ? outlets.find((o) => o.id === options.outletId)
      : outlets.find((o) => o.enabled);
    if (!outlet) throw new Error('No enabled outlet found for station');

    const profile = await profileManager.getProfileByCategory(options.category);
    if (!profile) throw new Error(`No test profile for category: ${options.category}`);

    // 2. Validate safety
    const safetyErrors = safetyMonitor.validateSafety(station, outlet);
    if (safetyErrors.length > 0) {
      throw new Error(`Safety validation failed:\n  ${safetyErrors.join('\n  ')}`);
    }

    // 3. Create QuickTestz test run
    const testRun = await testRunManager.createTestRun({
      qlid: options.qlid,
      profileId: profile.id,
      stationId: station.id,
      outletId: outlet.id,
      operatorUserId: options.operatorId,
    });

    let readingsRecorded = 0;
    let stepsRecorded = 0;

    try {
      // 4. Energize outlet
      const adapter = this.getAdapterForStation(station);
      await adapter.turnOn(station, outlet);
      await testRunManager.updateTestRunStatus(testRun.id, 'ENERGIZED');

      // 5. Start background power polling
      readingsCollector.startCollecting(testRun.id, station, outlet);
      await testRunManager.updateTestRunStatus(testRun.id, 'COLLECTING');

      // 6. Start safety monitoring
      safetyMonitor.startMonitoring(testRun.id, station, outlet, profile);

      // 7. Run hardware-diag test plan with step-complete callback
      const readingPromises: Promise<void>[] = [];
      const runner = new HardwareTestRunner();
      const hardwareExecution = await runner.run({
        qlid: options.qlid,
        category: options.category,
        operatorId: options.operatorId,
        operatorName: options.operatorName,
        stationId: station.id,
        skipUnavailable: options.skipUnavailable,
        onStepComplete: (step, result) => {
          stepsRecorded++;
          const reading = mapMeasurementToReading(step, result);
          const p = readingsCollector.recordReading(testRun.id, reading).then(() => {
            readingsRecorded++;
          }).catch((err) => {
            console.error(`[Bridge] Failed to record reading for step ${step.testCode}:`, err);
          });
          readingPromises.push(p);
        },
        onProgress: options.onProgress,
      });

      // 8. Wait for all reading recordings to finish
      await Promise.all(readingPromises);

      // 9. Stop collection + monitoring, de-energize
      readingsCollector.stopCollecting(testRun.id);
      safetyMonitor.stopMonitoring(testRun.id);
      await adapter.turnOff(station, outlet);

      // 10. Complete test run
      const completedRun = await testRunManager.completeTestRun(testRun.id, profile.thresholds);

      return {
        testRun: completedRun || testRun,
        hardwareExecution,
        stepsRecorded,
        readingsRecorded,
      };
    } catch (error) {
      // Cleanup on failure: always try to de-energize and stop
      readingsCollector.stopCollecting(testRun.id);
      safetyMonitor.stopMonitoring(testRun.id);
      try {
        const adapter = this.getAdapterForStation(station);
        await adapter.turnOff(station, outlet);
      } catch { /* best-effort de-energize */ }
      await testRunManager.updateTestRunStatus(testRun.id, 'ERROR');
      throw error;
    }
  }

  /**
   * List all QuickTestz stations alongside registered hardware instruments
   */
  async listStationsWithInstruments(): Promise<{
    stations: (TestStation & { outlets: TestOutlet[] })[];
    instruments: Awaited<ReturnType<typeof listInstruments>>;
  }> {
    const [stations, instruments] = await Promise.all([
      stationManager.listStations(),
      listInstruments(),
    ]);

    const stationsWithOutlets = await Promise.all(
      stations.map(async (s) => ({
        ...s,
        outlets: await stationManager.listOutlets(s.id),
      }))
    );

    return { stations: stationsWithOutlets, instruments };
  }

  /**
   * Create a QuickTestz test run from CLI options
   */
  async createTestRunFromCli(opts: {
    qlid: string;
    stationId: string;
    outletId?: string;
    profileId?: string;
    category?: string;
    operatorUserId?: string;
  }): Promise<TestRun> {
    const station = await stationManager.getStation(opts.stationId);
    if (!station) throw new Error(`Station not found: ${opts.stationId}`);

    const outlets = await stationManager.listOutlets(station.id);
    const outlet = opts.outletId
      ? outlets.find((o) => o.id === opts.outletId)
      : outlets.find((o) => o.enabled);
    if (!outlet) throw new Error('No enabled outlet found for station');

    let profileId = opts.profileId;
    if (!profileId && opts.category) {
      const profile = await profileManager.getProfileByCategory(opts.category);
      if (!profile) throw new Error(`No test profile for category: ${opts.category}`);
      profileId = profile.id;
    }
    if (!profileId) throw new Error('Either --profile or --category is required');

    return testRunManager.createTestRun({
      qlid: opts.qlid,
      profileId,
      stationId: station.id,
      outletId: outlet.id,
      operatorUserId: opts.operatorUserId,
    });
  }

  /**
   * Energize the outlet and start collecting readings for a test run
   */
  async startTestRun(runId: string): Promise<TestRun | null> {
    const run = await testRunManager.getTestRun(runId);
    if (!run) throw new Error(`Test run not found: ${runId}`);

    const station = await stationManager.getStation(run.stationId);
    if (!station) throw new Error(`Station not found: ${run.stationId}`);

    const outlet = await stationManager.getOutlet(run.outletId);
    if (!outlet) throw new Error(`Outlet not found: ${run.outletId}`);

    const profile = await profileManager.getProfile(run.profileId);
    if (!profile) throw new Error(`Profile not found: ${run.profileId}`);

    // Validate safety
    const safetyErrors = safetyMonitor.validateSafety(station, outlet);
    if (safetyErrors.length > 0) {
      throw new Error(`Safety validation failed:\n  ${safetyErrors.join('\n  ')}`);
    }

    // Energize
    const adapter = this.getAdapterForStation(station);
    await adapter.turnOn(station, outlet);
    await testRunManager.updateTestRunStatus(runId, 'ENERGIZED');

    // Start collecting + monitoring
    readingsCollector.startCollecting(runId, station, outlet);
    safetyMonitor.startMonitoring(runId, station, outlet, profile);
    return testRunManager.updateTestRunStatus(runId, 'COLLECTING');
  }

  /**
   * De-energize the outlet and stop collecting for a test run
   */
  async stopTestRun(runId: string): Promise<TestRun | null> {
    const run = await testRunManager.getTestRun(runId);
    if (!run) throw new Error(`Test run not found: ${runId}`);

    const station = await stationManager.getStation(run.stationId);
    if (!station) throw new Error(`Station not found: ${run.stationId}`);

    const outlet = await stationManager.getOutlet(run.outletId);
    if (!outlet) throw new Error(`Outlet not found: ${run.outletId}`);

    // De-energize + stop
    readingsCollector.stopCollecting(runId);
    safetyMonitor.stopMonitoring(runId);
    const adapter = this.getAdapterForStation(station);
    await adapter.turnOff(station, outlet);

    return testRunManager.updateTestRunStatus(runId, 'CHECKLIST');
  }

  /**
   * Compute final result and complete the test run
   */
  async completeTestRun(runId: string): Promise<TestRun | null> {
    const run = await testRunManager.getTestRun(runId);
    if (!run) throw new Error(`Test run not found: ${runId}`);

    const profile = await profileManager.getProfile(run.profileId);
    if (!profile) throw new Error(`Profile not found: ${run.profileId}`);

    return testRunManager.completeTestRun(runId, profile.thresholds);
  }

  /**
   * Health-check a station's controller
   */
  async getStationHealth(stationId: string): Promise<{ ok: boolean; details: Record<string, unknown> }> {
    const station = await stationManager.getStation(stationId);
    if (!station) throw new Error(`Station not found: ${stationId}`);

    const adapter = this.getAdapterForStation(station);
    return adapter.healthCheck(station);
  }

  private getAdapterForStation(station: TestStation): PowerControllerAdapter {
    return getAdapter(station.controllerType);
  }
}
