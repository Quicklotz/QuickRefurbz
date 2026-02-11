/**
 * QuickTestz - API Routes
 * REST endpoints for test bench management and test execution.
 *
 * Mount at /api/test in server.ts
 */

import { Router, Request, Response } from 'express';
import * as equipmentCatalog from '../services/equipmentCatalog.js';
import * as stationManager from '../services/stationManager.js';
import * as profileManager from '../services/profileManager.js';
import * as testRunManager from '../services/testRunManager.js';
import * as readingsCollector from '../services/readingsCollector.js';
import * as safetyMonitor from '../services/safetyMonitor.js';
import { getAdapter } from '../adapters/interface.js';
import type { TestRunStatus } from '../types.js';

const router = Router();

/** Extract string param (Express 5 types params as string | string[]) */
function p(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0];
  return val || '';
}

// ==================== EQUIPMENT CATALOG ====================

router.get('/equipment', async (_req: Request, res: Response) => {
  try {
    const items = await equipmentCatalog.listEquipment();
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/equipment/:id', async (req: Request, res: Response) => {
  try {
    const item = await equipmentCatalog.getEquipment(p(req.params.id));
    if (!item) return res.status(404).json({ error: 'Equipment not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/equipment', async (req: Request, res: Response) => {
  try {
    const item = await equipmentCatalog.createEquipment(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/equipment/:id', async (req: Request, res: Response) => {
  try {
    const item = await equipmentCatalog.updateEquipment(p(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: 'Equipment not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/equipment/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await equipmentCatalog.deleteEquipment(p(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ==================== STATIONS ====================

router.get('/stations', async (_req: Request, res: Response) => {
  try {
    const stations = await stationManager.listStations();
    res.json({ stations });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/stations/:id', async (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    const station = await stationManager.getStation(id);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    const outlets = await stationManager.listOutlets(id);
    res.json({ ...station, outlets });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/stations', async (req: Request, res: Response) => {
  try {
    const station = await stationManager.createStation(req.body);
    res.status(201).json(station);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/stations/:id', async (req: Request, res: Response) => {
  try {
    const station = await stationManager.updateStation(p(req.params.id), req.body);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json(station);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/stations/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await stationManager.deleteStation(p(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Station not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/stations/:id/health', async (req: Request, res: Response) => {
  try {
    const station = await stationManager.getStation(p(req.params.id));
    if (!station) return res.status(404).json({ error: 'Station not found' });

    const adapter = getAdapter(station.controllerType);
    const health = await adapter.healthCheck(station);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ==================== OUTLETS ====================

router.get('/stations/:stationId/outlets', async (req: Request, res: Response) => {
  try {
    const outlets = await stationManager.listOutlets(p(req.params.stationId));
    res.json({ outlets });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/stations/:stationId/outlets', async (req: Request, res: Response) => {
  try {
    const outlet = await stationManager.createOutlet({
      ...req.body,
      stationId: p(req.params.stationId),
    });
    res.status(201).json(outlet);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/outlets/:id', async (req: Request, res: Response) => {
  try {
    const outlet = await stationManager.updateOutlet(p(req.params.id), req.body);
    if (!outlet) return res.status(404).json({ error: 'Outlet not found' });
    res.json(outlet);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/outlets/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await stationManager.deleteOutlet(p(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Outlet not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ==================== PROFILES ====================

router.get('/profiles', async (_req: Request, res: Response) => {
  try {
    const profiles = await profileManager.listProfiles();
    res.json({ profiles });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = await profileManager.getProfile(p(req.params.id));
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/profiles', async (req: Request, res: Response) => {
  try {
    const profile = await profileManager.createProfile(req.body);
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = await profileManager.updateProfile(p(req.params.id), req.body);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await profileManager.deleteProfile(p(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Profile not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ==================== TEST RUNS ====================

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const runs = await testRunManager.listTestRuns({
      qlid: req.query.qlid as string | undefined,
      stationId: req.query.stationId as string | undefined,
      status: req.query.status as TestRunStatus | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ runs });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const run = await testRunManager.getTestRun(p(req.params.id));
    if (!run) return res.status(404).json({ error: 'Test run not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/runs', async (req: Request, res: Response) => {
  try {
    const run = await testRunManager.createTestRun(req.body);
    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Start test (energize)
router.post('/runs/:id/start', async (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    const run = await testRunManager.getTestRun(id);
    if (!run) return res.status(404).json({ error: 'Test run not found' });

    if (run.status !== 'CREATED') {
      return res.status(400).json({ error: `Cannot start test in status: ${run.status}` });
    }

    const station = await stationManager.getStation(run.stationId);
    if (!station) return res.status(400).json({ error: 'Station not found' });

    const outlet = await stationManager.getOutlet(run.outletId);
    if (!outlet) return res.status(400).json({ error: 'Outlet not found' });

    const profile = await profileManager.getProfile(run.profileId);
    if (!profile) return res.status(400).json({ error: 'Profile not found' });

    // Safety validation
    const safetyErrors = safetyMonitor.validateSafety(station, outlet);
    if (safetyErrors.length > 0) {
      return res.status(400).json({
        error: 'Safety validation failed',
        details: safetyErrors,
      });
    }

    // Energize
    const adapter = getAdapter(station.controllerType);
    await adapter.turnOn(station, outlet);

    // Update status
    await testRunManager.updateTestRunStatus(run.id, 'ENERGIZED');

    // Start readings collection
    readingsCollector.startCollecting(run.id, station, outlet);

    // Start safety monitoring
    safetyMonitor.startMonitoring(run.id, station, outlet, profile);

    // Update to COLLECTING
    const updated = await testRunManager.updateTestRunStatus(run.id, 'COLLECTING');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Stop test (de-energize + compute)
router.post('/runs/:id/stop', async (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    const run = await testRunManager.getTestRun(id);
    if (!run) return res.status(404).json({ error: 'Test run not found' });

    if (!['ENERGIZED', 'COLLECTING', 'CHECKLIST'].includes(run.status)) {
      return res.status(400).json({ error: `Cannot stop test in status: ${run.status}` });
    }

    const station = await stationManager.getStation(run.stationId);
    const outlet = await stationManager.getOutlet(run.outletId);

    // De-energize
    if (station && outlet) {
      const adapter = getAdapter(station.controllerType);
      await adapter.turnOff(station, outlet);
    }

    // Stop collection and monitoring
    readingsCollector.stopCollecting(run.id);
    safetyMonitor.stopMonitoring(run.id);

    // Move to checklist phase
    const updated = await testRunManager.updateTestRunStatus(run.id, 'CHECKLIST');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get readings for a test run
router.get('/runs/:id/readings', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const readings = await readingsCollector.getReadings(p(req.params.id), limit);
    res.json({ readings });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Submit operator checklist
router.post('/runs/:id/checklist', async (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    const run = await testRunManager.getTestRun(id);
    if (!run) return res.status(404).json({ error: 'Test run not found' });

    const updated = await testRunManager.submitChecklist(id, req.body.values || req.body);

    // Auto-complete if profile available
    const profile = await profileManager.getProfile(run.profileId);
    if (profile && updated) {
      const completed = await testRunManager.completeTestRun(run.id, profile.thresholds);
      return res.json(completed);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Add attachment
router.post('/runs/:id/attachments', async (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    await testRunManager.addAttachment(id, {
      type: req.body.type || 'photo',
      url: req.body.url,
      name: req.body.name,
      uploadedAt: new Date().toISOString(),
    });
    const run = await testRunManager.getTestRun(id);
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Add notes
router.post('/runs/:id/notes', async (req: Request, res: Response) => {
  try {
    await testRunManager.setNotes(p(req.params.id), req.body.notes);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Record manual reading
router.post('/runs/:id/readings', async (req: Request, res: Response) => {
  try {
    const reading = await readingsCollector.recordReading(p(req.params.id), {
      watts: req.body.watts,
      volts: req.body.volts,
      amps: req.body.amps,
      raw: req.body.raw || {},
    });
    res.status(201).json(reading);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
