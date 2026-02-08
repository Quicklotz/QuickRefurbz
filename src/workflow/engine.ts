/**
 * QuickRefurbz - Workflow Engine
 * State machine and step management for refurbishment workflow
 */

import { randomUUID } from 'crypto';
import { getPool, nowFn, isPostgres } from '../database.js';
import type {
  RefurbState,
  TransitionAction,
  RefurbJob,
  StepCompletion,
  WorkflowPrompt,
  WorkflowStep,
  StepCompletionData,
  TransitionData,
  JobPriority,
  ProductCategory,
  FinalGrade,
} from '../types.js';
import {
  REFURB_STATE_ORDER,
  REFURB_STATE_DISPLAY,
  REFURB_STATE_TYPE,
} from '../types.js';

// ==================== STATE MACHINE CONFIGURATION ====================

interface TransitionConfig {
  action: TransitionAction;
  toState: RefurbState;
}

const STATE_TRANSITIONS: Record<RefurbState, TransitionConfig[]> = {
  REFURBZ_QUEUED: [
    { action: 'ADVANCE', toState: 'REFURBZ_ASSIGNED' },
  ],
  REFURBZ_ASSIGNED: [
    { action: 'ADVANCE', toState: 'REFURBZ_IN_PROGRESS' },
    { action: 'BLOCK', toState: 'REFURBZ_BLOCKED' },
  ],
  REFURBZ_IN_PROGRESS: [
    { action: 'ADVANCE', toState: 'SECURITY_PREP_COMPLETE' },
    { action: 'BLOCK', toState: 'REFURBZ_BLOCKED' },
    { action: 'ESCALATE', toState: 'REFURBZ_ESCALATED' },
  ],
  SECURITY_PREP_COMPLETE: [
    { action: 'ADVANCE', toState: 'DIAGNOSED' },
    { action: 'BLOCK', toState: 'REFURBZ_BLOCKED' },
    { action: 'ESCALATE', toState: 'REFURBZ_ESCALATED' },
  ],
  DIAGNOSED: [
    { action: 'ADVANCE', toState: 'REPAIR_IN_PROGRESS' },
    { action: 'BLOCK', toState: 'REFURBZ_BLOCKED' },
    { action: 'ESCALATE', toState: 'REFURBZ_ESCALATED' },
  ],
  REPAIR_IN_PROGRESS: [
    { action: 'ADVANCE', toState: 'REPAIR_COMPLETE' },
    { action: 'BLOCK', toState: 'REFURBZ_BLOCKED' },
    { action: 'ESCALATE', toState: 'REFURBZ_ESCALATED' },
  ],
  REPAIR_COMPLETE: [
    { action: 'ADVANCE', toState: 'FINAL_TEST_IN_PROGRESS' },
    { action: 'BLOCK', toState: 'REFURBZ_BLOCKED' },
  ],
  FINAL_TEST_IN_PROGRESS: [
    { action: 'ADVANCE', toState: 'FINAL_TEST_PASSED' },
    { action: 'FAIL', toState: 'FINAL_TEST_FAILED' },
    { action: 'BLOCK', toState: 'REFURBZ_BLOCKED' },
  ],
  FINAL_TEST_PASSED: [
    { action: 'ADVANCE', toState: 'CERTIFIED' },
  ],
  CERTIFIED: [
    { action: 'ADVANCE', toState: 'REFURBZ_COMPLETE' },
  ],
  REFURBZ_COMPLETE: [],
  REFURBZ_BLOCKED: [
    { action: 'RESOLVE', toState: 'REFURBZ_IN_PROGRESS' },
    { action: 'ESCALATE', toState: 'REFURBZ_ESCALATED' },
    { action: 'FAIL', toState: 'REFURBZ_FAILED_DISPOSITION' },
  ],
  REFURBZ_ESCALATED: [
    { action: 'RESOLVE', toState: 'REFURBZ_IN_PROGRESS' },
    { action: 'FAIL', toState: 'REFURBZ_FAILED_DISPOSITION' },
  ],
  FINAL_TEST_FAILED: [
    { action: 'RETRY', toState: 'REPAIR_IN_PROGRESS' },
    { action: 'FAIL', toState: 'REFURBZ_FAILED_DISPOSITION' },
  ],
  REFURBZ_FAILED_DISPOSITION: [],
};

// ==================== WORKFLOW ENGINE ====================

export class WorkflowEngine {
  private db = getPool();

  // ==================== JOB MANAGEMENT ====================

  /**
   * Create a new refurb job from a scanned QLID
   */
  async createJob(input: {
    qlid: string;
    palletId: string;
    category: ProductCategory;
    manufacturer?: string;
    model?: string;
    priority?: JobPriority;
  }): Promise<RefurbJob> {
    const id = randomUUID();
    const now = isPostgres() ? 'now()' : "datetime('now')";

    await this.db.query(`
      INSERT INTO refurb_jobs (
        id, qlid, pallet_id, category, manufacturer, model,
        current_state, current_step_index, priority,
        attempt_count, max_attempts, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'REFURBZ_QUEUED', 0, $7,
        0, 2, ${now}, ${now}
      )
    `, [
      id,
      input.qlid,
      input.palletId,
      input.category,
      input.manufacturer || null,
      input.model || null,
      input.priority || 'NORMAL',
    ]);

    const job = await this.getJob(id);
    if (!job) throw new Error('Failed to create job');

    // Log the transition
    await this.logTransition(job.id, null, 'REFURBZ_QUEUED', 'ADVANCE');

    return job;
  }

  /**
   * Get a job by ID
   */
  async getJob(id: string): Promise<RefurbJob | null> {
    const result = await this.db.query<Record<string, unknown>>(`
      SELECT * FROM refurb_jobs WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) return null;
    return this.mapJobRow(result.rows[0]);
  }

  /**
   * Get a job by QLID
   */
  async getJobByQlid(qlid: string): Promise<RefurbJob | null> {
    const result = await this.db.query<Record<string, unknown>>(`
      SELECT * FROM refurb_jobs WHERE qlid = $1
    `, [qlid]);

    if (result.rows.length === 0) return null;
    return this.mapJobRow(result.rows[0]);
  }

  /**
   * List jobs with filters
   */
  async listJobs(filters: {
    state?: RefurbState;
    technicianId?: string;
    category?: ProductCategory;
    priority?: JobPriority;
  } = {}): Promise<RefurbJob[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.state) {
      conditions.push(`current_state = $${paramIndex++}`);
      params.push(filters.state);
    }
    if (filters.technicianId) {
      conditions.push(`assigned_technician_id = $${paramIndex++}`);
      params.push(filters.technicianId);
    }
    if (filters.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(filters.category);
    }
    if (filters.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(filters.priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query<Record<string, unknown>>(`
      SELECT * FROM refurb_jobs ${whereClause} ORDER BY created_at DESC
    `, params);

    return result.rows.map(row => this.mapJobRow(row));
  }

  /**
   * Assign a technician to a job
   */
  async assignJob(
    jobId: string,
    technicianId: string,
    technicianName?: string
  ): Promise<RefurbJob> {
    const now = nowFn();
    await this.db.query(`
      UPDATE refurb_jobs
      SET assigned_technician_id = $1,
          assigned_technician_name = $2,
          assigned_at = ${now},
          updated_at = ${now}
      WHERE id = $3
    `, [technicianId, technicianName || null, jobId]);

    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    // If in QUEUED state, advance to ASSIGNED
    if (job.currentState === 'REFURBZ_QUEUED') {
      return this.transitionJob(jobId, 'ADVANCE', technicianId);
    }

    return job;
  }

  // ==================== STATE TRANSITIONS ====================

  /**
   * Validate if a transition is allowed
   */
  validateTransition(
    currentState: RefurbState,
    action: TransitionAction
  ): { valid: boolean; targetState?: RefurbState; error?: string } {
    const transitions = STATE_TRANSITIONS[currentState];
    const transition = transitions.find(t => t.action === action);

    if (!transition) {
      return {
        valid: false,
        error: `Action '${action}' not allowed from state '${currentState}'`,
      };
    }

    return { valid: true, targetState: transition.toState };
  }

  /**
   * Transition a job to a new state
   */
  async transitionJob(
    jobId: string,
    action: TransitionAction,
    technicianId?: string,
    data?: TransitionData
  ): Promise<RefurbJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    const validation = this.validateTransition(job.currentState, action);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const targetState = validation.targetState!;

    // Check max attempts for RETRY action
    if (action === 'RETRY' && job.attemptCount >= job.maxAttempts) {
      throw new Error(`Max attempts (${job.maxAttempts}) exceeded. Use FAIL action instead.`);
    }

    // Update the job
    const now = nowFn();
    const updates: string[] = [
      `current_state = $1`,
      `current_step_index = 0`,
      `updated_at = ${now}`,
    ];
    const params: unknown[] = [targetState];
    let paramIndex = 2;

    // Increment attempt count on RETRY
    if (action === 'RETRY') {
      updates.push(`attempt_count = attempt_count + 1`);
    }

    // Set started_at on first progress
    if (targetState === 'REFURBZ_IN_PROGRESS' && !job.startedAt) {
      updates.push(`started_at = ${now}`);
    }

    // Set completion data
    if (targetState === 'REFURBZ_COMPLETE' || targetState === 'REFURBZ_FAILED_DISPOSITION') {
      updates.push(`completed_at = ${now}`);
    }

    // Set certification data
    if (data?.finalGrade) {
      updates.push(`final_grade = $${paramIndex++}`);
      params.push(data.finalGrade);
    }
    if (data?.warrantyEligible !== undefined) {
      updates.push(`warranty_eligible = $${paramIndex++}`);
      params.push(data.warrantyEligible);
    }
    if (data?.disposition) {
      updates.push(`disposition = $${paramIndex++}`);
      params.push(data.disposition);
    }

    params.push(jobId);

    await this.db.query(`
      UPDATE refurb_jobs SET ${updates.join(', ')} WHERE id = $${paramIndex}
    `, params);

    // Log the transition
    await this.logTransition(
      jobId,
      job.currentState,
      targetState,
      action,
      technicianId,
      data?.reason,
      data?.notes
    );

    const updatedJob = await this.getJob(jobId);
    if (!updatedJob) throw new Error('Failed to update job');

    return updatedJob;
  }

  /**
   * Log a state transition
   */
  private async logTransition(
    jobId: string,
    fromState: RefurbState | null,
    toState: RefurbState,
    action: TransitionAction,
    technicianId?: string,
    reason?: string,
    notes?: string
  ): Promise<void> {
    const id = randomUUID();
    const now = nowFn();

    await this.db.query(`
      INSERT INTO workflow_transitions (
        id, job_id, from_state, to_state, action,
        technician_id, reason, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${now})
    `, [id, jobId, fromState, toState, action, technicianId || null, reason || null, notes || null]);
  }

  // ==================== STEP MANAGEMENT ====================

  /**
   * Get completed steps for a job in a specific state
   */
  async getCompletedSteps(jobId: string, stateCode?: RefurbState): Promise<StepCompletion[]> {
    let query = `SELECT * FROM refurb_step_completions WHERE job_id = $1`;
    const params: unknown[] = [jobId];

    if (stateCode) {
      query += ` AND state_code = $2`;
      params.push(stateCode);
    }

    query += ` ORDER BY completed_at ASC`;

    const result = await this.db.query<Record<string, unknown>>(query, params);
    return result.rows.map(row => this.mapStepCompletionRow(row));
  }

  /**
   * Complete a step
   */
  async completeStep(
    jobId: string,
    stepCode: string,
    technicianId: string,
    technicianName: string,
    data: StepCompletionData
  ): Promise<StepCompletion> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    const id = randomUUID();
    const now = nowFn();

    // Serialize JSON fields
    const checklistResults = data.checklistResults ? JSON.stringify(data.checklistResults) : null;
    const inputValues = data.inputValues ? JSON.stringify(data.inputValues) : null;
    const measurements = data.measurements ? JSON.stringify(data.measurements) : null;
    const photoUrls = data.photos?.map(p => p.url) || null;
    const photoTypes = data.photos?.map(p => p.type) || null;

    if (isPostgres()) {
      await this.db.query(`
        INSERT INTO refurb_step_completions (
          id, job_id, state_code, step_code,
          checklist_results, input_values, measurements,
          notes, photo_urls, photo_types,
          completed_by, completed_by_name, completed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${now}
        )
        ON CONFLICT (job_id, state_code, step_code) DO UPDATE SET
          checklist_results = $5,
          input_values = $6,
          measurements = $7,
          notes = $8,
          photo_urls = $9,
          photo_types = $10,
          completed_by = $11,
          completed_by_name = $12,
          completed_at = ${now}
      `, [
        id, jobId, job.currentState, stepCode,
        checklistResults, inputValues, measurements,
        data.notes || null, photoUrls, photoTypes,
        technicianId, technicianName,
      ]);
    } else {
      // SQLite doesn't have good upsert, so delete + insert
      await this.db.query(`
        DELETE FROM refurb_step_completions
        WHERE job_id = $1 AND state_code = $2 AND step_code = $3
      `, [jobId, job.currentState, stepCode]);

      await this.db.query(`
        INSERT INTO refurb_step_completions (
          id, job_id, state_code, step_code,
          checklist_results, input_values, measurements,
          notes, photo_urls, photo_types,
          completed_by, completed_by_name, completed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${now}
        )
      `, [
        id, jobId, job.currentState, stepCode,
        checklistResults, inputValues, measurements,
        data.notes || null,
        photoUrls ? JSON.stringify(photoUrls) : null,
        photoTypes ? JSON.stringify(photoTypes) : null,
        technicianId, technicianName,
      ]);
    }

    // Update job's current step index
    const completedSteps = await this.getCompletedSteps(jobId, job.currentState);
    await this.db.query(`
      UPDATE refurb_jobs SET current_step_index = $1, updated_at = ${now}
      WHERE id = $2
    `, [completedSteps.length, jobId]);

    const result = await this.db.query<Record<string, unknown>>(`
      SELECT * FROM refurb_step_completions
      WHERE job_id = $1 AND state_code = $2 AND step_code = $3
    `, [jobId, job.currentState, stepCode]);

    return this.mapStepCompletionRow(result.rows[0]);
  }

  // ==================== PROMPT GENERATION ====================

  /**
   * Get the current prompt for a job
   */
  async getCurrentPrompt(
    jobId: string,
    stepsForState: WorkflowStep[]
  ): Promise<WorkflowPrompt> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    const completedSteps = await this.getCompletedSteps(jobId, job.currentState);
    const completedStepCodes = new Set(completedSteps.map(s => s.stepCode));

    // Find first incomplete step
    const currentStepIndex = stepsForState.findIndex(s => !completedStepCodes.has(s.code));
    const currentStep = currentStepIndex >= 0 ? stepsForState[currentStepIndex] : undefined;

    // Calculate progress
    const statesCompleted = REFURB_STATE_ORDER.indexOf(job.currentState);
    const totalStates = REFURB_STATE_ORDER.length;

    // Determine available actions
    const canAdvance = currentStepIndex === -1 || currentStepIndex >= stepsForState.length;
    const transitions = STATE_TRANSITIONS[job.currentState];
    const canBlock = transitions.some(t => t.action === 'BLOCK');
    const canEscalate = transitions.some(t => t.action === 'ESCALATE');
    const canRetry = transitions.some(t => t.action === 'RETRY');

    return {
      job,
      state: job.currentState,
      stateName: REFURB_STATE_DISPLAY[job.currentState],
      totalSteps: stepsForState.length,
      currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : stepsForState.length,
      currentStep,
      completedSteps,
      progress: {
        statesCompleted,
        totalStates,
        overallPercent: Math.round((statesCompleted / totalStates) * 100),
      },
      canAdvance,
      canBlock,
      canEscalate,
      canRetry,
    };
  }

  // ==================== CERTIFICATION ====================

  /**
   * Certify a completed job
   */
  async certifyJob(
    jobId: string,
    technicianId: string,
    data: {
      finalGrade: FinalGrade;
      warrantyEligible: boolean;
      notes?: string;
    }
  ): Promise<RefurbJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    if (job.currentState !== 'FINAL_TEST_PASSED') {
      throw new Error('Job must be in FINAL_TEST_PASSED state to certify');
    }

    // Transition to CERTIFIED with data
    return this.transitionJob(jobId, 'ADVANCE', technicianId, {
      finalGrade: data.finalGrade,
      warrantyEligible: data.warrantyEligible,
      notes: data.notes,
    });
  }

  // ==================== STATS ====================

  /**
   * Get workflow statistics
   */
  async getStats(): Promise<{
    total: number;
    byState: Record<RefurbState, number>;
    byCategory: Record<string, number>;
    completedToday: number;
    avgCycleTimeHours: number;
  }> {
    const db = this.db;

    // Total jobs
    const totalResult = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM refurb_jobs');
    const total = parseInt(totalResult.rows[0].count);

    // By state
    const byStateResult = await db.query<{ current_state: string; count: string }>(`
      SELECT current_state, COUNT(*) as count FROM refurb_jobs GROUP BY current_state
    `);
    const byState: Record<string, number> = {};
    for (const row of byStateResult.rows) {
      byState[row.current_state] = parseInt(row.count);
    }

    // By category
    const byCategoryResult = await db.query<{ category: string; count: string }>(`
      SELECT category, COUNT(*) as count FROM refurb_jobs GROUP BY category
    `);
    const byCategory: Record<string, number> = {};
    for (const row of byCategoryResult.rows) {
      byCategory[row.category] = parseInt(row.count);
    }

    // Completed today
    const todayCondition = isPostgres()
      ? `completed_at >= CURRENT_DATE`
      : `date(completed_at) = date('now')`;
    const completedTodayResult = await db.query<{ count: string }>(`
      SELECT COUNT(*) as count FROM refurb_jobs
      WHERE current_state = 'REFURBZ_COMPLETE' AND ${todayCondition}
    `);
    const completedToday = parseInt(completedTodayResult.rows[0].count);

    // Average cycle time (completed jobs only)
    let avgCycleTimeHours = 0;
    if (isPostgres()) {
      const avgResult = await db.query<{ avg_hours: string | null }>(`
        SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) as avg_hours
        FROM refurb_jobs
        WHERE current_state = 'REFURBZ_COMPLETE' AND started_at IS NOT NULL AND completed_at IS NOT NULL
      `);
      avgCycleTimeHours = avgResult.rows[0].avg_hours ? parseFloat(avgResult.rows[0].avg_hours) : 0;
    }

    return {
      total,
      byState: byState as Record<RefurbState, number>,
      byCategory,
      completedToday,
      avgCycleTimeHours: Math.round(avgCycleTimeHours * 10) / 10,
    };
  }

  // ==================== ROW MAPPERS ====================

  private mapJobRow(row: Record<string, unknown>): RefurbJob {
    return {
      id: row.id as string,
      qlid: row.qlid as string,
      palletId: row.pallet_id as string,
      category: row.category as ProductCategory,
      manufacturer: row.manufacturer as string | undefined,
      model: row.model as string | undefined,
      currentState: row.current_state as RefurbState,
      currentStepIndex: row.current_step_index as number,
      assignedTechnicianId: row.assigned_technician_id as string | undefined,
      assignedTechnicianName: row.assigned_technician_name as string | undefined,
      assignedAt: row.assigned_at ? new Date(row.assigned_at as string) : undefined,
      attemptCount: row.attempt_count as number,
      maxAttempts: row.max_attempts as number,
      finalGrade: row.final_grade as FinalGrade | undefined,
      warrantyEligible: row.warranty_eligible as boolean | undefined,
      disposition: row.disposition as string | undefined,
      priority: row.priority as JobPriority,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapStepCompletionRow(row: Record<string, unknown>): StepCompletion {
    // Parse JSON fields
    let checklistResults: Record<string, boolean> | undefined;
    let inputValues: Record<string, unknown> | undefined;
    let measurements: Record<string, number> | undefined;
    let photoUrls: string[] | undefined;
    let photoTypes: string[] | undefined;

    if (row.checklist_results) {
      checklistResults = typeof row.checklist_results === 'string'
        ? JSON.parse(row.checklist_results)
        : row.checklist_results as Record<string, boolean>;
    }
    if (row.input_values) {
      inputValues = typeof row.input_values === 'string'
        ? JSON.parse(row.input_values)
        : row.input_values as Record<string, unknown>;
    }
    if (row.measurements) {
      measurements = typeof row.measurements === 'string'
        ? JSON.parse(row.measurements)
        : row.measurements as Record<string, number>;
    }
    if (row.photo_urls) {
      photoUrls = typeof row.photo_urls === 'string'
        ? JSON.parse(row.photo_urls)
        : row.photo_urls as string[];
    }
    if (row.photo_types) {
      photoTypes = typeof row.photo_types === 'string'
        ? JSON.parse(row.photo_types)
        : row.photo_types as string[];
    }

    return {
      id: row.id as string,
      jobId: row.job_id as string,
      stateCode: row.state_code as RefurbState,
      stepCode: row.step_code as string,
      checklistResults,
      inputValues,
      measurements,
      notes: row.notes as string | undefined,
      photoUrls,
      photoTypes,
      completedBy: row.completed_by as string,
      completedByName: row.completed_by_name as string | undefined,
      durationSeconds: row.duration_seconds as number | undefined,
      completedAt: new Date(row.completed_at as string),
    };
  }

  // ==================== DIAGNOSIS MANAGEMENT ====================

  /**
   * Add a diagnosis/defect to a job
   */
  async addDiagnosis(
    jobId: string,
    data: {
      defectCode: string;
      severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'COSMETIC';
      measurements?: Record<string, number>;
      repairAction?: string;
      partsRequired?: { sku: string; name: string; quantity: number }[];
      diagnosedBy: string;
    }
  ): Promise<{ id: string; jobId: string; defectCode: string }> {
    const id = randomUUID();
    const now = nowFn();

    await this.db.query(`
      INSERT INTO job_diagnoses (
        id, job_id, defect_code, severity, measurements,
        repair_action, parts_required, repair_status,
        diagnosed_by, diagnosed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, ${now})
    `, [
      id,
      jobId,
      data.defectCode,
      data.severity,
      data.measurements ? JSON.stringify(data.measurements) : null,
      data.repairAction || null,
      data.partsRequired ? JSON.stringify(data.partsRequired) : null,
      data.diagnosedBy,
    ]);

    return { id, jobId, defectCode: data.defectCode };
  }

  /**
   * Get all diagnoses for a job
   */
  async getJobDiagnoses(jobId: string): Promise<{
    id: string;
    jobId: string;
    defectCode: string;
    severity: string;
    measurements?: Record<string, number>;
    repairAction?: string;
    partsRequired?: { sku: string; name: string; quantity: number }[];
    repairStatus: string;
    diagnosedBy: string;
    diagnosedAt: Date;
  }[]> {
    const result = await this.db.query<Record<string, unknown>>(`
      SELECT * FROM job_diagnoses WHERE job_id = $1 ORDER BY diagnosed_at DESC
    `, [jobId]);

    return result.rows.map(row => ({
      id: row.id as string,
      jobId: row.job_id as string,
      defectCode: row.defect_code as string,
      severity: row.severity as string,
      measurements: row.measurements
        ? (typeof row.measurements === 'string' ? JSON.parse(row.measurements) : row.measurements)
        : undefined,
      repairAction: row.repair_action as string | undefined,
      partsRequired: row.parts_required
        ? (typeof row.parts_required === 'string' ? JSON.parse(row.parts_required) : row.parts_required)
        : undefined,
      repairStatus: row.repair_status as string,
      diagnosedBy: row.diagnosed_by as string,
      diagnosedAt: new Date(row.diagnosed_at as string),
    }));
  }

  /**
   * Get job history (step completions + transitions)
   */
  async getJobHistory(jobId: string): Promise<{
    stepCompletions: StepCompletion[];
    transitions: {
      id: string;
      fromState: RefurbState | null;
      toState: RefurbState;
      action: TransitionAction;
      technicianId?: string;
      reason?: string;
      notes?: string;
      createdAt: Date;
    }[];
  }> {
    const stepCompletions = await this.getCompletedSteps(jobId);

    const transitionsResult = await this.db.query<Record<string, unknown>>(`
      SELECT * FROM workflow_transitions WHERE job_id = $1 ORDER BY created_at ASC
    `, [jobId]);

    const transitions = transitionsResult.rows.map(row => ({
      id: row.id as string,
      fromState: row.from_state as RefurbState | null,
      toState: row.to_state as RefurbState,
      action: row.action as TransitionAction,
      technicianId: row.technician_id as string | undefined,
      reason: row.reason as string | undefined,
      notes: row.notes as string | undefined,
      createdAt: new Date(row.created_at as string),
    }));

    return { stepCompletions, transitions };
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();
