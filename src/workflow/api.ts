/**
 * QuickRefurbz - Workflow API Routes
 * RESTful endpoints for the prompt-based refurbishment workflow system
 * Includes QuickDiagnosticz diagnostic and certification endpoints
 */

import { Router, Request, Response } from 'express';
import { workflowEngine } from './engine.js';
import { CategorySOPs, DefectCodes, getSOPForCategory } from './sops.js';
import {
  startSession,
  getSession,
  getActiveSession,
  recordTestResult,
  completeSession,
  getSessionResults,
  getSessionDefects,
  listSessions,
  getTechnicianDiagnosticStats,
  getAllTechnicianDiagnosticStats,
  performExternalCheck,
  getExternalChecks,
  getExternalChecksForCertification,
  hasFlags,
  runAllChecks,
} from '../diagnostics/index.js';
import {
  getTestsForCategory,
  getTestSuite,
  getAllTestSuites,
  getAllTestCategories,
} from '../diagnostics/testDefinitions.js';
import {
  issueCertification,
  getCertification,
  revokeCertification,
  listCertifications,
  getCertificationStats,
  verifyCertification,
  getDeviceHistoryReport,
} from '../certification/index.js';
import {
  generateReportPdf,
} from '../certification/reportGenerator.js';
import {
  generateCertificationLabel,
  generateCertificationLabelBuffer,
} from '../certification/labelGenerator.js';
import type {
  RefurbState,
  TransitionAction,
  ProductCategory,
  JobPriority,
  FinalGrade
} from '../types.js';
import type { CertificationLevel } from '../certification/types.js';
import type { TestResult, ExternalCheckType, ExternalCheckProvider } from '../diagnostics/types.js';
import { getTestByCode } from '../diagnostics/testDefinitions.js';

// Extend Request to include user
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'manager' | 'technician';
  };
}

const router = Router();

// Helper to get string from query param
function queryString(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

// Helper to extract route param as string
function paramString(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// ==================== JOB MANAGEMENT ====================

/**
 * POST /api/workflow/jobs
 * Create a new refurb job from scanned QLID
 */
router.post('/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const { qlid, palletId, category, priority } = req.body;

    if (!qlid) {
      res.status(400).json({ error: 'QLID required' });
      return;
    }

    const job = await workflowEngine.createJob({
      qlid,
      palletId: palletId || qlid.split('-')[0], // Extract pallet from QLID if not provided
      category: (category as ProductCategory) || 'OTHER',
      priority: (priority as JobPriority) || 'NORMAL'
    });

    res.status(201).json(job);
  } catch (error: any) {
    console.error('Create job error:', error);
    res.status(400).json({ error: error.message || 'Failed to create job' });
  }
});

/**
 * GET /api/workflow/jobs
 * List jobs with optional filters
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const state = queryString(req.query.state) as RefurbState | undefined;
    const technicianId = queryString(req.query.technicianId);
    const category = queryString(req.query.category) as ProductCategory | undefined;
    const priority = queryString(req.query.priority) as JobPriority | undefined;

    const jobs = await workflowEngine.listJobs({
      state,
      technicianId,
      category,
      priority
    });

    res.json(jobs);
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * GET /api/workflow/jobs/:qlid
 * Get job details by QLID
 */
router.get('/jobs/:qlid', async (req: Request, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const job = await workflowEngine.getJobByQlid(qlid);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/**
 * GET /api/workflow/jobs/:qlid/prompt
 * Get current prompt/step for a job
 */
router.get('/jobs/:qlid/prompt', async (req: Request, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const job = await workflowEngine.getJobByQlid(qlid);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Get the SOP for this job's category
    const sop = getSOPForCategory(job.category);
    const stepsForState = sop.states[job.currentState] || [];

    const prompt = await workflowEngine.getCurrentPrompt(job.id, stepsForState);
    res.json(prompt);
  } catch (error) {
    console.error('Get prompt error:', error);
    res.status(500).json({ error: 'Failed to get current prompt' });
  }
});

/**
 * POST /api/workflow/jobs/:qlid/steps/:stepCode/complete
 * Complete a workflow step
 */
router.post('/jobs/:qlid/steps/:stepCode/complete', async (req: AuthRequest, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const stepCode = paramString(req.params.stepCode);
    const {
      checklistResults,
      inputValues,
      measurements,
      notes,
      photoUrls
    } = req.body;

    const job = await workflowEngine.getJobByQlid(qlid);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Convert photoUrls array to photos format
    const photos = photoUrls ? photoUrls.map((url: string) => ({ url, type: 'STEP' })) : undefined;

    const result = await workflowEngine.completeStep(
      job.id,
      stepCode,
      req.user?.id || 'system',
      req.user?.name || 'System',
      {
        checklistResults: checklistResults || {},
        inputValues: inputValues || {},
        measurements: measurements || {},
        notes,
        photos
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error('Complete step error:', error);
    res.status(400).json({ error: error.message || 'Failed to complete step' });
  }
});

/**
 * POST /api/workflow/jobs/:qlid/transition
 * Transition job state (ADVANCE, BLOCK, ESCALATE, etc.)
 */
router.post('/jobs/:qlid/transition', async (req: AuthRequest, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const { action, reason, notes } = req.body;

    if (!action) {
      res.status(400).json({ error: 'Transition action required' });
      return;
    }

    const job = await workflowEngine.getJobByQlid(qlid);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const updatedJob = await workflowEngine.transitionJob(
      job.id,
      action as TransitionAction,
      req.user?.id || 'system',
      { reason, notes }
    );

    res.json(updatedJob);
  } catch (error: any) {
    console.error('Transition job error:', error);
    res.status(400).json({ error: error.message || 'Failed to transition job' });
  }
});

/**
 * POST /api/workflow/jobs/:qlid/assign
 * Assign technician to job
 */
router.post('/jobs/:qlid/assign', async (req: AuthRequest, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const { technicianId, technicianName } = req.body;

    if (!technicianId) {
      res.status(400).json({ error: 'Technician ID required' });
      return;
    }

    const job = await workflowEngine.getJobByQlid(qlid);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const updatedJob = await workflowEngine.assignJob(job.id, technicianId, technicianName);
    res.json(updatedJob);
  } catch (error: any) {
    console.error('Assign job error:', error);
    res.status(400).json({ error: error.message || 'Failed to assign job' });
  }
});

/**
 * POST /api/workflow/jobs/:qlid/diagnose
 * Add diagnosis/defect to job
 */
router.post('/jobs/:qlid/diagnose', async (req: AuthRequest, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const {
      defectCode,
      severity,
      measurements,
      repairAction,
      partsRequired
    } = req.body;

    if (!defectCode) {
      res.status(400).json({ error: 'Defect code required' });
      return;
    }

    const job = await workflowEngine.getJobByQlid(qlid);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const diagnosis = await workflowEngine.addDiagnosis(job.id, {
      defectCode,
      severity: severity || 'MINOR',
      measurements,
      repairAction,
      partsRequired,
      diagnosedBy: req.user?.id || 'system'
    });

    res.json(diagnosis);
  } catch (error: any) {
    console.error('Add diagnosis error:', error);
    res.status(400).json({ error: error.message || 'Failed to add diagnosis' });
  }
});

/**
 * GET /api/workflow/jobs/:qlid/diagnoses
 * Get all diagnoses for a job
 */
router.get('/jobs/:qlid/diagnoses', async (req: Request, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const job = await workflowEngine.getJobByQlid(qlid);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const diagnoses = await workflowEngine.getJobDiagnoses(job.id);
    res.json(diagnoses);
  } catch (error) {
    console.error('Get diagnoses error:', error);
    res.status(500).json({ error: 'Failed to get diagnoses' });
  }
});

/**
 * POST /api/workflow/jobs/:qlid/certify
 * Final certification of job
 */
router.post('/jobs/:qlid/certify', async (req: AuthRequest, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const { finalGrade, warrantyEligible, notes } = req.body;

    if (!finalGrade) {
      res.status(400).json({ error: 'Final grade required' });
      return;
    }

    const job = await workflowEngine.getJobByQlid(qlid);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const updatedJob = await workflowEngine.certifyJob(
      job.id,
      req.user?.id || 'system',
      {
        finalGrade: finalGrade as FinalGrade,
        warrantyEligible: warrantyEligible ?? true,
        notes
      }
    );

    res.json(updatedJob);
  } catch (error: any) {
    console.error('Certify job error:', error);
    res.status(400).json({ error: error.message || 'Failed to certify job' });
  }
});

/**
 * GET /api/workflow/jobs/:qlid/history
 * Get full step completion history for a job
 */
router.get('/jobs/:qlid/history', async (req: Request, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const job = await workflowEngine.getJobByQlid(qlid);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const history = await workflowEngine.getJobHistory(job.id);
    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get job history' });
  }
});

// ==================== SOP MANAGEMENT ====================

/**
 * GET /api/workflow/sops/:category
 * Get SOP for a specific category
 */
router.get('/sops/:category', (req: Request, res: Response) => {
  try {
    const category = paramString(req.params.category);
    const sop = CategorySOPs[category.toUpperCase() as ProductCategory];

    if (!sop) {
      // Return generic SOP for unknown categories
      const genericSop = CategorySOPs['OTHER'];
      res.json(genericSop);
      return;
    }

    res.json(sop);
  } catch (error) {
    console.error('Get SOP error:', error);
    res.status(500).json({ error: 'Failed to get SOP' });
  }
});

/**
 * GET /api/workflow/sops
 * Get all available SOPs
 */
router.get('/sops', (_req: Request, res: Response) => {
  try {
    const sops = Object.entries(CategorySOPs).map(([category, sop]) => ({
      category,
      name: sop.name,
      stateCount: Object.keys(sop.states).length
    }));
    res.json(sops);
  } catch (error) {
    console.error('List SOPs error:', error);
    res.status(500).json({ error: 'Failed to list SOPs' });
  }
});

// ==================== DEFECT CODES ====================

/**
 * GET /api/workflow/defect-codes
 * Get all defect codes, optionally filtered by category
 */
router.get('/defect-codes', (req: Request, res: Response) => {
  try {
    const category = queryString(req.query.category);

    let codes = DefectCodes;
    if (category) {
      codes = DefectCodes.filter(c =>
        c.category.toUpperCase() === category.toUpperCase() ||
        c.category === 'GENERAL'
      );
    }

    res.json(codes);
  } catch (error) {
    console.error('Get defect codes error:', error);
    res.status(500).json({ error: 'Failed to get defect codes' });
  }
});

/**
 * GET /api/workflow/defect-codes/:code
 * Get specific defect code details
 */
router.get('/defect-codes/:code', (req: Request, res: Response) => {
  try {
    const code = paramString(req.params.code);
    const defectCode = DefectCodes.find(c => c.code === code.toUpperCase());

    if (!defectCode) {
      res.status(404).json({ error: `Defect code not found: ${code}` });
      return;
    }

    res.json(defectCode);
  } catch (error) {
    console.error('Get defect code error:', error);
    res.status(500).json({ error: 'Failed to get defect code' });
  }
});

// ==================== STATISTICS ====================

/**
 * GET /api/workflow/stats
 * Get workflow statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await workflowEngine.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get workflow stats' });
  }
});

/**
 * GET /api/workflow/queue
 * Get jobs queue overview by state
 */
router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const states: RefurbState[] = [
      'REFURBZ_QUEUED',
      'REFURBZ_ASSIGNED',
      'REFURBZ_IN_PROGRESS',
      'SECURITY_PREP_COMPLETE',
      'DIAGNOSED',
      'REPAIR_IN_PROGRESS',
      'REPAIR_COMPLETE',
      'FINAL_TEST_IN_PROGRESS',
      'FINAL_TEST_PASSED',
      'CERTIFIED',
      'REFURBZ_COMPLETE',
      'REFURBZ_BLOCKED',
      'REFURBZ_ESCALATED',
      'FINAL_TEST_FAILED'
    ];

    const queue: Record<string, { count: number; jobs: any[] }> = {};

    for (const state of states) {
      const jobs = await workflowEngine.listJobs({ state });
      queue[state] = {
        count: jobs.length,
        jobs: jobs.slice(0, 20) // Limit to 20 per state
      };
    }

    res.json(queue);
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// ==================== DIAGNOSTIC TESTS ====================

/**
 * GET /api/diagnostics/tests
 * List all test definitions or filter by category
 */
router.get('/diagnostics/tests', (req: Request, res: Response) => {
  try {
    const category = queryString(req.query.category);

    if (category) {
      const tests = getTestsForCategory(category as ProductCategory);
      res.json(tests);
    } else {
      // Return all categories
      const categories = getAllTestCategories();
      const allTests: Record<string, any[]> = {};
      for (const cat of categories) {
        allTests[cat] = getTestsForCategory(cat as ProductCategory);
      }
      res.json(allTests);
    }
  } catch (error: any) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tests' });
  }
});

/**
 * GET /api/diagnostics/tests/all
 * Get all test suites for all categories
 */
router.get('/diagnostics/tests/all', (req: Request, res: Response) => {
  try {
    const suites = getAllTestSuites();
    res.json(suites);
  } catch (error: any) {
    console.error('Get all test suites error:', error);
    res.status(500).json({ error: error.message || 'Failed to get test suites' });
  }
});

/**
 * GET /api/diagnostics/tests/:category
 * Get tests for a specific category
 */
router.get('/diagnostics/tests/:category', (req: Request, res: Response) => {
  try {
    const category = paramString(req.params.category).toUpperCase() as ProductCategory;
    const suite = getTestSuite(category);

    if (!suite) {
      res.status(404).json({ error: `No test suite found for category: ${category}` });
      return;
    }

    res.json(suite);
  } catch (error: any) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tests' });
  }
});

// ==================== DIAGNOSTIC SESSIONS ====================

/**
 * POST /api/diagnostics/sessions
 * Start a new diagnostic session
 */
router.post('/diagnostics/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { qlid, category, jobId } = req.body;

    if (!qlid || !category) {
      res.status(400).json({ error: 'QLID and category are required' });
      return;
    }

    const session = await startSession({
      qlid,
      category: category as ProductCategory,
      jobId,
      technicianId: req.user?.id || 'system',
      technicianName: req.user?.name || 'System',
    });

    res.status(201).json(session);
  } catch (error: any) {
    console.error('Start session error:', error);
    res.status(400).json({ error: error.message || 'Failed to start session' });
  }
});

/**
 * GET /api/diagnostics/sessions
 * List diagnostic sessions
 */
router.get('/diagnostics/sessions', async (req: Request, res: Response) => {
  try {
    const qlid = queryString(req.query.qlid);
    const category = queryString(req.query.category) as ProductCategory | undefined;
    const limitStr = queryString(req.query.limit);
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    const sessions = await listSessions({ qlid, category, limit });
    res.json(sessions);
  } catch (error: any) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: error.message || 'Failed to list sessions' });
  }
});

/**
 * GET /api/diagnostics/sessions/:qlid
 * Get active session for QLID or specific session by session number
 */
router.get('/diagnostics/sessions/:qlid', async (req: Request, res: Response) => {
  try {
    const qlidOrSession = paramString(req.params.qlid);

    // Check if it's a session number (DS-xxx format) or QLID
    let session;
    if (qlidOrSession.startsWith('DS-')) {
      session = await getSession(qlidOrSession);
    } else {
      session = await getActiveSession(qlidOrSession);
    }

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get results and defects
    const results = await getSessionResults(session.sessionNumber);
    const defects = await getSessionDefects(session.sessionNumber);

    res.json({
      session,
      results,
      defects,
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message || 'Failed to get session' });
  }
});

/**
 * POST /api/diagnostics/sessions/:sessionNumber/tests
 * Record a test result
 */
router.post('/diagnostics/sessions/:sessionNumber/tests', async (req: AuthRequest, res: Response) => {
  try {
    const sessionNumber = paramString(req.params.sessionNumber);
    const { testCode, result, measurementValue, measurementUnit, notes, photoUrls } = req.body;

    if (!testCode || !result) {
      res.status(400).json({ error: 'testCode and result are required' });
      return;
    }

    // Look up the session to get the session ID
    const session = await getSession(sessionNumber);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get test definition
    const testDef = getTestByCode(testCode);
    if (!testDef) {
      res.status(400).json({ error: `Invalid test code: ${testCode}` });
      return;
    }

    // Use the code as test ID if no DB test ID (tests are defined in code, not DB)
    const testId = testCode;

    const testResult = await recordTestResult(session.id, {
      sessionId: session.id,
      testId,
      testCode,
      result: result as TestResult,
      measurementValue: measurementValue !== undefined ? parseFloat(measurementValue) : undefined,
      measurementUnit,
      notes,
      photoUrls,
      testedBy: req.user?.id || 'system',
    });

    res.status(201).json(testResult);
  } catch (error: any) {
    console.error('Record test result error:', error);
    res.status(400).json({ error: error.message || 'Failed to record test result' });
  }
});

/**
 * POST /api/diagnostics/sessions/:sessionNumber/complete
 * Complete a diagnostic session
 */
router.post('/diagnostics/sessions/:sessionNumber/complete', async (req: AuthRequest, res: Response) => {
  try {
    const sessionNumber = paramString(req.params.sessionNumber);
    const { notes } = req.body;

    const result = await completeSession(sessionNumber, notes);
    res.json(result);
  } catch (error: any) {
    console.error('Complete session error:', error);
    res.status(400).json({ error: error.message || 'Failed to complete session' });
  }
});

/**
 * GET /api/diagnostics/technicians/stats
 * Get diagnostic performance stats for all technicians
 */
router.get('/diagnostics/technicians/stats', async (req: Request, res: Response) => {
  try {
    const allStats = await getAllTechnicianDiagnosticStats();

    // Calculate overall summary
    const totalSessions = allStats.reduce((sum, s) => sum + s.totalSessions, 0);
    const totalCompleted = allStats.reduce((sum, s) => sum + s.completedSessions, 0);
    const totalPassed = allStats.reduce((sum, s) => sum + s.passedSessions, 0);
    const totalFailed = allStats.reduce((sum, s) => sum + s.failedSessions, 0);
    const overallPassRate = totalCompleted > 0 ? (totalPassed / totalCompleted) * 100 : 0;

    res.json({
      technicians: allStats,
      summary: {
        technicianCount: allStats.length,
        totalSessions,
        totalCompleted,
        totalPassed,
        totalFailed,
        overallPassRate,
      }
    });
  } catch (error: any) {
    console.error('Get technician stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get technician stats' });
  }
});

/**
 * GET /api/diagnostics/technicians/:technicianId/stats
 * Get diagnostic performance stats for a specific technician
 */
router.get('/diagnostics/technicians/:technicianId/stats', async (req: Request, res: Response) => {
  try {
    const technicianId = paramString(req.params.technicianId);
    const stats = await getTechnicianDiagnosticStats(technicianId);

    if (!stats) {
      res.status(404).json({ error: 'No diagnostic data found for technician' });
      return;
    }

    res.json(stats);
  } catch (error: any) {
    console.error('Get technician stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get technician stats' });
  }
});

// ==================== CERTIFICATIONS ====================

/**
 * POST /api/certifications
 * Issue a new certification
 */
router.post('/certifications', async (req: AuthRequest, res: Response) => {
  try {
    const {
      qlid,
      jobId,
      sessionId,
      category,
      manufacturer,
      model,
      serialNumber,
      imei,
      imei2,
      esn,
      macAddress,
      certificationLevel,
      notes,
    } = req.body;

    if (!qlid || !category || !manufacturer || !model || !certificationLevel) {
      res.status(400).json({
        error: 'qlid, category, manufacturer, model, and certificationLevel are required'
      });
      return;
    }

    const certification = await issueCertification({
      qlid,
      jobId,
      sessionId,
      category: category as ProductCategory,
      manufacturer,
      model,
      serialNumber,
      imei,
      imei2,
      esn,
      macAddress,
      certificationLevel: certificationLevel as CertificationLevel,
      certifiedBy: req.user?.id || 'system',
      notes,
    });

    res.status(201).json(certification);
  } catch (error: any) {
    console.error('Issue certification error:', error);
    res.status(400).json({ error: error.message || 'Failed to issue certification' });
  }
});

/**
 * GET /api/certifications
 * List certifications
 */
router.get('/certifications', async (req: Request, res: Response) => {
  try {
    const category = queryString(req.query.category) as ProductCategory | undefined;
    const level = queryString(req.query.level) as CertificationLevel | undefined;
    const fromDate = queryString(req.query.fromDate);
    const toDate = queryString(req.query.toDate);
    const limitStr = queryString(req.query.limit);
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    const certifications = await listCertifications({
      category,
      level,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit,
    });

    res.json(certifications);
  } catch (error: any) {
    console.error('List certifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to list certifications' });
  }
});

/**
 * GET /api/certifications/stats
 * Get certification statistics
 */
router.get('/certifications/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getCertificationStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Get certification stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get certification stats' });
  }
});

/**
 * GET /api/certifications/verify/:certificationId
 * Public verification of a certification (for QR code scans)
 */
router.get('/certifications/verify/:certificationId', async (req: Request, res: Response) => {
  try {
    const certificationId = paramString(req.params.certificationId);
    const verification = await verifyCertification(certificationId);

    if (!verification) {
      res.status(404).json({
        valid: false,
        error: 'Certification not found'
      });
      return;
    }

    res.json(verification);
  } catch (error: any) {
    console.error('Verify certification error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify certification' });
  }
});

/**
 * GET /api/certifications/:certificationId
 * Get certification details
 */
router.get('/certifications/:certificationId', async (req: Request, res: Response) => {
  try {
    const certificationId = paramString(req.params.certificationId);
    const certification = await getCertification(certificationId);

    if (!certification) {
      res.status(404).json({ error: 'Certification not found' });
      return;
    }

    res.json(certification);
  } catch (error: any) {
    console.error('Get certification error:', error);
    res.status(500).json({ error: error.message || 'Failed to get certification' });
  }
});

/**
 * GET /api/certifications/:certificationId/report
 * Get or generate the Device History Report PDF
 */
router.get('/certifications/:certificationId/report', async (req: Request, res: Response) => {
  try {
    const certificationId = paramString(req.params.certificationId);
    const format = queryString(req.query.format) || 'pdf';

    if (format === 'json') {
      // Return report data as JSON
      const reportData = await getDeviceHistoryReport(certificationId);
      if (!reportData) {
        res.status(404).json({ error: 'Certification not found' });
        return;
      }
      res.json(reportData);
      return;
    }

    // Generate PDF
    const pdfPath = await generateReportPdf(certificationId);
    res.download(pdfPath);
  } catch (error: any) {
    console.error('Get report error:', error);
    res.status(500).json({ error: error.message || 'Failed to get report' });
  }
});

/**
 * GET /api/certifications/:certificationId/label
 * Get or generate the certification label
 */
router.get('/certifications/:certificationId/label', async (req: Request, res: Response) => {
  try {
    const certificationId = paramString(req.params.certificationId);
    const format = queryString(req.query.format) || 'png';

    if (format === 'buffer' || format === 'raw') {
      // Return raw buffer for direct printing
      const buffer = await generateCertificationLabelBuffer(certificationId);
      res.set('Content-Type', 'image/png');
      res.send(buffer);
      return;
    }

    // Generate and return file
    const labelPath = await generateCertificationLabel(certificationId);
    res.download(labelPath);
  } catch (error: any) {
    console.error('Get label error:', error);
    res.status(500).json({ error: error.message || 'Failed to get label' });
  }
});

/**
 * POST /api/certifications/:certificationId/revoke
 * Revoke a certification
 */
router.post('/certifications/:certificationId/revoke', async (req: AuthRequest, res: Response) => {
  try {
    const certificationId = paramString(req.params.certificationId);
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'Revocation reason is required' });
      return;
    }

    const certification = await revokeCertification(certificationId, reason);
    res.json(certification);
  } catch (error: any) {
    console.error('Revoke certification error:', error);
    res.status(400).json({ error: error.message || 'Failed to revoke certification' });
  }
});

// ==================== EXTERNAL CHECKS ====================

/**
 * POST /api/checks
 * Perform a single external check (IMEI, serial, warranty, stolen)
 */
router.post('/checks', async (req: AuthRequest, res: Response) => {
  try {
    const { qlid, checkType, provider, identifier, identifierType, certificationId, sessionId } = req.body;

    if (!qlid || !checkType || !identifier) {
      res.status(400).json({ error: 'qlid, checkType, and identifier are required' });
      return;
    }

    const check = await performExternalCheck({
      qlid,
      checkType: checkType as ExternalCheckType,
      provider: provider as ExternalCheckProvider | undefined,
      identifier,
      identifierType,
      certificationId,
      sessionId,
    });

    res.status(201).json(check);
  } catch (error: any) {
    console.error('External check error:', error);
    res.status(400).json({ error: error.message || 'Failed to perform external check' });
  }
});

/**
 * POST /api/checks/all
 * Run all standard checks for a device (IMEI + serial based)
 */
router.post('/checks/all', async (req: AuthRequest, res: Response) => {
  try {
    const { qlid, imei, serial, certificationId, sessionId } = req.body;

    if (!qlid) {
      res.status(400).json({ error: 'qlid is required' });
      return;
    }

    if (!imei && !serial) {
      res.status(400).json({ error: 'At least one of imei or serial is required' });
      return;
    }

    const checks = await runAllChecks({
      qlid,
      imei,
      serial,
      certificationId,
      sessionId,
    });

    // Get summary of any flags
    const flags = {
      hasFlags: checks.some(c => c.status === 'FLAGGED'),
      isStolen: checks.some(c => c.isStolen),
      isBlacklisted: checks.some(c => c.isBlacklisted),
      hasFinancialHold: checks.some(c => c.hasFinancialHold),
    };

    res.status(201).json({
      checks,
      flags,
      summary: {
        total: checks.length,
        clear: checks.filter(c => c.status === 'CLEAR').length,
        flagged: checks.filter(c => c.status === 'FLAGGED').length,
        error: checks.filter(c => c.status === 'ERROR').length,
      }
    });
  } catch (error: any) {
    console.error('Run all checks error:', error);
    res.status(400).json({ error: error.message || 'Failed to run checks' });
  }
});

/**
 * GET /api/checks/:qlid
 * Get all external checks for a device
 */
router.get('/checks/:qlid', async (req: Request, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const checks = await getExternalChecks(qlid);

    // Get summary of any flags
    const flags = await hasFlags(qlid);

    res.json({
      checks,
      flags,
      summary: {
        total: checks.length,
        clear: checks.filter(c => c.status === 'CLEAR').length,
        flagged: checks.filter(c => c.status === 'FLAGGED').length,
        error: checks.filter(c => c.status === 'ERROR').length,
      }
    });
  } catch (error: any) {
    console.error('Get checks error:', error);
    res.status(500).json({ error: error.message || 'Failed to get checks' });
  }
});

/**
 * GET /api/checks/cert/:certificationId
 * Get external checks associated with a certification
 */
router.get('/checks/cert/:certificationId', async (req: Request, res: Response) => {
  try {
    const certificationId = paramString(req.params.certificationId);
    const checks = await getExternalChecksForCertification(certificationId);

    res.json({
      checks,
      summary: {
        total: checks.length,
        clear: checks.filter(c => c.status === 'CLEAR').length,
        flagged: checks.filter(c => c.status === 'FLAGGED').length,
        error: checks.filter(c => c.status === 'ERROR').length,
      }
    });
  } catch (error: any) {
    console.error('Get certification checks error:', error);
    res.status(500).json({ error: error.message || 'Failed to get checks' });
  }
});

/**
 * GET /api/checks/:qlid/flags
 * Quick check if device has any flags
 */
router.get('/checks/:qlid/flags', async (req: Request, res: Response) => {
  try {
    const qlid = paramString(req.params.qlid);
    const flags = await hasFlags(qlid);
    res.json(flags);
  } catch (error: any) {
    console.error('Get flags error:', error);
    res.status(500).json({ error: error.message || 'Failed to get flags' });
  }
});

export default router;
