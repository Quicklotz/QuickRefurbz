/**
 * QuickRefurbz - Express API Server
 * REST API for the refurbishment tracking system
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database.js';
import * as palletManager from './palletManager.js';
import * as itemManager from './itemManager.js';
import * as ticketManager from './ticketManager.js';
import * as partsInventory from './partsInventory.js';
import * as technicianManager from './technicianManager.js';
import type { Retailer, LiquidationSource, ProductCategory, JobPriority, RefurbStage, RefurbLabelData } from './types.js';
import { buildQSKU, getRetailerFromPalletId } from './types.js';
import workflowRoutes from './workflow/api.js';
import quickTestzRoutes from './quicktestz/routes/api.js';
import { seedEquipmentAndProfiles } from './quicktestz/seed/equipmentSeed.js';
import * as readingsCollector from './quicktestz/services/readingsCollector.js';
import * as safetyMonitor from './quicktestz/services/safetyMonitor.js';
import { sendInviteEmail, sendPasswordResetEmail, sendWelcomeEmail } from './email.js';

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

import { getPool, generateUUID } from './database.js';

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

// Helper to get database user by email
async function getUserByEmail(email: string) {
  const db = getPool();
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

// Helper to get database user by ID
async function getUserById(id: string) {
  const db = getPool();
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Seed initial admin user if no users exist
async function seedAdminUser() {
  const db = getPool();
  const dbType = process.env.DB_TYPE || 'sqlite';

  const result = await db.query<{ count: string | number }>('SELECT COUNT(*) as count FROM users');
  const count = parseInt(String(result.rows[0].count));

  if (count === 0) {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!adminPassword) {
      console.warn('[Auth] INITIAL_ADMIN_PASSWORD not set. Skipping admin user creation.');
      console.warn('[Auth] Set INITIAL_ADMIN_PASSWORD environment variable to create initial admin.');
      return;
    }

    console.log('[Auth] No users found, creating initial admin user...');
    const id = generateUUID();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO users (id, email, password_hash, name, role, is_active, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, true, now(), now())`,
        [id, 'connor@quicklotz.com', passwordHash, 'Connor', 'admin']
      );
    } else {
      await db.query(
        `INSERT INTO users (id, email, password_hash, name, role, is_active, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 1, 1, datetime('now'), datetime('now'))`,
        [id, 'connor@quicklotz.com', passwordHash, 'Connor', 'admin']
      );
    }
    console.log('[Auth] Initial admin user created: connor@quicklotz.com');
  }
}

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

// Admin-only middleware
function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Login (database-backed)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({ error: 'Account is not active' });
      return;
    }

    if (!user.password_hash) {
      res.status(401).json({ error: 'Please set your password using the invite link' });
      return;
    }

    const validPassword = await bcrypt.compare(password, String(user.password_hash));
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

// Verify invite/reset token
app.get('/api/auth/verify-token', async (req: Request, res: Response) => {
  try {
    const token = queryString(req.query.token);
    const type = queryString(req.query.type);

    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    const db = getPool();
    const result = await db.query(
      `SELECT t.*, u.email, u.name FROM auth_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1 AND t.used_at IS NULL AND t.expires_at > $2
       ${type ? 'AND t.type = $3' : ''}`,
      type
        ? [token, new Date().toISOString(), type]
        : [token, new Date().toISOString()]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }

    const tokenData = result.rows[0];
    res.json({
      valid: true,
      email: tokenData.email,
      name: tokenData.name,
      type: tokenData.type
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Accept invite (set password)
app.post('/api/auth/accept-invite', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const db = getPool();
    const dbType = process.env.DB_TYPE || 'sqlite';

    // Find valid token
    const tokenResult = await db.query(
      `SELECT * FROM auth_tokens WHERE token = $1 AND type = 'invite' AND used_at IS NULL AND expires_at > $2`,
      [token, new Date().toISOString()]
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired invite token' });
      return;
    }

    const tokenData = tokenResult.rows[0];
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user with password and activate
    if (dbType === 'postgres') {
      await db.query(
        `UPDATE users SET password_hash = $1, is_active = true, email_verified = true, updated_at = now() WHERE id = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = now() WHERE id = $1`,
        [tokenData.id]
      );
    } else {
      await db.query(
        `UPDATE users SET password_hash = $1, is_active = 1, email_verified = 1, updated_at = datetime('now') WHERE id = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = datetime('now') WHERE id = $1`,
        [tokenData.id]
      );
    }

    // Get updated user and send welcome email
    const user = await getUserById(String(tokenData.user_id));
    if (user) {
      try {
        await sendWelcomeEmail(String(user.email), String(user.name));
      } catch (err) {
        console.error('Failed to send welcome email:', err);
      }
    }

    res.json({ success: true, message: 'Password set successfully. You can now log in.' });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    const user = await getUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user || !user.is_active) {
      res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
      return;
    }

    const db = getPool();
    const dbType = process.env.DB_TYPE || 'sqlite';

    // Create reset token
    const tokenId = generateUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
         VALUES ($1, $2, $3, 'reset', $4, now())`,
        [tokenId, user.id, token, expiresAt]
      );
    } else {
      await db.query(
        `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
         VALUES ($1, $2, $3, 'reset', $4, datetime('now'))`,
        [tokenId, user.id, token, expiresAt]
      );
    }

    // Send reset email
    try {
      await sendPasswordResetEmail(String(user.email), String(user.name), token);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
    }

    res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const db = getPool();
    const dbType = process.env.DB_TYPE || 'sqlite';

    // Find valid token
    const tokenResult = await db.query(
      `SELECT * FROM auth_tokens WHERE token = $1 AND type = 'reset' AND used_at IS NULL AND expires_at > $2`,
      [token, new Date().toISOString()]
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const tokenData = tokenResult.rows[0];
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password
    if (dbType === 'postgres') {
      await db.query(
        `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = now() WHERE id = $1`,
        [tokenData.id]
      );
    } else {
      await db.query(
        `UPDATE users SET password_hash = $1, updated_at = datetime('now') WHERE id = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = datetime('now') WHERE id = $1`,
        [tokenData.id]
      );
    }

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ==================== ADMIN USER MANAGEMENT ====================

// List all users (admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT id, email, name, role, is_active, email_verified, invited_at, created_at, updated_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Invite new user (admin only)
app.post('/api/auth/invite', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, role } = req.body;

    if (!email || !name) {
      res.status(400).json({ error: 'Email and name required' });
      return;
    }

    const validRoles = ['admin', 'manager', 'technician'];
    const userRole = validRoles.includes(role) ? role : 'technician';

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    const db = getPool();
    const dbType = process.env.DB_TYPE || 'sqlite';

    // Create user
    const userId = generateUUID();
    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO users (id, email, name, role, is_active, email_verified, invited_by, invited_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, false, false, $5, now(), now(), now())`,
        [userId, email.toLowerCase(), name, userRole, req.user?.id]
      );
    } else {
      await db.query(
        `INSERT INTO users (id, email, name, role, is_active, email_verified, invited_by, invited_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 0, 0, $5, datetime('now'), datetime('now'), datetime('now'))`,
        [userId, email.toLowerCase(), name, userRole, req.user?.id]
      );
    }

    // Create invite token
    const tokenId = generateUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
         VALUES ($1, $2, $3, 'invite', $4, now())`,
        [tokenId, userId, token, expiresAt]
      );
    } else {
      await db.query(
        `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
         VALUES ($1, $2, $3, 'invite', $4, datetime('now'))`,
        [tokenId, userId, token, expiresAt]
      );
    }

    // Send invite email
    try {
      await sendInviteEmail(email, name, token, req.user?.name || 'Admin');
    } catch (err) {
      console.error('Failed to send invite email:', err);
    }

    const user = await getUserById(userId);
    res.status(201).json(user);
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Update user (admin only)
app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id as string;
    const { name, role, is_active } = req.body;

    const db = getPool();
    const dbType = process.env.DB_TYPE || 'sqlite';

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (is_active !== undefined) {
      if (dbType === 'postgres') {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(is_active);
      } else {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(is_active ? 1 : 0);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    if (dbType === 'postgres') {
      updates.push(`updated_at = now()`);
    } else {
      updates.push(`updated_at = datetime('now')`);
    }

    params.push(userId);
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    const updatedUser = await getUserById(userId);
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Deactivate user (admin only)
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id as string;

    if (userId === req.user?.id) {
      res.status(400).json({ error: 'Cannot deactivate your own account' });
      return;
    }

    const db = getPool();
    const dbType = process.env.DB_TYPE || 'sqlite';

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (dbType === 'postgres') {
      await db.query(
        `UPDATE users SET is_active = false, updated_at = now() WHERE id = $1`,
        [userId]
      );
    } else {
      await db.query(
        `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = $1`,
        [userId]
      );
    }

    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Resend invite (admin only)
app.post('/api/admin/users/:id/resend-invite', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id as string;

    const db = getPool();
    const dbType = process.env.DB_TYPE || 'sqlite';

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.is_active && user.email_verified) {
      res.status(400).json({ error: 'User has already accepted their invite' });
      return;
    }

    // Invalidate old invite tokens
    if (dbType === 'postgres') {
      await db.query(
        `UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND type = 'invite' AND used_at IS NULL`,
        [userId]
      );
    } else {
      await db.query(
        `UPDATE auth_tokens SET used_at = datetime('now') WHERE user_id = $1 AND type = 'invite' AND used_at IS NULL`,
        [userId]
      );
    }

    // Create new invite token
    const tokenId = generateUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
         VALUES ($1, $2, $3, 'invite', $4, now())`,
        [tokenId, userId, token, expiresAt]
      );
    } else {
      await db.query(
        `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
         VALUES ($1, $2, $3, 'invite', $4, datetime('now'))`,
        [tokenId, userId, token, expiresAt]
      );
    }

    // Send invite email
    try {
      await sendInviteEmail(String(user.email), String(user.name), token, req.user?.name || 'Admin');
    } catch (err) {
      console.error('Failed to send invite email:', err);
    }

    res.json({ success: true, message: 'Invite resent' });
  } catch (error) {
    console.error('Resend invite error:', error);
    res.status(500).json({ error: 'Failed to resend invite' });
  }
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

import { generateRfbPalletId, generateRfbQlid, isValidRfbPalletId, isValidRfbQlid } from './rfbIdGenerator.js';

// Generate a new RFB Pallet ID (QuickIntakez-compatible: P1BBY format)
app.post('/api/pallets/generate-rfb-id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { retailer = 'OTHER' } = req.body;
    const palletId = await generateRfbPalletId(retailer as Retailer);
    res.json({ palletId });
  } catch (error) {
    console.error('Generate RFB pallet ID error:', error);
    res.status(500).json({ error: 'Failed to generate pallet ID' });
  }
});

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

// ==================== QUICKTESTZ API ====================

app.use('/api/test', authMiddleware, quickTestzRoutes);

// ==================== SETTINGS API ====================

app.get('/api/settings', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const db = getPool();
    const result = await db.query<{ key: string; value: any }>('SELECT key, value FROM app_settings');

    const settings: Record<string, any> = {};
    for (const row of result.rows) {
      settings[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    }

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.put('/api/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getPool();
    const settings = req.body;
    const dbType = process.env.DB_TYPE || 'sqlite';

    for (const [key, value] of Object.entries(settings)) {
      const jsonValue = JSON.stringify(value);

      if (dbType === 'postgres') {
        await db.query(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
          [key, jsonValue]
        );
      } else {
        await db.query(
          `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ($1, $2, datetime('now'))`,
          [key, jsonValue]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==================== DATA WIPE API ====================

// Get all wipe reports for a job/qlid
app.get('/api/datawipe/reports', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getPool();
    const qlid = queryString(req.query.qlid);

    let query = 'SELECT * FROM data_wipe_reports ORDER BY created_at DESC';
    const params: any[] = [];

    if (qlid) {
      query = 'SELECT * FROM data_wipe_reports WHERE qlid = $1 ORDER BY created_at DESC';
      params.push(qlid);
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get wipe reports error:', error);
    res.status(500).json({ error: 'Failed to get wipe reports' });
  }
});

// Get specific wipe report by QLID (public endpoint for certificates)
app.get('/api/datawipe/reports/:qlid', async (req: Request, res: Response) => {
  try {
    const db = getPool();
    const qlid = req.params.qlid as string;

    const result = await db.query(
      'SELECT * FROM data_wipe_reports WHERE qlid = $1 ORDER BY created_at DESC LIMIT 1',
      [qlid]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Wipe report not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get wipe report error:', error);
    res.status(500).json({ error: 'Failed to get wipe report' });
  }
});

// Start a data wipe process
app.post('/api/datawipe/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { qlid, jobId, deviceInfo, wipeMethod, notes } = req.body;

    if (!qlid || !wipeMethod) {
      res.status(400).json({ error: 'QLID and wipe method required' });
      return;
    }

    const id = generateUUID();
    const dbType = process.env.DB_TYPE || 'sqlite';
    const deviceInfoJson = deviceInfo ? JSON.stringify(deviceInfo) : null;

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO data_wipe_reports (id, qlid, job_id, device_info, wipe_method, wipe_status, started_at, notes)
         VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS', now(), $6)`,
        [id, qlid, jobId || null, deviceInfoJson, wipeMethod, notes || null]
      );
    } else {
      await db.query(
        `INSERT INTO data_wipe_reports (id, qlid, job_id, device_info, wipe_method, wipe_status, started_at, notes)
         VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS', datetime('now'), $6)`,
        [id, qlid, jobId || null, deviceInfoJson, wipeMethod, notes || null]
      );
    }

    const result = await db.query('SELECT * FROM data_wipe_reports WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Start wipe error:', error);
    res.status(500).json({ error: 'Failed to start data wipe' });
  }
});

// Complete a data wipe process
app.post('/api/datawipe/:id/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const id = req.params.id as string;
    const { status, verificationMethod, certificateData, notes } = req.body;
    const dbType = process.env.DB_TYPE || 'sqlite';

    const certDataJson = certificateData ? JSON.stringify(certificateData) : null;

    if (dbType === 'postgres') {
      await db.query(
        `UPDATE data_wipe_reports
         SET wipe_status = $1, completed_at = now(), verified_at = now(),
             verified_by = $2, verification_method = $3, certificate_data = $4, notes = COALESCE($5, notes)
         WHERE id = $6`,
        [status || 'COMPLETED', req.user?.id, verificationMethod, certDataJson, notes, id]
      );
    } else {
      await db.query(
        `UPDATE data_wipe_reports
         SET wipe_status = $1, completed_at = datetime('now'), verified_at = datetime('now'),
             verified_by = $2, verification_method = $3, certificate_data = $4, notes = COALESCE($5, notes)
         WHERE id = $6`,
        [status || 'COMPLETED', req.user?.id, verificationMethod, certDataJson, notes, id]
      );
    }

    const result = await db.query('SELECT * FROM data_wipe_reports WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Complete wipe error:', error);
    res.status(500).json({ error: 'Failed to complete data wipe' });
  }
});

// Generate wipe certificate/report PDF data
app.get('/api/datawipe/:qlid/certificate', async (req: Request, res: Response) => {
  try {
    const db = getPool();
    const qlid = req.params.qlid as string;

    const result = await db.query(
      'SELECT * FROM data_wipe_reports WHERE qlid = $1 AND wipe_status = $2 ORDER BY completed_at DESC LIMIT 1',
      [qlid, 'COMPLETED']
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No completed wipe report found for this QLID' });
      return;
    }

    const report = result.rows[0];
    const deviceInfo = typeof report.device_info === 'string' ? JSON.parse(report.device_info) : report.device_info;
    const certData = typeof report.certificate_data === 'string' ? JSON.parse(report.certificate_data) : report.certificate_data;

    // Return certificate data in a format suitable for PDF generation
    res.json({
      certificateId: report.id,
      qlid: report.qlid,
      deviceInfo,
      wipeMethod: report.wipe_method,
      startedAt: report.started_at,
      completedAt: report.completed_at,
      verifiedAt: report.verified_at,
      verificationMethod: report.verification_method,
      status: report.wipe_status,
      certificateData: certData,
      notes: report.notes,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({ error: 'Failed to get certificate' });
  }
});

// ==================== PARTS SUPPLIERS API ====================

app.get('/api/parts/suppliers', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const db = getPool();
    const result = await db.query('SELECT * FROM parts_suppliers ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to get suppliers' });
  }
});

app.post('/api/parts/suppliers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getPool();
    const { name, apiUrl, apiKey, syncType } = req.body;
    const id = generateUUID();
    const dbType = process.env.DB_TYPE || 'sqlite';

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO parts_suppliers (id, name, api_url, api_key, sync_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now())`,
        [id, name, apiUrl || null, apiKey || null, syncType || 'MANUAL']
      );
    } else {
      await db.query(
        `INSERT INTO parts_suppliers (id, name, api_url, api_key, sync_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', datetime('now'))`,
        [id, name, apiUrl || null, apiKey || null, syncType || 'MANUAL']
      );
    }

    const result = await db.query('SELECT * FROM parts_suppliers WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add supplier error:', error);
    res.status(500).json({ error: 'Failed to add supplier' });
  }
});

app.post('/api/parts/sync/:supplierId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getPool();
    const supplierId = req.params.supplierId;
    const dbType = process.env.DB_TYPE || 'sqlite';

    // Get supplier details
    const supplierResult = await db.query('SELECT * FROM parts_suppliers WHERE id = $1', [supplierId]);
    if (supplierResult.rows.length === 0) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    const supplier = supplierResult.rows[0];

    // TODO: Implement actual API sync logic based on supplier.api_url and supplier.api_key
    // For now, just update last_sync timestamp

    if (dbType === 'postgres') {
      await db.query(
        'UPDATE parts_suppliers SET last_sync = now() WHERE id = $1',
        [supplierId]
      );
    } else {
      await db.query(
        'UPDATE parts_suppliers SET last_sync = datetime(\'now\') WHERE id = $1',
        [supplierId]
      );
    }

    res.json({ success: true, message: `Sync initiated for ${supplier.name}` });
  } catch (error) {
    console.error('Sync supplier error:', error);
    res.status(500).json({ error: 'Failed to sync supplier' });
  }
});

app.post('/api/parts/import', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { source, parts } = req.body;

    if (!parts || !Array.isArray(parts)) {
      res.status(400).json({ error: 'Parts array required' });
      return;
    }

    const imported = [];
    for (const partData of parts) {
      try {
        const part = await partsInventory.addPart({
          ...partData,
          source: source || 'SYNCED'
        });
        imported.push(part);
      } catch (err) {
        console.error('Failed to import part:', partData, err);
      }
    }

    res.json({ success: true, imported: imported.length, total: parts.length });
  } catch (error) {
    console.error('Import parts error:', error);
    res.status(500).json({ error: 'Failed to import parts' });
  }
});

// ==================== WORK SESSION API ====================

// Get current active session for user
app.get('/api/session', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const userId = req.user?.id;

    const result = await db.query(
      `SELECT * FROM work_sessions WHERE user_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.json({ session: null, requiresSession: true });
      return;
    }

    res.json({ session: result.rows[0], requiresSession: false });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Start a new work session
app.post('/api/session/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { employeeId, workstationId, warehouseId } = req.body;
    const userId = req.user?.id;
    const dbType = process.env.DB_TYPE || 'sqlite';

    if (!employeeId || !workstationId || !warehouseId) {
      res.status(400).json({ error: 'Employee ID, Workstation ID, and Warehouse ID are required' });
      return;
    }

    // End any existing sessions for this user
    if (dbType === 'postgres') {
      await db.query(
        'UPDATE work_sessions SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL',
        [userId]
      );
    } else {
      await db.query(
        'UPDATE work_sessions SET ended_at = datetime(\'now\') WHERE user_id = $1 AND ended_at IS NULL',
        [userId]
      );
    }

    const id = generateUUID();
    const sessionDate = new Date().toISOString().split('T')[0];

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO work_sessions (id, user_id, employee_id, workstation_id, warehouse_id, session_date, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [id, userId, employeeId, workstationId, warehouseId, sessionDate]
      );
    } else {
      await db.query(
        `INSERT INTO work_sessions (id, user_id, employee_id, workstation_id, warehouse_id, session_date, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))`,
        [id, userId, employeeId, workstationId, warehouseId, sessionDate]
      );
    }

    const result = await db.query('SELECT * FROM work_sessions WHERE id = $1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End current work session
app.post('/api/session/end', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const userId = req.user?.id;
    const dbType = process.env.DB_TYPE || 'sqlite';

    if (dbType === 'postgres') {
      await db.query(
        'UPDATE work_sessions SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL',
        [userId]
      );
    } else {
      await db.query(
        'UPDATE work_sessions SET ended_at = datetime(\'now\') WHERE user_id = $1 AND ended_at IS NULL',
        [userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// ==================== PALLET LABELS API ====================

import * as labelGenerator from './labelGenerator.js';

// Generate pallet-only label
app.get('/api/labels/pallet/:palletId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const palletId = req.params.palletId as string;
    const format = queryString(req.query.format) || 'png';

    // Get pallet from database
    const pallet = await palletManager.getPalletById(palletId);
    if (!pallet) {
      res.status(404).json({ error: 'Pallet not found' });
      return;
    }

    // Generate label
    const labelData: labelGenerator.PalletLabelData = {
      palletId: pallet.palletId,
      retailer: pallet.retailer,
      liquidationSource: pallet.liquidationSource,
      receivedItems: pallet.receivedItems,
      expectedItems: pallet.expectedItems,
      warehouseId: pallet.warehouseId,
    };

    const label = await labelGenerator.generatePalletLabel(labelData);

    if (format === 'zpl') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(label.zpl);
    } else {
      res.setHeader('Content-Type', 'image/png');
      res.send(label.png);
    }
  } catch (error: any) {
    console.error('Generate pallet label error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate pallet label' });
  }
});

// Print ZPL directly to Zebra printer
app.post('/api/labels/print-zpl', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { printerIp, palletId } = req.body;

    if (!printerIp || !palletId) {
      res.status(400).json({ error: 'Printer IP and pallet ID required' });
      return;
    }

    // Get pallet and generate ZPL
    const pallet = await palletManager.getPalletById(palletId);
    if (!pallet) {
      res.status(404).json({ error: 'Pallet not found' });
      return;
    }

    const labelData: labelGenerator.PalletLabelData = {
      palletId: pallet.palletId,
      retailer: pallet.retailer,
      liquidationSource: pallet.liquidationSource,
      receivedItems: pallet.receivedItems,
      expectedItems: pallet.expectedItems,
      warehouseId: pallet.warehouseId,
    };

    const label = await labelGenerator.generatePalletLabel(labelData);

    // Send ZPL to printer
    await labelGenerator.sendZplToPrinter(printerIp, label.zpl);

    res.json({ success: true, message: `Label sent to printer at ${printerIp}` });
  } catch (error: any) {
    console.error('Print ZPL error:', error);
    res.status(500).json({ error: error.message || 'Failed to print label' });
  }
});

// ==================== REFURBISHED ITEM LABELS ====================

// Generate refurbished item label (RFB-QLID format)
app.get('/api/labels/refurb/:qlid', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const format = queryString(req.query.format) || 'png';

    // Get item from database
    const item = await itemManager.getItem(qlid);
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Check if item is complete
    if (item.currentStage !== 'COMPLETE') {
      res.status(400).json({ error: 'Item has not completed refurbishment' });
      return;
    }

    // Build QSKU (RFB-QLID format)
    const qsku = buildQSKU(item.qlid);

    // Get retailer from pallet ID
    const retailer = getRetailerFromPalletId(item.palletId);

    // Build refurb label data
    const labelData: RefurbLabelData = {
      qsku,
      qlid: item.qlid,
      manufacturer: item.manufacturer,
      model: item.model,
      category: item.category,
      finalGrade: item.finalGrade || 'C',
      warrantyEligible: false, // TODO: Get from certification
      completedAt: item.completedAt || new Date(),
      retailer,
      serialNumber: item.serialNumber,
    };

    const label = await labelGenerator.generateRefurbLabel(labelData);

    if (format === 'zpl') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(label.zpl);
    } else {
      res.setHeader('Content-Type', 'image/png');
      res.send(label.png);
    }
  } catch (error: any) {
    console.error('Generate refurb label error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate refurb label' });
  }
});

// Print refurb label directly to Zebra printer
app.post('/api/labels/refurb/print-zpl', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { printerIp, qlid } = req.body;

    if (!printerIp || !qlid) {
      res.status(400).json({ error: 'Printer IP and QLID required' });
      return;
    }

    // Get item from database
    const item = await itemManager.getItem(qlid);
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Check if item is complete
    if (item.currentStage !== 'COMPLETE') {
      res.status(400).json({ error: 'Item has not completed refurbishment' });
      return;
    }

    // Build QSKU (RFB-QLID format)
    const qsku = buildQSKU(item.qlid);
    const retailer = getRetailerFromPalletId(item.palletId);

    const labelData: RefurbLabelData = {
      qsku,
      qlid: item.qlid,
      manufacturer: item.manufacturer,
      model: item.model,
      category: item.category,
      finalGrade: item.finalGrade || 'C',
      warrantyEligible: false,
      completedAt: item.completedAt || new Date(),
      retailer,
      serialNumber: item.serialNumber,
    };

    const label = await labelGenerator.generateRefurbLabel(labelData);

    // Send ZPL to printer
    await labelGenerator.sendZplToPrinter(printerIp, label.zpl);

    res.json({ success: true, message: `Refurb label sent to printer at ${printerIp}`, qsku });
  } catch (error: any) {
    console.error('Print refurb ZPL error:', error);
    res.status(500).json({ error: error.message || 'Failed to print refurb label' });
  }
});

// ==================== CATCH-ALL FOR REACT ====================

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ==================== START SERVER ====================

async function start() {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    // Seed initial admin user if no users exist
    await seedAdminUser();

    // Seed QuickTestz equipment catalog and test profiles
    const seedResult = await seedEquipmentAndProfiles();
    if (seedResult.equipmentSeeded > 0 || seedResult.profilesSeeded > 0) {
      console.log(`[QuickTestz] Seeded ${seedResult.equipmentSeeded} equipment items, ${seedResult.profilesSeeded} test profiles`);
    }

    app.listen(PORT, () => {
      console.log(`QuickRefurbz API running on port ${PORT}`);
      console.log(`Frontend: http://localhost:${PORT}`);
      console.log(`QuickTestz API: http://localhost:${PORT}/api/test`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown: stop QuickTestz polling and monitoring
process.on('SIGTERM', () => {
  readingsCollector.stopAll();
  safetyMonitor.stopAll();
  process.exit(0);
});
process.on('SIGINT', () => {
  readingsCollector.stopAll();
  safetyMonitor.stopAll();
  process.exit(0);
});

start();

export default app;
