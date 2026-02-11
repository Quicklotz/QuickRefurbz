/**
 * QuickTestz - Test Run Manager Service
 * Creates, manages, and completes test runs.
 * Handles status transitions and result computation.
 */

import { getPool, generateUUID } from '../../database.js';
import type {
  TestRun,
  TestRunCreateInput,
  TestRunStatus,
  TestRunResult,
  TestRunAnomaly,
  TestRunAttachment,
  TestReading,
  TestThresholds,
} from '../types.js';

// ==================== TEST RUNS ====================

export async function createTestRun(input: TestRunCreateInput): Promise<TestRun> {
  const db = getPool();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO test_runs (
      id, qlid, pallet_id, profile_id, station_id, outlet_id,
      operator_user_id, status, anomalies, attachments, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      input.qlid,
      input.palletId || null,
      input.profileId,
      input.stationId,
      input.outletId,
      input.operatorUserId || null,
      'CREATED',
      JSON.stringify([]),
      JSON.stringify([]),
      now,
    ]
  );

  return {
    id,
    qlid: input.qlid,
    palletId: input.palletId,
    profileId: input.profileId,
    stationId: input.stationId,
    outletId: input.outletId,
    operatorUserId: input.operatorUserId,
    status: 'CREATED',
    anomalies: [],
    attachments: [],
    createdAt: new Date(now),
  };
}

export async function getTestRun(id: string): Promise<TestRun | null> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_runs WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToTestRun(result.rows[0]);
}

export async function listTestRuns(filters?: {
  qlid?: string;
  stationId?: string;
  status?: TestRunStatus;
  limit?: number;
}): Promise<TestRun[]> {
  const db = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters?.qlid) {
    conditions.push(`qlid = $${paramIdx++}`);
    params.push(filters.qlid);
  }
  if (filters?.stationId) {
    conditions.push(`station_id = $${paramIdx++}`);
    params.push(filters.stationId);
  }
  if (filters?.status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ? `LIMIT ${filters.limit}` : 'LIMIT 100';

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM test_runs ${where} ORDER BY created_at DESC ${limit}`,
    params
  );

  return result.rows.map(rowToTestRun);
}

export async function updateTestRunStatus(
  id: string,
  status: TestRunStatus
): Promise<TestRun | null> {
  const db = getPool();
  const now = new Date().toISOString();

  const updates: string[] = [`status = $1`, `updated_at = $2`];
  const params: unknown[] = [status, now];
  let paramIdx = 3;

  if (status === 'ENERGIZED' || status === 'COLLECTING') {
    updates.push(`started_at = COALESCE(started_at, $${paramIdx++})`);
    params.push(now);
  }

  if (status === 'COMPLETED' || status === 'ABORTED' || status === 'ERROR') {
    updates.push(`ended_at = $${paramIdx++}`);
    params.push(now);
  }

  params.push(id);
  await db.query(
    `UPDATE test_runs SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
    params
  );

  return getTestRun(id);
}

export async function addAnomaly(id: string, anomaly: TestRunAnomaly): Promise<void> {
  const run = await getTestRun(id);
  if (!run) throw new Error(`Test run not found: ${id}`);

  const anomalies = [...run.anomalies, anomaly];
  const db = getPool();

  await db.query(
    'UPDATE test_runs SET anomalies = $1, updated_at = $2 WHERE id = $3',
    [JSON.stringify(anomalies), new Date().toISOString(), id]
  );
}

export async function submitChecklist(
  id: string,
  values: Record<string, unknown>
): Promise<TestRun | null> {
  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `UPDATE test_runs SET checklist_values = $1, status = 'COMPUTING', updated_at = $2 WHERE id = $3`,
    [JSON.stringify(values), now, id]
  );

  return getTestRun(id);
}

export async function addAttachment(
  id: string,
  attachment: TestRunAttachment
): Promise<void> {
  const run = await getTestRun(id);
  if (!run) throw new Error(`Test run not found: ${id}`);

  const attachments = [...run.attachments, attachment];
  const db = getPool();

  await db.query(
    'UPDATE test_runs SET attachments = $1, updated_at = $2 WHERE id = $3',
    [JSON.stringify(attachments), new Date().toISOString(), id]
  );
}

export async function completeTestRun(
  id: string,
  thresholds: TestThresholds
): Promise<TestRun | null> {
  const run = await getTestRun(id);
  if (!run) return null;

  // Compute result from readings + anomalies
  const readings = await getReadingsForRun(id);
  const result = computeResult(run, readings, thresholds);

  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `UPDATE test_runs SET
      status = 'COMPLETED', result = $1, score = $2,
      ended_at = $3, updated_at = $3
     WHERE id = $4`,
    [result.result, result.score, now, id]
  );

  return getTestRun(id);
}

export async function setNotes(id: string, notes: string): Promise<void> {
  const db = getPool();
  await db.query(
    'UPDATE test_runs SET notes = $1, updated_at = $2 WHERE id = $3',
    [notes, new Date().toISOString(), id]
  );
}

// ==================== READINGS ====================

async function getReadingsForRun(testRunId: string): Promise<TestReading[]> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_readings WHERE test_run_id = $1 ORDER BY ts',
    [testRunId]
  );
  return result.rows.map(rowToReading);
}

// ==================== RESULT COMPUTATION ====================

function computeResult(
  run: TestRun,
  readings: TestReading[],
  thresholds: TestThresholds
): { result: TestRunResult; score: number } {
  // No readings = incomplete
  if (readings.length === 0) {
    return { result: 'INCOMPLETE', score: 0 };
  }

  // Check duration
  const durationSeconds = readings.length > 1
    ? (new Date(readings[readings.length - 1].ts).getTime() - new Date(readings[0].ts).getTime()) / 1000
    : 0;

  if (durationSeconds < thresholds.minRunSeconds) {
    return { result: 'INCOMPLETE', score: 20 };
  }

  // Check for anomalies
  const hasAnomalies = run.anomalies.length > 0;

  // Check readings against thresholds
  const wattReadings = readings.filter((r) => r.watts !== undefined).map((r) => r.watts!);

  if (wattReadings.length === 0) {
    // No power data, can't auto-grade - check anomalies
    return hasAnomalies
      ? { result: 'ANOMALY', score: 50 }
      : { result: 'PASS', score: 70 };
  }

  const maxWatts = Math.max(...wattReadings);
  const avgWatts = wattReadings.reduce((a, b) => a + b, 0) / wattReadings.length;

  // Fail conditions
  if (maxWatts > thresholds.maxPeakWatts) {
    return { result: 'FAIL', score: 10 };
  }

  // Score based on how well readings fall within stable range
  let score = 100;

  // Deduct for readings outside stable range
  const outOfRange = wattReadings.filter(
    (w) => w < thresholds.minStableWatts || w > thresholds.maxStableWatts
  ).length;
  const outOfRangePct = outOfRange / wattReadings.length;
  score -= Math.round(outOfRangePct * 40);

  // Deduct for anomalies
  score -= run.anomalies.length * 10;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  if (score < 50) {
    return { result: 'FAIL', score };
  }

  if (hasAnomalies) {
    return { result: 'ANOMALY', score };
  }

  return { result: 'PASS', score };
}

// ==================== ROW CONVERTERS ====================

function rowToTestRun(row: Record<string, unknown>): TestRun {
  return {
    id: row.id as string,
    qlid: row.qlid as string,
    palletId: row.pallet_id as string | undefined,
    profileId: row.profile_id as string,
    stationId: row.station_id as string,
    outletId: row.outlet_id as string,
    operatorUserId: row.operator_user_id as string | undefined,
    status: row.status as TestRunStatus,
    startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
    endedAt: row.ended_at ? new Date(row.ended_at as string) : undefined,
    result: row.result as TestRunResult | undefined,
    score: row.score as number | undefined,
    anomalies: parseJson<TestRunAnomaly[]>(row.anomalies, []),
    notes: row.notes as string | undefined,
    attachments: parseJson<TestRunAttachment[]>(row.attachments, []),
    checklistValues: row.checklist_values
      ? parseJson<Record<string, unknown>>(row.checklist_values, {})
      : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

function rowToReading(row: Record<string, unknown>): TestReading {
  return {
    id: row.id as string,
    testRunId: row.test_run_id as string,
    ts: new Date(row.ts as string),
    watts: row.watts as number | undefined,
    volts: row.volts as number | undefined,
    amps: row.amps as number | undefined,
    tempC: row.temp_c as number | undefined,
    pressure: row.pressure as number | undefined,
    raw: parseJson<Record<string, unknown>>(row.raw, {}),
  };
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (val && typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return fallback;
}
