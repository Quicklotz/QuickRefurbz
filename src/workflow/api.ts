/**
 * QuickRefurbz - Workflow API Routes
 * RESTful endpoints for the prompt-based refurbishment workflow system
 */

import { Router, Request, Response } from 'express';
import { workflowEngine } from './engine.js';
import { CategorySOPs, DefectCodes, getSOPForCategory } from './sops.js';
import type {
  RefurbState,
  TransitionAction,
  ProductCategory,
  JobPriority,
  FinalGrade
} from '../types.js';

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

export default router;
