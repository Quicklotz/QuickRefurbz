/**
 * QuickRefurbz - Express API Server
 * REST API for the refurbishment tracking system
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database.js';
import * as palletManager from './palletManager.js';
import * as itemManager from './itemManager.js';
import * as ticketManager from './ticketManager.js';
import * as partsInventory from './partsInventory.js';
import * as technicianManager from './technicianManager.js';
import type { Retailer, LiquidationSource, ProductCategory, JobPriority, RefurbStage } from './types.js';
import workflowRoutes from './workflow/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'quickrefurbz-dev-secret-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static React frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ==================== AUTH ====================

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'technician';
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

// Helper to get string from query param
function queryString(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

// Hardcoded users (in production, use database)
const USERS: { id: string; email: string; password: string; name: string; role: 'admin' | 'manager' | 'technician' }[] = [
  {
    id: '1',
    email: 'connor@quicklotz.com',
    password: bcrypt.hashSync('QuickLotz2026!!', 10),
    name: 'Connor',
    role: 'admin'
  }
];

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = USERS.find(u => u.email === email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [itemStats, palletStats] = await Promise.all([
      itemManager.getItemStats(),
      palletManager.getPalletStats()
    ]);

    res.json({
      items: itemStats,
      pallets: palletStats
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==================== PALLETS ====================

app.get('/api/pallets', authMiddleware, async (req: Request, res: Response) => {
  try {
    const options: palletManager.ListPalletsOptions = {};

    const status = queryString(req.query.status);
    const retailer = queryString(req.query.retailer);
    const source = queryString(req.query.source);
    const limit = queryString(req.query.limit);

    if (status) options.status = status as any;
    if (retailer) options.retailer = retailer as Retailer;
    if (source) options.source = source as LiquidationSource;
    if (limit) options.limit = parseInt(limit);

    const pallets = await palletManager.listPallets(options);
    res.json(pallets);
  } catch (error) {
    console.error('List pallets error:', error);
    res.status(500).json({ error: 'Failed to list pallets' });
  }
});

app.get('/api/pallets/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const pallet = await palletManager.getPalletById(id);
    if (!pallet) {
      res.status(404).json({ error: 'Pallet not found' });
      return;
    }

    const items = await palletManager.getPalletItems(id);
    res.json({ ...pallet, items });
  } catch (error) {
    console.error('Get pallet error:', error);
    res.status(500).json({ error: 'Failed to get pallet' });
  }
});

app.post('/api/pallets', authMiddleware, async (req: Request, res: Response) => {
  try {
    const pallet = await palletManager.createPallet(req.body);
    res.status(201).json(pallet);
  } catch (error) {
    console.error('Create pallet error:', error);
    res.status(500).json({ error: 'Failed to create pallet' });
  }
});

app.put('/api/pallets/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const pallet = await palletManager.updatePallet(id, req.body);
    if (!pallet) {
      res.status(404).json({ error: 'Pallet not found' });
      return;
    }
    res.json(pallet);
  } catch (error) {
    console.error('Update pallet error:', error);
    res.status(500).json({ error: 'Failed to update pallet' });
  }
});

app.delete('/api/pallets/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await palletManager.deletePallet(id);
    if (!deleted) {
      res.status(404).json({ error: 'Pallet not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete pallet error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete pallet' });
  }
});

// ==================== ITEMS ====================

app.get('/api/items', authMiddleware, async (req: Request, res: Response) => {
  try {
    const options: itemManager.ListItemsOptions = {};

    const palletId = queryString(req.query.palletId);
    const stage = queryString(req.query.stage);
    const category = queryString(req.query.category);
    const technicianId = queryString(req.query.technicianId);
    const priority = queryString(req.query.priority);
    const limit = queryString(req.query.limit);

    if (palletId) options.palletId = palletId;
    if (stage) options.stage = stage as RefurbStage;
    if (category) options.category = category as ProductCategory;
    if (technicianId) options.technicianId = technicianId;
    if (priority) options.priority = priority as JobPriority;
    if (limit) options.limit = parseInt(limit);

    const items = await itemManager.listItems(options);
    res.json(items);
  } catch (error) {
    console.error('List items error:', error);
    res.status(500).json({ error: 'Failed to list items' });
  }
});

app.get('/api/items/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await itemManager.getItem(id);
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const history = await itemManager.getStageHistory(id);
    res.json({ ...item, history });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

app.post('/api/items/scan', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { barcode, warehouseId } = req.body;

    if (!barcode) {
      res.status(400).json({ error: 'Barcode required' });
      return;
    }

    const result = await itemManager.scanItem({
      barcode,
      employeeId: req.user?.id || 'system',
      warehouseId: warehouseId || 'WH001'
    });

    res.json(result);
  } catch (error: any) {
    console.error('Scan item error:', error);
    res.status(400).json({ error: error.message || 'Failed to scan item' });
  }
});

app.post('/api/items', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await itemManager.receiveItem({
      ...req.body,
      employeeId: req.user?.id || 'system'
    });
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Receive item error:', error);
    res.status(400).json({ error: error.message || 'Failed to receive item' });
  }
});

app.post('/api/items/:id/advance', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await itemManager.advanceStage(id, {
      ...req.body,
      technicianId: req.body.technicianId || req.user?.id
    });
    res.json(item);
  } catch (error: any) {
    console.error('Advance stage error:', error);
    res.status(400).json({ error: error.message || 'Failed to advance stage' });
  }
});

app.post('/api/items/:id/stage', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { stage, ...options } = req.body;
    const item = await itemManager.setStage(id, stage, {
      ...options,
      technicianId: options.technicianId || req.user?.id
    });
    res.json(item);
  } catch (error: any) {
    console.error('Set stage error:', error);
    res.status(400).json({ error: error.message || 'Failed to set stage' });
  }
});

app.post('/api/items/:id/assign', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { technicianId } = req.body;
    const item = await itemManager.assignTechnician(id, technicianId);
    res.json(item);
  } catch (error: any) {
    console.error('Assign technician error:', error);
    res.status(400).json({ error: error.message || 'Failed to assign technician' });
  }
});

app.delete('/api/items/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await itemManager.deleteItem(id);
    if (!deleted) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ==================== TICKETS ====================

app.get('/api/tickets', authMiddleware, async (req: Request, res: Response) => {
  try {
    const options: ticketManager.ListTicketsOptions = {};

    const status = queryString(req.query.status);
    const qlid = queryString(req.query.qlid);
    const technicianId = queryString(req.query.technicianId);
    const severity = queryString(req.query.severity);
    const limit = queryString(req.query.limit);

    if (status) options.status = status as any;
    if (qlid) options.qlid = qlid;
    if (technicianId) options.technicianId = technicianId;
    if (severity) options.severity = severity as any;
    if (limit) options.limit = parseInt(limit);

    const tickets = await ticketManager.listTickets(options);
    res.json(tickets);
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

app.get('/api/tickets/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const ticket = await ticketManager.getTicketById(id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

app.post('/api/tickets', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await ticketManager.createTicket({
      ...req.body,
      technicianId: req.body.technicianId || req.user?.id
    });
    res.status(201).json(ticket);
  } catch (error: any) {
    console.error('Create ticket error:', error);
    res.status(400).json({ error: error.message || 'Failed to create ticket' });
  }
});

app.post('/api/tickets/:id/resolve', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const ticket = await ticketManager.resolveTicket(id, {
      ...req.body,
      technicianId: req.body.technicianId || req.user?.id
    });
    res.json(ticket);
  } catch (error: any) {
    console.error('Resolve ticket error:', error);
    res.status(400).json({ error: error.message || 'Failed to resolve ticket' });
  }
});

// ==================== PARTS ====================

app.get('/api/parts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const category = queryString(req.query.category);
    const lowStock = queryString(req.query.lowStock);

    const parts = await partsInventory.listParts({
      category: category as any,
      lowStockOnly: lowStock === 'true'
    });
    res.json(parts);
  } catch (error) {
    console.error('List parts error:', error);
    res.status(500).json({ error: 'Failed to list parts' });
  }
});

app.post('/api/parts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const part = await partsInventory.addPart(req.body);
    res.status(201).json(part);
  } catch (error: any) {
    console.error('Add part error:', error);
    res.status(400).json({ error: error.message || 'Failed to add part' });
  }
});

app.post('/api/parts/:id/adjust', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { quantity, reason } = req.body;
    const part = await partsInventory.adjustInventory(id, {
      adjustment: quantity,
      reason: reason || 'Manual adjustment'
    });
    res.json(part);
  } catch (error: any) {
    console.error('Adjust stock error:', error);
    res.status(400).json({ error: error.message || 'Failed to adjust stock' });
  }
});

// ==================== TECHNICIANS ====================

app.get('/api/technicians', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const technicians = await technicianManager.listTechnicians();
    res.json(technicians);
  } catch (error) {
    console.error('List technicians error:', error);
    res.status(500).json({ error: 'Failed to list technicians' });
  }
});

app.post('/api/technicians', authMiddleware, async (req: Request, res: Response) => {
  try {
    const technician = await technicianManager.addTechnician(req.body);
    res.status(201).json(technician);
  } catch (error: any) {
    console.error('Add technician error:', error);
    res.status(400).json({ error: error.message || 'Failed to add technician' });
  }
});

app.get('/api/technicians/:id/workload', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const workload = await technicianManager.getTechnicianWorkload(id);
    res.json(workload);
  } catch (error) {
    console.error('Get workload error:', error);
    res.status(500).json({ error: 'Failed to get workload' });
  }
});

// ==================== KANBAN ====================

app.get('/api/kanban', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stages: RefurbStage[] = ['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'];
    const kanban: Record<string, any[]> = {};

    for (const stage of stages) {
      const items = await itemManager.listItems({ stage, limit: 50 });
      kanban[stage] = items;
    }

    res.json(kanban);
  } catch (error) {
    console.error('Kanban error:', error);
    res.status(500).json({ error: 'Failed to fetch kanban data' });
  }
});

// ==================== WORKFLOW API ====================

app.use('/api/workflow', authMiddleware, workflowRoutes);

// ==================== CATCH-ALL FOR REACT ====================

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ==================== START SERVER ====================

async function start() {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    app.listen(PORT, () => {
      console.log(`QuickRefurbz API running on port ${PORT}`);
      console.log(`Frontend: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
