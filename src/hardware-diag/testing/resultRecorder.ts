/**
 * Hardware Diagnostics - Result Recorder
 * Bridge between hardware test results and existing diagnostic_test_results table
 */

import { getPool, generateUUID, isPostgres } from '../../database.js';
import type {
  HardwareTestExecution,
  HardwareTestStepResult,
  HardwareTestStepResultInput,
  HardwareTestStatus,
} from '../types.js';
import type { ProductCategory } from '../../types.js';

export class ResultRecorder {
  /**
   * Create a new hardware test execution record
   */
  async createExecution(input: {
    qlid: string;
    planId: string;
    category: ProductCategory;
    diagnosticSessionId?: string;
    operatorId?: string;
    operatorName?: string;
    stationId?: string;
    totalSteps: number;
  }): Promise<HardwareTestExecution> {
    const db = getPool();
    const id = generateUUID();
    const now = new Date().toISOString();

    await db.query(
      `INSERT INTO hardware_test_executions (
        id, qlid, plan_id, category, diagnostic_session_id,
        status, operator_id, operator_name, station_id,
        started_at, total_steps, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $10)`,
      [
        id,
        input.qlid,
        input.planId,
        input.category,
        input.diagnosticSessionId || null,
        'IN_PROGRESS',
        input.operatorId || null,
        input.operatorName || null,
        input.stationId || null,
        now,
        input.totalSteps,
      ]
    );

    return {
      id,
      qlid: input.qlid,
      planId: input.planId,
      category: input.category as any,
      diagnosticSessionId: input.diagnosticSessionId,
      status: 'IN_PROGRESS',
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      stationId: input.stationId,
      startedAt: new Date(now),
      totalSteps: input.totalSteps,
      completedSteps: 0,
      passedSteps: 0,
      failedSteps: 0,
      createdAt: new Date(now),
    };
  }

  /**
   * Record a single step result
   */
  async recordStepResult(
    input: HardwareTestStepResultInput
  ): Promise<HardwareTestStepResult> {
    const db = getPool();
    const id = generateUUID();
    const now = new Date().toISOString();

    await db.query(
      `INSERT INTO hardware_test_step_results (
        id, execution_id, step_number, test_code, status,
        measured_value, measured_unit, expected_min, expected_max,
        instrument_id, scpi_command, raw_response,
        error_message, duration_ms, measured_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        input.executionId,
        input.stepNumber,
        input.testCode,
        input.status,
        input.measuredValue ?? null,
        input.measuredUnit || null,
        input.expectedMin ?? null,
        input.expectedMax ?? null,
        input.instrumentId || null,
        input.scpiCommand || null,
        input.rawResponse || null,
        input.errorMessage || null,
        input.durationMs || null,
        now,
      ]
    );

    // Update execution counts
    await this.updateExecutionCounts(input.executionId);

    return {
      id,
      executionId: input.executionId,
      stepNumber: input.stepNumber,
      testCode: input.testCode,
      status: input.status,
      measuredValue: input.measuredValue,
      measuredUnit: input.measuredUnit,
      expectedMin: input.expectedMin,
      expectedMax: input.expectedMax,
      instrumentId: input.instrumentId,
      scpiCommand: input.scpiCommand,
      rawResponse: input.rawResponse,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs,
      measuredAt: new Date(now),
    };
  }

  /**
   * Complete an execution (mark as COMPLETED, FAILED, or ABORTED)
   */
  async completeExecution(
    executionId: string,
    status: HardwareTestStatus,
    notes?: string
  ): Promise<void> {
    const db = getPool();
    const now = new Date().toISOString();

    // Calculate overall result
    const stepsResult = await db.query<Record<string, unknown>>(
      `SELECT status FROM hardware_test_step_results WHERE execution_id = $1`,
      [executionId]
    );

    const steps = stepsResult.rows;
    const failedCount = steps.filter(
      (s) => s.status === 'FAIL' || s.status === 'ERROR'
    ).length;

    let overallResult: string;
    if (status === 'ABORTED') {
      overallResult = 'INCOMPLETE';
    } else if (failedCount > 0) {
      overallResult = 'FAIL';
    } else {
      overallResult = 'PASS';
    }

    await db.query(
      `UPDATE hardware_test_executions SET
        status = $1, completed_at = $2, overall_result = $3,
        notes = $4, updated_at = $2
       WHERE id = $5`,
      [status, now, overallResult, notes || null, executionId]
    );
  }

  /**
   * Get execution by ID
   */
  async getExecution(
    executionId: string
  ): Promise<HardwareTestExecution | null> {
    const db = getPool();

    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM hardware_test_executions WHERE id = $1',
      [executionId]
    );

    if (result.rows.length === 0) return null;
    return rowToExecution(result.rows[0]);
  }

  /**
   * Get executions for a QLID
   */
  async getExecutionsForQlid(
    qlid: string
  ): Promise<HardwareTestExecution[]> {
    const db = getPool();

    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM hardware_test_executions WHERE qlid = $1 ORDER BY created_at DESC',
      [qlid]
    );

    return result.rows.map(rowToExecution);
  }

  /**
   * Get step results for an execution
   */
  async getStepResults(
    executionId: string
  ): Promise<HardwareTestStepResult[]> {
    const db = getPool();

    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM hardware_test_step_results WHERE execution_id = $1 ORDER BY step_number',
      [executionId]
    );

    return result.rows.map(rowToStepResult);
  }

  // ==================== PRIVATE ====================

  private async updateExecutionCounts(executionId: string): Promise<void> {
    const db = getPool();

    if (isPostgres()) {
      await db.query(
        `UPDATE hardware_test_executions SET
          completed_steps = (SELECT COUNT(*) FROM hardware_test_step_results WHERE execution_id = $1),
          passed_steps = (SELECT COUNT(*) FROM hardware_test_step_results WHERE execution_id = $1 AND status = 'PASS'),
          failed_steps = (SELECT COUNT(*) FROM hardware_test_step_results WHERE execution_id = $1 AND status IN ('FAIL', 'ERROR', 'TIMEOUT')),
          updated_at = now()
         WHERE id = $1`,
        [executionId]
      );
    } else {
      // SQLite: separate queries
      const completed = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM hardware_test_step_results WHERE execution_id = $1`,
        [executionId]
      );
      const passed = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM hardware_test_step_results WHERE execution_id = $1 AND status = 'PASS'`,
        [executionId]
      );
      const failed = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM hardware_test_step_results WHERE execution_id = $1 AND status IN ('FAIL', 'ERROR', 'TIMEOUT')`,
        [executionId]
      );

      await db.query(
        `UPDATE hardware_test_executions SET
          completed_steps = $1, passed_steps = $2, failed_steps = $3,
          updated_at = $4
         WHERE id = $5`,
        [
          completed.rows[0]?.cnt || 0,
          passed.rows[0]?.cnt || 0,
          failed.rows[0]?.cnt || 0,
          new Date().toISOString(),
          executionId,
        ]
      );
    }
  }
}

// ==================== ROW CONVERTERS ====================

function rowToExecution(
  row: Record<string, unknown>
): HardwareTestExecution {
  return {
    id: row.id as string,
    qlid: row.qlid as string,
    planId: row.plan_id as string,
    category: row.category as any,
    diagnosticSessionId: row.diagnostic_session_id as string | undefined,
    status: row.status as any,
    operatorId: row.operator_id as string | undefined,
    operatorName: row.operator_name as string | undefined,
    stationId: row.station_id as string | undefined,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at
      ? new Date(row.completed_at as string)
      : undefined,
    totalSteps: row.total_steps as number,
    completedSteps: row.completed_steps as number,
    passedSteps: row.passed_steps as number,
    failedSteps: row.failed_steps as number,
    overallResult: row.overall_result as any,
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at
      ? new Date(row.updated_at as string)
      : undefined,
  };
}

function rowToStepResult(
  row: Record<string, unknown>
): HardwareTestStepResult {
  return {
    id: row.id as string,
    executionId: row.execution_id as string,
    stepNumber: row.step_number as number,
    testCode: row.test_code as string,
    status: row.status as any,
    measuredValue: row.measured_value as number | undefined,
    measuredUnit: row.measured_unit as string | undefined,
    expectedMin: row.expected_min as number | undefined,
    expectedMax: row.expected_max as number | undefined,
    instrumentId: row.instrument_id as string | undefined,
    scpiCommand: row.scpi_command as string | undefined,
    rawResponse: row.raw_response as string | undefined,
    diagnosticTestResultId: row.diagnostic_test_result_id as
      | string
      | undefined,
    errorMessage: row.error_message as string | undefined,
    durationMs: row.duration_ms as number | undefined,
    measuredAt: new Date(row.measured_at as string),
  };
}
