/**
 * Hardware Diagnostics - Test Runner
 * Executes automated hardware test plans
 */

import type {
  HardwareTestPlan,
  HardwareTestStep,
  HardwareTestExecution,
  HardwareTestStepResult,
  StepResultStatus,
  InstrumentType,
} from '../types.js';
import { ScpiController } from '../instruments/scpi.js';
import { getInstrument, listInstruments } from '../instruments/registry.js';
import { MeasurementValidator } from './measurementValidator.js';
import { ResultRecorder } from './resultRecorder.js';
import { TestPlanLoader } from './testPlanLoader.js';

export interface TestRunnerOptions {
  qlid: string;
  category: string;
  operatorId?: string;
  operatorName?: string;
  stationId?: string;
  diagnosticSessionId?: string;
  /** If true, skip steps that require unavailable instruments */
  skipUnavailable?: boolean;
  /** Callback for each step completion */
  onStepComplete?: (step: HardwareTestStep, result: HardwareTestStepResult) => void;
  /** Callback for progress updates */
  onProgress?: (completed: number, total: number, message: string) => void;
}

/**
 * Orchestrates automated hardware test plan execution
 */
export class HardwareTestRunner {
  private validator = new MeasurementValidator();
  private recorder = new ResultRecorder();
  private planLoader = new TestPlanLoader();
  private scpiControllers = new Map<string, ScpiController>();

  /**
   * Run a full automated test plan
   */
  async run(options: TestRunnerOptions): Promise<HardwareTestExecution> {
    // Load plan
    const plan = await this.planLoader.loadPlanByCategory(options.category);

    // Check instrument availability
    const availableInstruments = await this.checkInstruments(
      plan.requiredInstruments
    );

    // Create execution record
    const execution = await this.recorder.createExecution({
      qlid: options.qlid,
      planId: plan.id,
      category: plan.category,
      diagnosticSessionId: options.diagnosticSessionId,
      operatorId: options.operatorId,
      operatorName: options.operatorName,
      stationId: options.stationId,
      totalSteps: plan.steps.length,
    });

    options.onProgress?.(0, plan.steps.length, `Starting ${plan.name}...`);

    // Execute each step
    let aborted = false;
    for (const step of plan.steps) {
      if (aborted) break;

      try {
        const result = await this.executeStep(
          execution.id,
          step,
          availableInstruments,
          options.skipUnavailable
        );

        options.onStepComplete?.(step, result);
        options.onProgress?.(
          step.stepNumber,
          plan.steps.length,
          `${step.testCode}: ${result.status}`
        );

        // Abort on critical failure
        if (step.isCritical && result.status === 'FAIL') {
          aborted = true;
          options.onProgress?.(
            step.stepNumber,
            plan.steps.length,
            `CRITICAL FAILURE: ${step.testCode} - aborting test plan`
          );
        }
      } catch (error) {
        const err = error as Error;
        await this.recorder.recordStepResult({
          executionId: execution.id,
          stepNumber: step.stepNumber,
          testCode: step.testCode,
          status: 'ERROR',
          errorMessage: err.message,
        });

        options.onProgress?.(
          step.stepNumber,
          plan.steps.length,
          `ERROR on ${step.testCode}: ${err.message}`
        );

        if (step.isCritical) {
          aborted = true;
        }
      }
    }

    // Complete execution
    const finalStatus = aborted ? 'FAILED' : 'COMPLETED';
    await this.recorder.completeExecution(execution.id, finalStatus);

    // Disconnect instruments
    await this.disconnectAll();

    // Return updated execution
    const updated = await this.recorder.getExecution(execution.id);
    return updated || execution;
  }

  /**
   * Execute a single test step
   */
  private async executeStep(
    executionId: string,
    step: HardwareTestStep,
    availableInstruments: Map<InstrumentType, string>,
    skipUnavailable?: boolean
  ): Promise<HardwareTestStepResult> {
    const instrumentId = availableInstruments.get(step.instrumentType);

    if (!instrumentId) {
      if (skipUnavailable) {
        return this.recorder.recordStepResult({
          executionId,
          stepNumber: step.stepNumber,
          testCode: step.testCode,
          status: 'SKIP',
          errorMessage: `No ${step.instrumentType} available`,
        });
      }
      return this.recorder.recordStepResult({
        executionId,
        stepNumber: step.stepNumber,
        testCode: step.testCode,
        status: 'ERROR',
        errorMessage: `Required instrument not available: ${step.instrumentType}`,
      });
    }

    // For SCPI-based measurements
    if (step.scpiCommand) {
      return this.executeScpiStep(executionId, step, instrumentId);
    }

    // For sigrok-based captures
    if (step.sigrokConfig) {
      return this.executeSigrokStep(executionId, step, instrumentId);
    }

    // Manual measurement (no automation possible)
    return this.recorder.recordStepResult({
      executionId,
      stepNumber: step.stepNumber,
      testCode: step.testCode,
      status: 'SKIP',
      errorMessage: 'Manual measurement required - use interactive mode',
    });
  }

  /**
   * Execute a SCPI measurement step
   */
  private async executeScpiStep(
    executionId: string,
    step: HardwareTestStep,
    instrumentId: string
  ): Promise<HardwareTestStepResult> {
    const startTime = Date.now();

    // Get or create SCPI controller
    const controller = await this.getScpiController(instrumentId);

    // Send SCPI command with retry
    let lastError: Error | null = null;
    const retries = step.retryCount || 1;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const measurement = await controller.measure(step.scpiCommand!);
        const durationMs = Date.now() - startTime;

        // Validate measurement
        const validation = this.validator.validate(step, measurement.response.value);

        return this.recorder.recordStepResult({
          executionId,
          stepNumber: step.stepNumber,
          testCode: step.testCode,
          status: validation.status,
          measuredValue: measurement.response.value,
          measuredUnit: step.expectedUnit,
          expectedMin: step.expectedMin,
          expectedMax: step.expectedMax,
          instrumentId,
          scpiCommand: step.scpiCommand,
          rawResponse: measurement.response.raw,
          durationMs,
        });
      } catch (error) {
        lastError = error as Error;
        // Wait briefly before retry
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return this.recorder.recordStepResult({
      executionId,
      stepNumber: step.stepNumber,
      testCode: step.testCode,
      status: 'ERROR',
      instrumentId,
      scpiCommand: step.scpiCommand,
      errorMessage: lastError?.message || 'Unknown SCPI error',
      durationMs,
    });
  }

  /**
   * Execute a sigrok-based step (placeholder for signal analysis)
   */
  private async executeSigrokStep(
    executionId: string,
    step: HardwareTestStep,
    instrumentId: string
  ): Promise<HardwareTestStepResult> {
    // sigrok captures need more complex handling - record as skip for now
    return this.recorder.recordStepResult({
      executionId,
      stepNumber: step.stepNumber,
      testCode: step.testCode,
      status: 'SKIP',
      instrumentId,
      errorMessage: 'Sigrok automation pending - use manual capture commands',
    });
  }

  /**
   * Check which required instruments are available
   */
  private async checkInstruments(
    required: InstrumentType[]
  ): Promise<Map<InstrumentType, string>> {
    const available = new Map<InstrumentType, string>();
    const instruments = await listInstruments({ status: 'ACTIVE' });

    for (const type of required) {
      const match = instruments.find((i) => i.type === type);
      if (match) {
        available.set(type, match.id);
      }
    }

    return available;
  }

  /**
   * Get or create SCPI controller for an instrument
   */
  private async getScpiController(
    instrumentId: string
  ): Promise<ScpiController> {
    if (this.scpiControllers.has(instrumentId)) {
      return this.scpiControllers.get(instrumentId)!;
    }

    const instrument = await getInstrument(instrumentId);
    if (!instrument) {
      throw new Error(`Instrument not found: ${instrumentId}`);
    }

    const controller = new ScpiController({
      path: instrument.connectionPath,
      baudRate: instrument.baudRate,
      instrumentId: instrument.id,
    });

    await controller.connect();
    this.scpiControllers.set(instrumentId, controller);
    return controller;
  }

  /**
   * Disconnect all SCPI controllers
   */
  private async disconnectAll(): Promise<void> {
    for (const [, controller] of this.scpiControllers) {
      try {
        await controller.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    this.scpiControllers.clear();
  }
}
