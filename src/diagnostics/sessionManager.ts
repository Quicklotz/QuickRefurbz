/**
 * QuickDiagnosticz - Session Manager
 * Handles diagnostic session lifecycle: create, record tests, complete
 */

import { randomUUID } from 'crypto';
import {
  getPool,
  generateUUID,
  getNextDiagnosticSessionNumber,
  isPostgres,
  nowFn,
} from '../database.js';
import { ProductCategory } from '../types.js';
import {
  DiagnosticSession,
  DiagnosticSessionInput,
  DiagnosticTest,
  DiagnosticTestResult,
  DiagnosticTestResultInput,
  DiagnosticDefect,
  DiagnosticSessionSummary,
  TestResult,
  SessionResult,
  StartSessionRequest,
  CompleteSessionRequest,
} from './types.js';
import { getTestsForCategory, getTestByCode } from './testDefinitions.js';
import { calculateCertificationLevel } from './resultCalculator.js';

// ==================== SESSION MANAGEMENT ====================

/**
 * Start a new diagnostic session for an item
 */
export async function startSession(input: StartSessionRequest): Promise<{
  session: DiagnosticSession;
  tests: DiagnosticTest[];
}> {
  const db = getPool();

  // Generate session ID and number
  const id = generateUUID();
  const sessionNumber = await getNextDiagnosticSessionNumber();

  // Get tests for this category
  const testDefinitions = getTestsForCategory(input.category);
  if (testDefinitions.length === 0) {
    throw new Error(`No diagnostic tests defined for category: ${input.category}`);
  }

  // Ensure tests exist in database
  const tests = await ensureTestsInDatabase(testDefinitions, input.category);

  // Create session
  const now = new Date().toISOString();

  if (isPostgres()) {
    await db.query(
      `INSERT INTO diagnostic_sessions (
        id, session_number, job_id, qlid, category,
        technician_id, technician_name, started_at, total_tests, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8)`,
      [
        id,
        sessionNumber,
        input.jobId || null,
        input.qlid,
        input.category,
        input.technicianId,
        input.technicianName || null,
        now,
        tests.length,
      ]
    );
  } else {
    await db.query(
      `INSERT INTO diagnostic_sessions (
        id, session_number, job_id, qlid, category,
        technician_id, technician_name, started_at, total_tests, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8)`,
      [
        id,
        sessionNumber,
        input.jobId || null,
        input.qlid,
        input.category,
        input.technicianId,
        input.technicianName || null,
        now,
        tests.length,
      ]
    );
  }

  const session: DiagnosticSession = {
    id,
    sessionNumber,
    jobId: input.jobId,
    qlid: input.qlid,
    category: input.category,
    technicianId: input.technicianId,
    technicianName: input.technicianName,
    startedAt: new Date(now),
    totalTests: tests.length,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    createdAt: new Date(now),
  };

  return { session, tests };
}

/**
 * Get session by ID or session number
 */
export async function getSession(identifier: string): Promise<DiagnosticSession | null> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM diagnostic_sessions
     WHERE id = $1 OR session_number = $1 OR qlid = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [identifier]
  );

  if (result.rows.length === 0) return null;

  return rowToSession(result.rows[0]);
}

/**
 * Get active (incomplete) session for an item
 */
export async function getActiveSession(qlid: string): Promise<DiagnosticSession | null> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM diagnostic_sessions
     WHERE qlid = $1 AND completed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [qlid]
  );

  if (result.rows.length === 0) return null;

  return rowToSession(result.rows[0]);
}

/**
 * Record a test result within a session
 */
export async function recordTestResult(
  sessionId: string,
  input: DiagnosticTestResultInput
): Promise<DiagnosticTestResult> {
  const db = getPool();

  // Get session to verify it exists and is not complete
  const sessionResult = await db.query<Record<string, unknown>>(
    'SELECT * FROM diagnostic_sessions WHERE id = $1',
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const session = rowToSession(sessionResult.rows[0]);
  if (session.completedAt) {
    throw new Error('Cannot record results for a completed session');
  }

  // Get test definition
  const testResult = await db.query<Record<string, unknown>>(
    'SELECT * FROM diagnostic_tests WHERE id = $1 OR code = $1',
    [input.testId]
  );

  if (testResult.rows.length === 0) {
    throw new Error(`Test not found: ${input.testId}`);
  }

  const test = rowToTest(testResult.rows[0]);

  // Check if result already exists for this test
  const existingResult = await db.query<Record<string, unknown>>(
    'SELECT id FROM diagnostic_test_results WHERE session_id = $1 AND test_code = $2',
    [sessionId, test.code]
  );

  const id = existingResult.rows.length > 0
    ? (existingResult.rows[0].id as string)
    : generateUUID();

  const now = new Date().toISOString();
  const photoUrlsValue = isPostgres()
    ? input.photoUrls || []
    : JSON.stringify(input.photoUrls || []);

  if (existingResult.rows.length > 0) {
    // Update existing result
    await db.query(
      `UPDATE diagnostic_test_results SET
        result = $1,
        measurement_value = $2,
        measurement_unit = $3,
        notes = $4,
        photo_urls = $5,
        tested_by = $6,
        tested_at = $7
       WHERE id = $8`,
      [
        input.result,
        input.measurementValue || null,
        input.measurementUnit || test.measurementUnit || null,
        input.notes || null,
        photoUrlsValue,
        input.testedBy,
        now,
        id,
      ]
    );
  } else {
    // Insert new result
    await db.query(
      `INSERT INTO diagnostic_test_results (
        id, session_id, test_id, test_code, result,
        measurement_value, measurement_unit, notes, photo_urls,
        tested_by, tested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        sessionId,
        test.id,
        test.code,
        input.result,
        input.measurementValue || null,
        input.measurementUnit || test.measurementUnit || null,
        input.notes || null,
        photoUrlsValue,
        input.testedBy,
        now,
      ]
    );
  }

  // Update session counts
  await updateSessionCounts(sessionId);

  return {
    id,
    sessionId,
    testId: test.id,
    testCode: test.code,
    result: input.result,
    measurementValue: input.measurementValue,
    measurementUnit: input.measurementUnit || test.measurementUnit,
    notes: input.notes,
    photoUrls: input.photoUrls,
    testedBy: input.testedBy,
    testedAt: new Date(now),
  };
}

/**
 * Complete a diagnostic session
 */
export async function completeSession(
  sessionId: string,
  input?: CompleteSessionRequest
): Promise<DiagnosticSessionSummary> {
  const db = getPool();

  // Get session
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.completedAt) {
    throw new Error('Session is already completed');
  }

  // Get all test results
  const results = await getSessionResults(sessionId);

  // Get test definitions for this category
  const tests = await getTestsFromDatabase(session.category);

  // Calculate overall result
  const criticalTests = tests.filter(t => t.isCritical);
  const criticalResults = results.filter(r =>
    criticalTests.some(t => t.code === r.testCode)
  );
  const criticalFailures = criticalResults.filter(r => r.result === 'FAIL');

  let overallResult: SessionResult;
  if (results.length < tests.length) {
    overallResult = 'INCOMPLETE';
  } else if (criticalFailures.length > 0) {
    overallResult = 'FAIL';
  } else {
    overallResult = 'PASS';
  }

  // Calculate duration
  const now = new Date();
  const durationSeconds = Math.floor(
    (now.getTime() - session.startedAt.getTime()) / 1000
  );

  // Update session
  await db.query(
    `UPDATE diagnostic_sessions SET
      completed_at = $1,
      duration_seconds = $2,
      overall_result = $3,
      notes = $4,
      updated_at = $1
     WHERE id = $5`,
    [
      now.toISOString(),
      durationSeconds,
      overallResult,
      input?.notes || null,
      sessionId,
    ]
  );

  // Record any defects
  const defects: DiagnosticDefect[] = [];
  if (input?.defects) {
    for (const defect of input.defects) {
      const defectId = generateUUID();
      const photoUrlsValue = isPostgres()
        ? defect.photoUrls || []
        : JSON.stringify(defect.photoUrls || []);
      const partsValue = isPostgres()
        ? (defect as any).partsRequired || []
        : JSON.stringify((defect as any).partsRequired || []);

      await db.query(
        `INSERT INTO diagnostic_defects (
          id, session_id, defect_code, component, severity,
          description, notes, photo_urls, repair_action, parts_required, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          defectId,
          sessionId,
          defect.defectCode,
          defect.component,
          defect.severity,
          defect.description,
          defect.notes || null,
          photoUrlsValue,
          defect.repairAction || null,
          partsValue,
          now.toISOString(),
        ]
      );

      defects.push({
        id: defectId,
        sessionId,
        defectCode: defect.defectCode,
        component: defect.component,
        severity: defect.severity,
        description: defect.description,
        notes: defect.notes,
        photoUrls: defect.photoUrls,
        repairAction: defect.repairAction,
        createdAt: now,
      });
    }
  }

  // Get updated session
  const updatedSession = await getSession(sessionId);

  // Calculate pass rate and certification recommendation
  const passedCount = results.filter(r => r.result === 'PASS').length;
  const passRate = results.length > 0 ? (passedCount / results.length) * 100 : 0;
  const canCertify = criticalFailures.length === 0 && overallResult !== 'INCOMPLETE';

  const summary: DiagnosticSessionSummary = {
    session: updatedSession!,
    results,
    defects,
    passRate,
    criticalFailures: criticalFailures.length,
    canCertify,
    recommendedCertification: canCertify
      ? calculateCertificationLevel(passRate, criticalFailures.length, defects.length)
      : 'NOT_CERTIFIED',
  };

  return summary;
}

/**
 * Get all test results for a session
 */
export async function getSessionResults(sessionId: string): Promise<DiagnosticTestResult[]> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM diagnostic_test_results WHERE session_id = $1 ORDER BY tested_at`,
    [sessionId]
  );

  return result.rows.map(rowToTestResult);
}

/**
 * Get session summary
 */
export async function getSessionSummary(sessionId: string): Promise<DiagnosticSessionSummary | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const results = await getSessionResults(sessionId);
  const defects = await getSessionDefects(sessionId);
  const tests = await getTestsFromDatabase(session.category);

  const criticalTests = tests.filter(t => t.isCritical);
  const criticalResults = results.filter(r =>
    criticalTests.some(t => t.code === r.testCode)
  );
  const criticalFailures = criticalResults.filter(r => r.result === 'FAIL');

  const passedCount = results.filter(r => r.result === 'PASS').length;
  const passRate = results.length > 0 ? (passedCount / results.length) * 100 : 0;
  const canCertify = criticalFailures.length === 0 && session.overallResult !== 'INCOMPLETE';

  return {
    session,
    results,
    defects,
    passRate,
    criticalFailures: criticalFailures.length,
    canCertify,
    recommendedCertification: canCertify
      ? calculateCertificationLevel(passRate, criticalFailures.length, defects.length)
      : 'NOT_CERTIFIED',
  };
}

/**
 * Get defects for a session
 */
export async function getSessionDefects(sessionId: string): Promise<DiagnosticDefect[]> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM diagnostic_defects WHERE session_id = $1 ORDER BY created_at`,
    [sessionId]
  );

  return result.rows.map(rowToDefect);
}

/**
 * List sessions with filters
 */
export async function listSessions(options: {
  category?: ProductCategory;
  technicianId?: string;
  qlid?: string;
  result?: SessionResult;
  limit?: number;
  offset?: number;
  includeCompleted?: boolean;
}): Promise<DiagnosticSession[]> {
  const db = getPool();

  let sql = 'SELECT * FROM diagnostic_sessions WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.category) {
    sql += ` AND category = $${paramIndex++}`;
    params.push(options.category);
  }

  if (options.technicianId) {
    sql += ` AND technician_id = $${paramIndex++}`;
    params.push(options.technicianId);
  }

  if (options.qlid) {
    sql += ` AND qlid = $${paramIndex++}`;
    params.push(options.qlid);
  }

  if (options.result) {
    sql += ` AND overall_result = $${paramIndex++}`;
    params.push(options.result);
  }

  if (!options.includeCompleted) {
    sql += ' AND completed_at IS NULL';
  }

  sql += ' ORDER BY created_at DESC';

  if (options.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const result = await db.query<Record<string, unknown>>(sql, params);
  return result.rows.map(rowToSession);
}

// ==================== HELPER FUNCTIONS ====================

async function updateSessionCounts(sessionId: string): Promise<void> {
  const db = getPool();

  const countsResult = await db.query<Record<string, unknown>>(
    `SELECT
      COUNT(*) FILTER (WHERE result = 'PASS') as passed,
      COUNT(*) FILTER (WHERE result = 'FAIL') as failed,
      COUNT(*) FILTER (WHERE result IN ('SKIP', 'N/A')) as skipped
     FROM diagnostic_test_results WHERE session_id = $1`,
    [sessionId]
  );

  // For SQLite compatibility
  let passed = 0, failed = 0, skipped = 0;

  if (isPostgres()) {
    const counts = countsResult.rows[0];
    passed = parseInt(String(counts.passed || 0));
    failed = parseInt(String(counts.failed || 0));
    skipped = parseInt(String(counts.skipped || 0));
  } else {
    // SQLite doesn't support FILTER, use separate counts
    const passedResult = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM diagnostic_test_results WHERE session_id = $1 AND result = 'PASS'`,
      [sessionId]
    );
    const failedResult = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM diagnostic_test_results WHERE session_id = $1 AND result = 'FAIL'`,
      [sessionId]
    );
    const skippedResult = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM diagnostic_test_results WHERE session_id = $1 AND result IN ('SKIP', 'N/A')`,
      [sessionId]
    );
    passed = passedResult.rows[0]?.cnt || 0;
    failed = failedResult.rows[0]?.cnt || 0;
    skipped = skippedResult.rows[0]?.cnt || 0;
  }

  await db.query(
    `UPDATE diagnostic_sessions SET
      passed_tests = $1,
      failed_tests = $2,
      skipped_tests = $3,
      updated_at = $4
     WHERE id = $5`,
    [passed, failed, skipped, new Date().toISOString(), sessionId]
  );
}

async function ensureTestsInDatabase(
  testDefinitions: any[],
  category: ProductCategory
): Promise<DiagnosticTest[]> {
  const db = getPool();
  const tests: DiagnosticTest[] = [];

  for (const def of testDefinitions) {
    // Check if test exists
    const existing = await db.query<Record<string, unknown>>(
      'SELECT * FROM diagnostic_tests WHERE code = $1',
      [def.code]
    );

    if (existing.rows.length > 0) {
      tests.push(rowToTest(existing.rows[0]));
    } else {
      // Insert test
      const id = generateUUID();
      const now = new Date().toISOString();

      await db.query(
        `INSERT INTO diagnostic_tests (
          id, code, name, category, test_type, description,
          instructions, pass_criteria, measurement_unit,
          measurement_min, measurement_max, is_critical,
          display_order, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          id,
          def.code,
          def.name,
          def.category,
          def.testType,
          def.description,
          def.instructions,
          def.passCriteria,
          def.measurementUnit || null,
          def.measurementMin || null,
          def.measurementMax || null,
          isPostgres() ? def.isCritical : (def.isCritical ? 1 : 0),
          def.displayOrder,
          now,
        ]
      );

      tests.push({
        id,
        code: def.code,
        name: def.name,
        category: def.category,
        testType: def.testType,
        description: def.description,
        instructions: def.instructions,
        passCriteria: def.passCriteria,
        measurementUnit: def.measurementUnit,
        measurementMin: def.measurementMin,
        measurementMax: def.measurementMax,
        isCritical: def.isCritical,
        displayOrder: def.displayOrder,
        createdAt: new Date(now),
      });
    }
  }

  return tests;
}

async function getTestsFromDatabase(category: ProductCategory): Promise<DiagnosticTest[]> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM diagnostic_tests WHERE category = $1 ORDER BY display_order',
    [category]
  );

  return result.rows.map(rowToTest);
}

// ==================== ROW CONVERTERS ====================

function rowToSession(row: Record<string, unknown>): DiagnosticSession {
  return {
    id: row.id as string,
    sessionNumber: row.session_number as string,
    jobId: row.job_id as string | undefined,
    qlid: row.qlid as string,
    category: row.category as ProductCategory,
    technicianId: row.technician_id as string,
    technicianName: row.technician_name as string | undefined,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    durationSeconds: row.duration_seconds as number | undefined,
    totalTests: row.total_tests as number,
    passedTests: row.passed_tests as number,
    failedTests: row.failed_tests as number,
    skippedTests: row.skipped_tests as number,
    overallResult: row.overall_result as SessionResult | undefined,
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

function rowToTest(row: Record<string, unknown>): DiagnosticTest {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    category: row.category as ProductCategory,
    testType: row.test_type as any,
    description: row.description as string,
    instructions: row.instructions as string,
    passCriteria: row.pass_criteria as string,
    measurementUnit: row.measurement_unit as string | undefined,
    measurementMin: row.measurement_min as number | undefined,
    measurementMax: row.measurement_max as number | undefined,
    isCritical: row.is_critical === true || row.is_critical === 1,
    displayOrder: row.display_order as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

function rowToTestResult(row: Record<string, unknown>): DiagnosticTestResult {
  let photoUrls: string[] | undefined;
  if (row.photo_urls) {
    photoUrls = typeof row.photo_urls === 'string'
      ? JSON.parse(row.photo_urls)
      : row.photo_urls as string[];
  }

  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    testId: row.test_id as string,
    testCode: row.test_code as string,
    result: row.result as TestResult,
    measurementValue: row.measurement_value as number | undefined,
    measurementUnit: row.measurement_unit as string | undefined,
    notes: row.notes as string | undefined,
    photoUrls,
    testedBy: row.tested_by as string,
    testedAt: new Date(row.tested_at as string),
  };
}

function rowToDefect(row: Record<string, unknown>): DiagnosticDefect {
  let photoUrls: string[] | undefined;
  if (row.photo_urls) {
    photoUrls = typeof row.photo_urls === 'string'
      ? JSON.parse(row.photo_urls)
      : row.photo_urls as string[];
  }

  let partsRequired: string[] | undefined;
  if (row.parts_required) {
    partsRequired = typeof row.parts_required === 'string'
      ? JSON.parse(row.parts_required)
      : row.parts_required as string[];
  }

  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    testResultId: row.test_result_id as string | undefined,
    defectCode: row.defect_code as string,
    component: row.component as string,
    severity: row.severity as any,
    description: row.description as string,
    notes: row.notes as string | undefined,
    photoUrls,
    repairAction: row.repair_action as any,
    repairEstimateMinutes: row.repair_estimate_minutes as number | undefined,
    partsRequired,
    createdAt: new Date(row.created_at as string),
  };
}

// ==================== TECHNICIAN PERFORMANCE ====================

export interface TechnicianDiagnosticStats {
  technicianId: string;
  technicianName?: string;
  totalSessions: number;
  completedSessions: number;
  passedSessions: number;
  failedSessions: number;
  passRate: number;
  avgTestsPerSession: number;
  avgDurationMinutes: number;
  categoryCounts: Record<string, number>;
  recentSessions: DiagnosticSession[];
}

/**
 * Get diagnostic performance stats for a technician
 */
export async function getTechnicianDiagnosticStats(
  technicianId: string
): Promise<TechnicianDiagnosticStats | null> {
  const db = getPool();

  // Get all sessions for this technician
  const sessionsResult = await db.query<Record<string, unknown>>(
    `SELECT * FROM diagnostic_sessions
     WHERE technician_id = $1
     ORDER BY created_at DESC`,
    [technicianId]
  );

  if (sessionsResult.rows.length === 0) {
    return null;
  }

  const sessions = sessionsResult.rows.map(rowToSession);
  const completedSessions = sessions.filter(s => s.completedAt);
  const passedSessions = completedSessions.filter(s => s.overallResult === 'PASS');
  const failedSessions = completedSessions.filter(s => s.overallResult === 'FAIL');

  // Calculate average duration for completed sessions
  const durations = completedSessions
    .filter(s => s.durationSeconds)
    .map(s => s.durationSeconds!);
  const avgDurationMinutes = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length / 60
    : 0;

  // Calculate average tests per session
  const avgTestsPerSession = completedSessions.length > 0
    ? completedSessions.reduce((sum, s) => sum + s.totalTests, 0) / completedSessions.length
    : 0;

  // Count by category
  const categoryCounts: Record<string, number> = {};
  for (const session of sessions) {
    categoryCounts[session.category] = (categoryCounts[session.category] || 0) + 1;
  }

  return {
    technicianId,
    technicianName: sessions[0]?.technicianName,
    totalSessions: sessions.length,
    completedSessions: completedSessions.length,
    passedSessions: passedSessions.length,
    failedSessions: failedSessions.length,
    passRate: completedSessions.length > 0
      ? (passedSessions.length / completedSessions.length) * 100
      : 0,
    avgTestsPerSession: Math.round(avgTestsPerSession * 10) / 10,
    avgDurationMinutes: Math.round(avgDurationMinutes * 10) / 10,
    categoryCounts,
    recentSessions: sessions.slice(0, 10),
  };
}

/**
 * Get all technicians with diagnostic stats
 */
export async function getAllTechnicianDiagnosticStats(): Promise<TechnicianDiagnosticStats[]> {
  const db = getPool();

  // Get unique technicians
  const techResult = await db.query<Record<string, unknown>>(
    `SELECT DISTINCT technician_id, technician_name
     FROM diagnostic_sessions
     ORDER BY technician_id`
  );

  const stats: TechnicianDiagnosticStats[] = [];
  for (const row of techResult.rows) {
    const techStats = await getTechnicianDiagnosticStats(row.technician_id as string);
    if (techStats) {
      stats.push(techStats);
    }
  }

  // Sort by total sessions descending
  return stats.sort((a, b) => b.totalSessions - a.totalSessions);
}
