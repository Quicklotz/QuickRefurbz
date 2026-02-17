/**
 * QuickRefurbz - Express API Server
 * REST API for the refurbishment tracking system
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
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
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'quickrefurbz-dev-secret-change-in-production';

// Middleware

// -- CORS configuration --
const allowedOrigins = [
  'https://quickrefurbz.com',
  'https://www.quickrefurbz.com',
  'https://monitor.quickrefurbz.com',
  'https://docs.api.quickrefurbz.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);

    // In development, allow any localhost origin
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// -- Rate limiting --

// General rate limiter: 100 requests per minute per IP (authenticated endpoints)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Strict auth rate limiter: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Monitor rate limiter: 300 requests per minute per IP (auto-refresh dashboard)
const monitorLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Apply strict rate limiter to auth endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/accept-invite', authLimiter);

// Apply monitor rate limiter to monitor endpoints
app.use('/api/monitor', monitorLimiter);

// Apply general rate limiter to all /api routes
app.use('/api', generalLimiter);

app.use(express.json());

// Sanitize string input: strip HTML tags to prevent stored XSS
function sanitize(input: string | undefined | null): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '').trim();
}

// Serve static React frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ==================== API DOCS ====================
try {
  const openapiSpec = JSON.parse(readFileSync(path.join(__dirname, '../openapi.json'), 'utf8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'QuickRefurbz API Docs',
  }));
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.json(openapiSpec);
  });
} catch (e) {
  console.warn('OpenAPI spec not found, /api/docs will not be available');
}

// ==================== HEALTH CHECK ====================
// No auth required — used by external monitoring tools and CI/CD deploy verification

app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    const db = getPool();
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    version: '1.0.0',
  });
});

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

// Helper to get database user by ID (excludes password_hash from response)
async function getUserById(id: string, includePasswordHash = false) {
  const db = getPool();
  const result = await db.query(
    'SELECT * FROM users WHERE id::text = $1',
    [id]
  );
  const user = result.rows[0] || null;
  if (user && !includePasswordHash) {
    delete user.password_hash;
  }
  return user;
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

// Monitor auth middleware — accepts JWT OR X-Monitor-Token header
const MONITOR_SECRET = process.env.MONITOR_SECRET || '';

function monitorAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // Check X-Monitor-Token header first
  const monitorToken = req.headers['x-monitor-token'] as string | undefined;
  if (monitorToken && MONITOR_SECRET && monitorToken === MONITOR_SECRET) {
    // Set a synthetic admin user for monitor access
    req.user = { id: 'monitor', email: 'monitor@system', name: 'Monitor', role: 'admin' };
    next();
    return;
  }

  // Fall back to JWT auth
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
      next();
      return;
    } catch { /* fall through */ }
  }

  res.status(401).json({ error: 'Authentication required' });
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
        `UPDATE users SET password_hash = $1, is_active = true, email_verified = true, updated_at = now() WHERE id::text = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = now() WHERE id::text = $1`,
        [tokenData.id]
      );
    } else {
      await db.query(
        `UPDATE users SET password_hash = $1, is_active = 1, email_verified = 1, updated_at = datetime('now') WHERE id::text = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = datetime('now') WHERE id::text = $1`,
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
        `UPDATE users SET password_hash = $1, updated_at = now() WHERE id::text = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = now() WHERE id::text = $1`,
        [tokenData.id]
      );
    } else {
      await db.query(
        `UPDATE users SET password_hash = $1, updated_at = datetime('now') WHERE id::text = $2`,
        [passwordHash, tokenData.user_id]
      );
      await db.query(
        `UPDATE auth_tokens SET used_at = datetime('now') WHERE id::text = $1`,
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
    const { email, role } = req.body;
    const name = sanitize(req.body.name);

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
    const { role, is_active } = req.body;
    const name = req.body.name !== undefined ? sanitize(req.body.name) : undefined;

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
      `UPDATE users SET ${updates.join(', ')} WHERE id::text = $${paramIndex}`,
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
        `UPDATE users SET is_active = false, updated_at = now() WHERE id::text = $1`,
        [userId]
      );
    } else {
      await db.query(
        `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id::text = $1`,
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
        `UPDATE auth_tokens SET used_at = now() WHERE user_id::text = $1 AND type = 'invite' AND used_at IS NULL`,
        [userId]
      );
    } else {
      await db.query(
        `UPDATE auth_tokens SET used_at = datetime('now') WHERE user_id::text = $1 AND type = 'invite' AND used_at IS NULL`,
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
    const body = { ...req.body };
    // Default liquidationSource if not provided
    if (!body.liquidationSource) {
      body.liquidationSource = 'DIRECT';
    }
    const pallet = await palletManager.createPallet(body);
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
    if (limit) {
      const parsedLimit = parseInt(limit);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return res.status(400).json({ error: 'limit must be a positive integer' });
      }
      options.limit = Math.min(parsedLimit, 1000);
    }

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
      employeeId: req.body.employeeId || req.user?.id || 'system',
      warehouseId: req.body.warehouseId || req.body.warehouse_id || 'WH-001'
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
    // Map frontend field names to AddPartOptions interface
    const body = req.body;
    const part = await partsInventory.addPart({
      partNumber: body.partNumber || body.sku || body.rfbSku || body.part_number || `RFB-${Date.now()}`,
      name: body.name,
      description: body.description,
      category: body.category,
      compatibleCategories: body.compatibleCategories || body.compatible_categories,
      compatibleManufacturers: body.compatibleManufacturers || body.compatible_manufacturers || body.compatible_devices,
      quantityOnHand: body.quantityOnHand ?? body.quantity_on_hand ?? body.quantity ?? 0,
      reorderPoint: body.reorderPoint ?? body.reorder_point ?? body.min_quantity ?? 5,
      reorderQuantity: body.reorderQuantity ?? body.reorder_quantity ?? 10,
      unitCost: body.unitCost ?? body.unit_cost ?? body.cost ?? 0,
      location: body.location,
    });
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

// Get parts usage for an item
app.get('/api/items/:qlid/parts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const usage = await partsInventory.getPartsUsageForItem(qlid);
    res.json(usage);
  } catch (error) {
    console.error('Get parts usage error:', error);
    res.status(500).json({ error: 'Failed to get parts usage' });
  }
});

// Use parts for an item
app.post('/api/items/:qlid/parts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const { parts, ticketId } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'Parts array is required' });
    }

    const usage = await partsInventory.useParts({
      identifier: qlid,
      ticketId,
      parts,
      technicianId: req.user?.id || 'unknown'
    });

    // Calculate total cost
    const totalCost = usage.reduce((sum, u) => sum + u.totalCost, 0);

    res.json({
      usage,
      totalCost,
      partsCount: usage.length
    });
  } catch (error: any) {
    console.error('Use parts error:', error);
    res.status(400).json({ error: error.message || 'Failed to use parts' });
  }
});

// Get parts compatible with a category
app.get('/api/parts/compatible/:category', authMiddleware, async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;
    const parts = await partsInventory.listParts({ compatibleWith: category as any });
    res.json(parts);
  } catch (error) {
    console.error('Get compatible parts error:', error);
    res.status(500).json({ error: 'Failed to get compatible parts' });
  }
});

// Get parts stats
app.get('/api/parts/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await partsInventory.getPartsStats();
    res.json(stats);
  } catch (error) {
    console.error('Get parts stats error:', error);
    res.status(500).json({ error: 'Failed to get parts stats' });
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
      try {
        settings[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      } catch {
        settings[row.key] = row.value;
      }
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

// ==================== UPC LOOKUP API ====================

import * as upcLookupService from './services/upcLookupService.js';

// Static routes MUST come before parameterized /:upc route

// Search cached UPCs
app.get('/api/upc/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const query = queryString(req.query.q) || '';
    const limit = parseInt(queryString(req.query.limit) || '20');

    const results = await upcLookupService.searchCachedUPCs(query, limit);

    res.json(results);
  } catch (error) {
    console.error('UPC search error:', error);
    res.status(500).json({ error: 'Failed to search UPCs' });
  }
});

// Get UPC cache stats
app.get('/api/upc/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await upcLookupService.getUPCCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('UPC stats error:', error);
    res.status(500).json({ error: 'Failed to get UPC stats' });
  }
});

// Manually add UPC data
app.post('/api/upc/manual', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { upc, brand, model, title, category, msrp, imageUrl } = req.body;

    if (!upc) {
      return res.status(400).json({ error: 'UPC is required' });
    }

    const result = await upcLookupService.addManualUPC({
      upc,
      brand,
      model,
      title,
      category,
      msrp,
      imageUrl
    });

    res.json(result);
  } catch (error) {
    console.error('Manual UPC add error:', error);
    res.status(500).json({ error: 'Failed to add UPC data' });
  }
});

// Look up product by UPC (parameterized — must be last)
app.get('/api/upc/:upc', authMiddleware, async (req: Request, res: Response) => {
  try {
    const upc = req.params.upc as string;

    if (!upc || upc.length < 8) {
      return res.status(400).json({ error: 'Invalid UPC format' });
    }

    const result = await upcLookupService.lookupUPC(upc);

    if (!result) {
      return res.status(404).json({ error: 'UPC not found', upc });
    }

    res.json(result);
  } catch (error) {
    console.error('UPC lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup UPC' });
  }
});

// ==================== PHOTO API ====================

import multer from 'multer';
import * as photoService from './services/photoService.js';

// Configure multer for memory storage
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10 // Max 10 files per request
  },
  fileFilter: (_req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload photos for an item
app.post('/api/photos/:qlid', authMiddleware, photoUpload.array('photos', 10), async (req: AuthRequest, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const { stage, photoType, caption } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const validStages = ['INTAKE', 'TESTING', 'REPAIR', 'CLEANING', 'FINAL_QC', 'COMPLETE'];
    const validTypes = ['INTAKE', 'DEFECT', 'REPAIR', 'SERIAL', 'FINAL', 'BEFORE', 'AFTER'];

    if (!stage || !validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid or missing stage' });
    }

    if (!photoType || !validTypes.includes(photoType)) {
      return res.status(400).json({ error: 'Invalid or missing photoType' });
    }

    const uploadedPhotos = [];
    for (const file of files) {
      const photo = await photoService.uploadPhoto({
        qlid,
        stage: stage as photoService.PhotoStage,
        photoType: photoType as photoService.PhotoType,
        buffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
        capturedBy: req.user?.id,
        caption
      });
      uploadedPhotos.push(photo);
    }

    res.json({ photos: uploadedPhotos, count: uploadedPhotos.length });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// Get all photos for an item
app.get('/api/photos/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const stage = queryString(req.query.stage);

    let photos;
    if (stage) {
      photos = await photoService.getPhotosByStage(qlid, stage as photoService.PhotoStage);
    } else {
      photos = await photoService.getPhotosForItem(qlid);
    }

    res.json(photos);
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

// Get photo file content
app.get('/api/photos/file/:photoId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const photoId = req.params.photoId as string;
    const result = await photoService.getPhotoFile(photoId);

    if (!result) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.set('Content-Type', result.mimeType);
    res.send(result.buffer);
  } catch (error) {
    console.error('Get photo file error:', error);
    res.status(500).json({ error: 'Failed to get photo file' });
  }
});

// Get photo count for an item
app.get('/api/photos/:qlid/count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const count = await photoService.getPhotoCount(qlid);
    res.json(count);
  } catch (error) {
    console.error('Get photo count error:', error);
    res.status(500).json({ error: 'Failed to get photo count' });
  }
});

// Update photo caption
app.patch('/api/photos/file/:photoId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const photoId = req.params.photoId as string;
    const { caption } = req.body;

    const photo = await photoService.updatePhotoCaption(photoId, caption);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json(photo);
  } catch (error) {
    console.error('Update photo error:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// Delete a photo
app.delete('/api/photos/file/:photoId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const photoId = req.params.photoId as string;
    const deleted = await photoService.deletePhoto(photoId);

    if (!deleted) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ==================== GRADING API ====================

import * as gradingService from './services/gradingService.js';

// Get grading rubric for a category
app.get('/api/grading/rubric/:category', authMiddleware, async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;
    const rubric = await gradingService.getRubric(category);

    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    res.json(rubric);
  } catch (error) {
    console.error('Get rubric error:', error);
    res.status(500).json({ error: 'Failed to get rubric' });
  }
});

// Get all rubrics
app.get('/api/grading/rubrics', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const rubrics = await gradingService.getAllRubrics();
    res.json(rubrics);
  } catch (error) {
    console.error('Get all rubrics error:', error);
    res.status(500).json({ error: 'Failed to get rubrics' });
  }
});

// Create grading assessment
app.post('/api/grading/assess', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { qlid, category, criteriaResults, gradeOverride } = req.body;

    if (!qlid || !category || !criteriaResults) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const assessment = await gradingService.createAssessment({
      qlid,
      category,
      criteriaResults,
      assessedBy: req.user?.id || 'unknown',
      gradeOverride
    });

    res.json(assessment);
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// Get assessment for an item
app.get('/api/grading/assessment/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const assessment = await gradingService.getAssessment(qlid);

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json(assessment);
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Failed to get assessment' });
  }
});

// Get assessment history for an item
app.get('/api/grading/history/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const history = await gradingService.getAssessmentHistory(qlid);
    res.json(history);
  } catch (error) {
    console.error('Get assessment history error:', error);
    res.status(500).json({ error: 'Failed to get assessment history' });
  }
});

// Get grading statistics
app.get('/api/grading/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await gradingService.getGradeStats();
    res.json(stats);
  } catch (error) {
    console.error('Get grading stats error:', error);
    res.status(500).json({ error: 'Failed to get grading stats' });
  }
});

// ==================== COST TRACKING API ====================

import * as costTracker from './services/costTracker.js';

// Record labor entry
app.post('/api/costs/labor', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { qlid, taskDescription, minutesSpent, hourlyRate } = req.body;

    if (!qlid || !taskDescription || !minutesSpent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const labor = await costTracker.recordLabor({
      qlid,
      technicianId: req.user?.id || 'unknown',
      taskDescription,
      minutesSpent,
      hourlyRate
    });

    res.json(labor);
  } catch (error) {
    console.error('Record labor error:', error);
    res.status(500).json({ error: 'Failed to record labor' });
  }
});

// Get labor entries for an item
app.get('/api/costs/labor/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const labor = await costTracker.getLaborForItem(qlid);
    res.json(labor);
  } catch (error) {
    console.error('Get labor error:', error);
    res.status(500).json({ error: 'Failed to get labor entries' });
  }
});

// Calculate/recalculate costs for an item
app.post('/api/costs/calculate/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const { unitCogs } = req.body;

    const costs = await costTracker.calculateCosts(qlid, unitCogs || 0);
    res.json(costs);
  } catch (error) {
    console.error('Calculate costs error:', error);
    res.status(500).json({ error: 'Failed to calculate costs' });
  }
});

// Get cost breakdown for an item
app.get('/api/costs/breakdown/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const breakdown = await costTracker.getCostBreakdown(qlid);

    if (!breakdown) {
      return res.status(404).json({ error: 'Cost data not found' });
    }

    res.json(breakdown);
  } catch (error) {
    console.error('Get cost breakdown error:', error);
    res.status(500).json({ error: 'Failed to get cost breakdown' });
  }
});

// Get cost summary for an item
app.get('/api/costs/summary/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const summary = await costTracker.getCostSummary(qlid);

    if (!summary) {
      // Return empty cost structure if not calculated yet
      res.json({
        qlid,
        unitCogs: 0,
        partsCost: 0,
        laborCost: 0,
        overheadCost: 0,
        totalCost: 0,
        estimatedValue: null,
        profitMargin: null,
        calculatedAt: null
      });
      return;
    }

    res.json(summary);
  } catch (error) {
    console.error('Get cost summary error:', error);
    res.status(500).json({ error: 'Failed to get cost summary' });
  }
});

// Set unit COGS for an item
app.post('/api/costs/cogs/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const { unitCogs } = req.body;

    if (unitCogs === undefined || unitCogs < 0) {
      return res.status(400).json({ error: 'Valid unitCogs is required' });
    }

    const costs = await costTracker.setUnitCogs(qlid, unitCogs);
    res.json(costs);
  } catch (error) {
    console.error('Set COGS error:', error);
    res.status(500).json({ error: 'Failed to set COGS' });
  }
});

// Set estimated value for an item
app.post('/api/costs/value/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const { estimatedValue } = req.body;

    if (estimatedValue === undefined || estimatedValue < 0) {
      return res.status(400).json({ error: 'Valid estimatedValue is required' });
    }

    await costTracker.setEstimatedValue(qlid, estimatedValue);
    const summary = await costTracker.getCostSummary(qlid);
    res.json(summary);
  } catch (error) {
    console.error('Set estimated value error:', error);
    res.status(500).json({ error: 'Failed to set estimated value' });
  }
});

// Get cost statistics
app.get('/api/costs/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await costTracker.getCostStats();
    res.json(stats);
  } catch (error) {
    console.error('Get cost stats error:', error);
    res.status(500).json({ error: 'Failed to get cost stats' });
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

    const result = await db.query('SELECT * FROM data_wipe_reports WHERE id::text = $1', [id]);
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
         WHERE id::text = $6`,
        [status || 'COMPLETED', req.user?.id, verificationMethod, certDataJson, notes, id]
      );
    } else {
      await db.query(
        `UPDATE data_wipe_reports
         SET wipe_status = $1, completed_at = datetime('now'), verified_at = datetime('now'),
             verified_by = $2, verification_method = $3, certificate_data = $4, notes = COALESCE($5, notes)
         WHERE id::text = $6`,
        [status || 'COMPLETED', req.user?.id, verificationMethod, certDataJson, notes, id]
      );
    }

    const result = await db.query('SELECT * FROM data_wipe_reports WHERE id::text = $1', [id]);
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

    const result = await db.query('SELECT * FROM parts_suppliers WHERE id::text = $1', [id]);
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
    const supplierResult = await db.query('SELECT * FROM parts_suppliers WHERE id::text = $1', [supplierId]);
    if (supplierResult.rows.length === 0) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    const supplier = supplierResult.rows[0];

    // TODO: Implement actual API sync logic based on supplier.api_url and supplier.api_key
    // For now, just update last_sync timestamp

    if (dbType === 'postgres') {
      await db.query(
        'UPDATE parts_suppliers SET last_sync = now() WHERE id::text = $1',
        [supplierId]
      );
    } else {
      await db.query(
        'UPDATE parts_suppliers SET last_sync = datetime(\'now\') WHERE id::text = $1',
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
          partNumber: partData.partNumber || partData.sku || partData.rfbSku || partData.part_number || `RFB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: partData.name,
          description: partData.description,
          category: partData.category,
          compatibleCategories: partData.compatibleCategories || partData.compatible_categories,
          compatibleManufacturers: partData.compatibleManufacturers || partData.compatible_manufacturers || partData.compatible_devices,
          quantityOnHand: partData.quantityOnHand ?? partData.quantity_on_hand ?? partData.quantity ?? 0,
          reorderPoint: partData.reorderPoint ?? partData.reorder_point ?? partData.min_quantity ?? 5,
          reorderQuantity: partData.reorderQuantity ?? partData.reorder_quantity ?? 10,
          unitCost: partData.unitCost ?? partData.unit_cost ?? partData.cost ?? 0,
          location: partData.location,
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
      `SELECT * FROM work_sessions WHERE user_id::text = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
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
        'UPDATE work_sessions SET ended_at = now() WHERE user_id::text = $1 AND ended_at IS NULL',
        [userId]
      );
    } else {
      await db.query(
        'UPDATE work_sessions SET ended_at = datetime(\'now\') WHERE user_id::text = $1 AND ended_at IS NULL',
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

    const result = await db.query('SELECT * FROM work_sessions WHERE id::text = $1', [id]);
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
        'UPDATE work_sessions SET ended_at = now() WHERE user_id::text = $1 AND ended_at IS NULL',
        [userId]
      );
    } else {
      await db.query(
        'UPDATE work_sessions SET ended_at = datetime(\'now\') WHERE user_id::text = $1 AND ended_at IS NULL',
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
import { discoverPrinters, checkPrinterStatus, getPrinterLabelSize } from './printerDiscovery.js';
import * as certificateGenerator from './services/certificateGenerator.js';
import * as batchExporter from './services/batchExporter.js';
import * as dataFeedService from './services/dataFeedService.js';

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

// ==================== PRINTER MANAGEMENT ====================

// Discover printers on the network
app.get('/api/printers/discover', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const subnet = req.query.subnet as string | undefined;
    const printers = await discoverPrinters(subnet);
    res.json({ printers });
  } catch (err: any) {
    console.error('Printer discovery error:', err);
    res.status(500).json({ error: 'Printer discovery failed', details: err.message });
  }
});

// Check single printer status
app.get('/api/printers/status/:ip', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const status = await checkPrinterStatus(req.params.ip as string);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check printer status', details: err.message });
  }
});

// Get saved printer settings for current user
app.get('/api/printers/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT * FROM printer_settings WHERE user_id::text = $1 ORDER BY is_default DESC, updated_at DESC`,
      [req.user!.id]
    );
    res.json({ printers: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get printer settings', details: err.message });
  }
});

// Save printer settings
app.post('/api/printers/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { printer_ip, printer_name, printer_model, label_width_mm, label_height_mm, print_density_dpi, station_id, is_default } = req.body;

    if (!printer_ip) {
      return res.status(400).json({ error: 'printer_ip is required' });
    }

    const db = getPool();

    // If setting as default, unset other defaults for this user
    if (is_default !== false) {
      await db.query(
        `UPDATE printer_settings SET is_default = false WHERE user_id::text = $1`,
        [req.user!.id]
      );
    }

    // Upsert by user + printer IP
    const existing = await db.query(
      `SELECT id FROM printer_settings WHERE user_id::text = $1 AND printer_ip = $2`,
      [req.user!.id, printer_ip]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE printer_settings SET
          printer_name = $1, printer_model = $2, label_width_mm = $3, label_height_mm = $4,
          print_density_dpi = $5, station_id = $6, is_default = $7, updated_at = NOW()
        WHERE id = $8 RETURNING *`,
        [printer_name || null, printer_model || null, label_width_mm || 50.8, label_height_mm || 25.4,
         print_density_dpi || 203, station_id || null, is_default !== false, existing.rows[0].id]
      );
    } else {
      result = await db.query(
        `INSERT INTO printer_settings (user_id, station_id, printer_ip, printer_name, printer_model, label_width_mm, label_height_mm, print_density_dpi, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.user!.id, station_id || null, printer_ip, printer_name || null, printer_model || null,
         label_width_mm || 50.8, label_height_mm || 25.4, print_density_dpi || 203, is_default !== false]
      );
    }

    res.json({ printer: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save printer settings', details: err.message });
  }
});

// Delete printer settings
app.delete('/api/printers/settings/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    await db.query(
      `DELETE FROM printer_settings WHERE id::text = $1 AND user_id::text = $2`,
      [req.params.id, req.user!.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete printer settings', details: err.message });
  }
});

// Test print - send a test label to a printer
app.post('/api/printers/test', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { printer_ip, label_width_mm, label_height_mm } = req.body;

    if (!printer_ip) {
      return res.status(400).json({ error: 'printer_ip is required' });
    }

    const dpi = 203;
    const widthDots = Math.round(((label_width_mm || 50.8) / 25.4) * dpi);
    const heightDots = Math.round(((label_height_mm || 25.4) / 25.4) * dpi);

    // Generate a test label ZPL
    const testZpl = `
^XA
^FO${Math.round(widthDots * 0.05)},${Math.round(heightDots * 0.1)}^A0N,${Math.round(heightDots * 0.15)},${Math.round(widthDots * 0.06)}^FDQuickRefurbz^FS
^FO${Math.round(widthDots * 0.05)},${Math.round(heightDots * 0.35)}^A0N,${Math.round(heightDots * 0.1)},${Math.round(widthDots * 0.04)}^FDTest Label^FS
^FO${Math.round(widthDots * 0.05)},${Math.round(heightDots * 0.55)}^A0N,${Math.round(heightDots * 0.08)},${Math.round(widthDots * 0.03)}^FD${new Date().toISOString().slice(0, 19)}^FS
^FO${Math.round(widthDots * 0.05)},${Math.round(heightDots * 0.75)}^A0N,${Math.round(heightDots * 0.08)},${Math.round(widthDots * 0.03)}^FDSize: ${label_width_mm || 50.8}mm x ${label_height_mm || 25.4}mm^FS
^XZ
`.trim();

    await labelGenerator.sendZplToPrinter(printer_ip, testZpl);
    res.json({ ok: true, message: 'Test label sent' });
  } catch (err: any) {
    res.status(500).json({ error: 'Test print failed', details: err.message });
  }
});

// Get printer label size from printer
app.get('/api/printers/label-size/:ip', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const labelSize = await getPrinterLabelSize(req.params.ip as string);
    res.json(labelSize);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get label size', details: err.message });
  }
});

// Get label presets
app.get('/api/printers/label-presets', authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.json({ presets: labelGenerator.LABEL_PRESETS });
});

// ==================== DATA WIPE CERTIFICATES API ====================

// Create a new data wipe certificate
app.post('/api/certificates', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      qlid,
      deviceInfo,
      wipeMethod,
      wipeStartedAt,
      wipeCompletedAt,
      verificationMethod,
      verificationPassed,
      notes
    } = req.body;

    if (!qlid || !deviceInfo || !wipeMethod || !wipeStartedAt || !wipeCompletedAt || !verificationMethod) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const certificate = await certificateGenerator.createCertificate({
      qlid,
      deviceInfo,
      wipeMethod,
      wipeStartedAt,
      wipeCompletedAt,
      verificationMethod,
      verificationPassed: verificationPassed ?? true,
      technicianId: req.user?.id || 'unknown',
      notes
    });

    res.status(201).json(certificate);
  } catch (error) {
    console.error('Create certificate error:', error);
    res.status(500).json({ error: 'Failed to create certificate' });
  }
});

// Get certificate by ID or certificate number
app.get('/api/certificates/:identifier', async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier as string;
    const certificate = await certificateGenerator.getCertificate(identifier);

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    res.json(certificate);
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({ error: 'Failed to get certificate' });
  }
});

// Get certificate for a specific QLID
app.get('/api/certificates/item/:qlid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const certificate = await certificateGenerator.getCertificateForItem(qlid);

    if (!certificate) {
      res.status(404).json({ error: 'No certificate found for this item' });
      return;
    }

    res.json(certificate);
  } catch (error) {
    console.error('Get item certificate error:', error);
    res.status(500).json({ error: 'Failed to get certificate' });
  }
});

// Verify a certificate
app.post('/api/certificates/verify', async (req: Request, res: Response) => {
  try {
    const { certificateNumber, verificationCode } = req.body;

    if (!certificateNumber || !verificationCode) {
      res.status(400).json({ error: 'Certificate number and verification code required' });
      return;
    }

    const result = await certificateGenerator.verifyCertificate(certificateNumber, verificationCode);
    res.json(result);
  } catch (error) {
    console.error('Verify certificate error:', error);
    res.status(500).json({ error: 'Failed to verify certificate' });
  }
});

// Get certificate as text (for printing/display)
app.get('/api/certificates/:identifier/text', async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier as string;
    const certificate = await certificateGenerator.getCertificate(identifier);

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    const text = certificateGenerator.generateCertificateText(certificate);
    res.setHeader('Content-Type', 'text/plain');
    res.send(text);
  } catch (error) {
    console.error('Get certificate text error:', error);
    res.status(500).json({ error: 'Failed to generate certificate text' });
  }
});

// Get certificate content (for PDF generation)
app.get('/api/certificates/:identifier/content', async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier as string;
    const certificate = await certificateGenerator.getCertificate(identifier);

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    const content = certificateGenerator.generateCertificateContent(certificate);
    res.json({ certificate, content });
  } catch (error) {
    console.error('Get certificate content error:', error);
    res.status(500).json({ error: 'Failed to generate certificate content' });
  }
});

// List certificates with optional filtering
app.get('/api/certificates', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(queryString(req.query.limit) || '50') : undefined;
    const wipeMethod = queryString(req.query.wipeMethod) as certificateGenerator.WipeMethod | undefined;

    const certificates = await certificateGenerator.listCertificates({ limit, wipeMethod });
    res.json(certificates);
  } catch (error) {
    console.error('List certificates error:', error);
    res.status(500).json({ error: 'Failed to list certificates' });
  }
});

// Get certificate statistics
app.get('/api/certificates/stats/summary', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await certificateGenerator.getCertificateStats();
    res.json(stats);
  } catch (error) {
    console.error('Get certificate stats error:', error);
    res.status(500).json({ error: 'Failed to get certificate stats' });
  }
});

// ==================== BATCH EXPORT API ====================

// Export data to CSV/XLSX in batches of 50
app.post('/api/exports', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, format, batchSize, filters } = req.body;

    if (!type || !format) {
      res.status(400).json({ error: 'Type and format are required' });
      return;
    }

    const validTypes = ['items', 'pallets', 'certificates', 'grading', 'parts_usage', 'labor', 'costs', 'full_report'];
    const validFormats = ['csv', 'xlsx'];

    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }

    if (!validFormats.includes(format)) {
      res.status(400).json({ error: 'Invalid format. Must be csv or xlsx' });
      return;
    }

    let result;
    if (type === 'full_report') {
      result = await batchExporter.exportFullReport({
        format: format as batchExporter.ExportFormat,
        batchSize: batchSize || 50,
        filters
      });
    } else {
      result = await batchExporter.exportBatch({
        type: type as batchExporter.ExportType,
        format: format as batchExporter.ExportFormat,
        batchSize: batchSize || 50,
        filters
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// List available exports
app.get('/api/exports', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const exports = await batchExporter.listExports();
    res.json(exports);
  } catch (error) {
    console.error('List exports error:', error);
    res.status(500).json({ error: 'Failed to list exports' });
  }
});

// Get files in an export
app.get('/api/exports/:exportName/files', authMiddleware, async (req: Request, res: Response) => {
  try {
    const exportName = req.params.exportName as string;
    const files = await batchExporter.getExportFiles(exportName);
    res.json(files);
  } catch (error) {
    console.error('Get export files error:', error);
    res.status(500).json({ error: 'Failed to get export files' });
  }
});

// Download an export file
app.get('/api/exports/download/:exportName/:filename', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { exportName, filename } = req.params;
    const files = await batchExporter.getExportFiles(exportName as string);
    const filepath = files.find(f => f.endsWith(filename as string));

    if (!filepath) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(filepath);
  } catch (error) {
    console.error('Download export error:', error);
    res.status(500).json({ error: 'Failed to download export' });
  }
});

// Delete an export
app.delete('/api/exports/:exportName', authMiddleware, async (req: Request, res: Response) => {
  try {
    const exportName = req.params.exportName as string;
    const deleted = await batchExporter.deleteExport(exportName);

    if (!deleted) {
      res.status(404).json({ error: 'Export not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete export error:', error);
    res.status(500).json({ error: 'Failed to delete export' });
  }
});

// Get export statistics
app.get('/api/exports/stats/summary', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await batchExporter.getExportStats();
    res.json(stats);
  } catch (error) {
    console.error('Get export stats error:', error);
    res.status(500).json({ error: 'Failed to get export stats' });
  }
});

// ==================== DATA FEED & WEBHOOK API ====================

// Create webhook subscription
app.post('/api/webhooks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, url, events, format, headers } = req.body;

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'Name, URL, and at least one event are required' });
      return;
    }

    const validEvents = ['item.created', 'item.updated', 'item.completed', 'item.graded', 'item.certified', 'pallet.created', 'pallet.completed', 'inventory.low'];
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}. Valid: ${validEvents.join(', ')}` });
      return;
    }

    const webhook = await dataFeedService.createWebhook({ name, url, events, format, headers });
    res.status(201).json(webhook);
  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// List webhooks
app.get('/api/webhooks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const activeOnly = queryString(req.query.activeOnly) === 'true';
    const webhooks = await dataFeedService.listWebhooks(activeOnly);
    res.json(webhooks);
  } catch (error) {
    console.error('List webhooks error:', error);
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// Get webhook by ID
app.get('/api/webhooks/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const webhook = await dataFeedService.getWebhook(id);

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json(webhook);
  } catch (error) {
    console.error('Get webhook error:', error);
    res.status(500).json({ error: 'Failed to get webhook' });
  }
});

// Update webhook
app.patch('/api/webhooks/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, url, events, format, headers, isActive } = req.body;

    const webhook = await dataFeedService.updateWebhook(id, { name, url, events, format, headers, isActive });

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json(webhook);
  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete webhook
app.delete('/api/webhooks/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await dataFeedService.deleteWebhook(id);

    if (!deleted) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete webhook error:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Regenerate webhook secret
app.post('/api/webhooks/:id/regenerate-secret', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const newSecret = await dataFeedService.regenerateWebhookSecret(id);

    if (!newSecret) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json({ secret: newSecret });
  } catch (error) {
    console.error('Regenerate secret error:', error);
    res.status(500).json({ error: 'Failed to regenerate secret' });
  }
});

// Test webhook (trigger a test delivery)
app.post('/api/webhooks/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const webhook = await dataFeedService.getWebhook(id);

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    // Trigger a test event
    await dataFeedService.triggerWebhooks('item.updated', {
      qlid: 'TEST-QLID-001',
      test: true,
      message: 'This is a test webhook delivery from QuickRefurbz'
    });

    res.json({ success: true, message: 'Test webhook triggered' });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// Process pending webhook retries (can be called by cron job)
app.post('/api/webhooks/process-retries', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const processed = await dataFeedService.processWebhookRetries();
    res.json({ processed });
  } catch (error) {
    console.error('Process retries error:', error);
    res.status(500).json({ error: 'Failed to process retries' });
  }
});

// ==================== PRODUCT FEED API ====================

// Get product feed (supports multiple formats)
app.get('/api/feed/products', async (req: Request, res: Response) => {
  try {
    const format = (queryString(req.query.format) || 'json') as dataFeedService.FeedFormat;
    const filters: dataFeedService.FeedFilters = {
      since: queryString(req.query.since),
      until: queryString(req.query.until),
      status: queryString(req.query.status),
      grade: queryString(req.query.grade),
      category: queryString(req.query.category),
      palletId: queryString(req.query.palletId),
      limit: req.query.limit ? parseInt(queryString(req.query.limit) || '100') : 100,
      offset: req.query.offset ? parseInt(queryString(req.query.offset) || '0') : 0,
      includeImages: queryString(req.query.includeImages) !== 'false'
    };

    const { data, contentType } = await dataFeedService.getFormattedFeed(format, filters);

    res.setHeader('Content-Type', contentType);
    if (typeof data === 'string') {
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to get product feed' });
  }
});

// Get Shopify-formatted feed
app.get('/api/feed/shopify', async (req: Request, res: Response) => {
  try {
    const filters: dataFeedService.FeedFilters = {
      since: queryString(req.query.since),
      status: queryString(req.query.status) || 'COMPLETE', // Default to completed items
      grade: queryString(req.query.grade),
      category: queryString(req.query.category),
      limit: req.query.limit ? parseInt(queryString(req.query.limit) || '100') : 100,
      offset: req.query.offset ? parseInt(queryString(req.query.offset) || '0') : 0
    };

    const { data } = await dataFeedService.getFormattedFeed('shopify', filters);
    res.json(data);
  } catch (error) {
    console.error('Get Shopify feed error:', error);
    res.status(500).json({ error: 'Failed to get Shopify feed' });
  }
});

// Get eBay-formatted feed
app.get('/api/feed/ebay', async (req: Request, res: Response) => {
  try {
    const filters: dataFeedService.FeedFilters = {
      since: queryString(req.query.since),
      status: queryString(req.query.status) || 'COMPLETE',
      grade: queryString(req.query.grade),
      category: queryString(req.query.category),
      limit: req.query.limit ? parseInt(queryString(req.query.limit) || '100') : 100,
      offset: req.query.offset ? parseInt(queryString(req.query.offset) || '0') : 0
    };

    const { data } = await dataFeedService.getFormattedFeed('ebay', filters);
    res.json(data);
  } catch (error) {
    console.error('Get eBay feed error:', error);
    res.status(500).json({ error: 'Failed to get eBay feed' });
  }
});

// Get CSV feed
app.get('/api/feed/csv', async (req: Request, res: Response) => {
  try {
    const filters: dataFeedService.FeedFilters = {
      since: queryString(req.query.since),
      status: queryString(req.query.status),
      grade: queryString(req.query.grade),
      category: queryString(req.query.category),
      limit: req.query.limit ? parseInt(queryString(req.query.limit) || '1000') : 1000,
      offset: req.query.offset ? parseInt(queryString(req.query.offset) || '0') : 0
    };

    const { data, contentType } = await dataFeedService.getFormattedFeed('csv', filters);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="quickrefurbz-products.csv"');
    res.send(data);
  } catch (error) {
    console.error('Get CSV feed error:', error);
    res.status(500).json({ error: 'Failed to get CSV feed' });
  }
});

// Get XML feed
app.get('/api/feed/xml', async (req: Request, res: Response) => {
  try {
    const filters: dataFeedService.FeedFilters = {
      since: queryString(req.query.since),
      status: queryString(req.query.status),
      grade: queryString(req.query.grade),
      category: queryString(req.query.category),
      limit: req.query.limit ? parseInt(queryString(req.query.limit) || '1000') : 1000,
      offset: req.query.offset ? parseInt(queryString(req.query.offset) || '0') : 0
    };

    const { data, contentType } = await dataFeedService.getFormattedFeed('xml', filters);

    res.setHeader('Content-Type', contentType);
    res.send(data);
  } catch (error) {
    console.error('Get XML feed error:', error);
    res.status(500).json({ error: 'Failed to get XML feed' });
  }
});

// Get single product by QLID
app.get('/api/feed/products/:qlid', async (req: Request, res: Response) => {
  try {
    const qlid = req.params.qlid as string;
    const item = await dataFeedService.getFeedItem(qlid);

    if (!item) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(item);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// Get feed statistics
app.get('/api/feed/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await dataFeedService.getFeedStats();
    res.json(stats);
  } catch (error) {
    console.error('Get feed stats error:', error);
    res.status(500).json({ error: 'Failed to get feed stats' });
  }
});

// ==================== MONITORING API ====================

import * as monitoringService from './services/monitoringService.js';

// Connected SSE clients for real-time updates
const sseClients: Set<Response> = new Set();

// Server-Sent Events endpoint for real-time monitoring
app.get('/api/monitor/stream', (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Add to clients set
  sseClients.add(res);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Subscribe to monitoring events and broadcast to SSE clients
monitoringService.monitoringEvents.on('update', (update: monitoringService.LiveUpdate) => {
  const message = `data: ${JSON.stringify(update)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (err) {
      // Client disconnected, remove from set
      sseClients.delete(client);
    }
  });
});

// Get full dashboard stats
app.get('/api/monitor/dashboard', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await monitoringService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// Get overview stats only
app.get('/api/monitor/overview', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const overview = await monitoringService.getOverviewStats();
    res.json(overview);
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

// Get stage distribution
app.get('/api/monitor/stages', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const stages = await monitoringService.getStageDistribution();
    res.json(stages);
  } catch (error) {
    console.error('Get stages error:', error);
    res.status(500).json({ error: 'Failed to get stage distribution' });
  }
});

// Get throughput data
app.get('/api/monitor/throughput', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const throughput = await monitoringService.getThroughputData();
    res.json(throughput);
  } catch (error) {
    console.error('Get throughput error:', error);
    res.status(500).json({ error: 'Failed to get throughput data' });
  }
});

// Get technician stats
app.get('/api/monitor/technicians', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const technicians = await monitoringService.getTechnicianStats();
    res.json(technicians);
  } catch (error) {
    console.error('Get technician stats error:', error);
    res.status(500).json({ error: 'Failed to get technician stats' });
  }
});

// Get grade distribution
app.get('/api/monitor/grades', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const grades = await monitoringService.getGradeDistribution();
    res.json(grades);
  } catch (error) {
    console.error('Get grade distribution error:', error);
    res.status(500).json({ error: 'Failed to get grade distribution' });
  }
});

// Get active alerts
app.get('/api/monitor/alerts', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const alerts = await monitoringService.getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get recent activity feed
app.get('/api/monitor/activity', monitorAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(queryString(req.query.limit) || '50') : 50;
    const activity = await monitoringService.getRecentActivity(limit);
    res.json(activity);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

// Get productivity report for date range
app.get('/api/monitor/reports/productivity', monitorAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const startDate = queryString(req.query.startDate);
    const endDate = queryString(req.query.endDate);

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'startDate and endDate are required' });
      return;
    }

    const report = await monitoringService.getProductivityReport(startDate, endDate);
    res.json(report);
  } catch (error) {
    console.error('Get productivity report error:', error);
    res.status(500).json({ error: 'Failed to get productivity report' });
  }
});

// Get inventory health report
app.get('/api/monitor/reports/inventory', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const health = await monitoringService.getInventoryHealth();
    res.json(health);
  } catch (error) {
    console.error('Get inventory health error:', error);
    res.status(500).json({ error: 'Failed to get inventory health' });
  }
});

// Get SSE client count (for monitoring)
app.get('/api/monitor/clients', monitorAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ connectedClients: sseClients.size });
});

// Get station statuses (monitor-accessible version of admin/stations)
app.get('/api/monitor/stations', monitorAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const db = getPool();

    const usersResult = await db.query<Record<string, unknown>>(
      `SELECT id, email, name, is_active, created_at FROM users
       WHERE email LIKE '%@quickrefurbz.local' ORDER BY email`
    );

    const stations = [];
    for (const user of usersResult.rows) {
      const stationNum = (user.email as string).match(/station(\d+)/)?.[1] || '??';
      const stationId = `RFB-${stationNum}`;

      const hbResult = await db.query<Record<string, unknown>>(
        `SELECT metadata, created_at FROM station_logins
         WHERE user_id::text = $1 AND event = 'heartbeat'
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      const setupResult = await db.query<Record<string, unknown>>(
        `SELECT created_at FROM station_logins
         WHERE user_id::text = $1 AND event = 'setup_complete'
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      const todayResult = await db.query<Record<string, unknown>>(
        `SELECT COUNT(*) as count FROM station_logins
         WHERE user_id::text = $1 AND event = 'heartbeat'
         AND created_at >= CURRENT_DATE`,
        [user.id]
      );

      const lastHb = hbResult.rows[0];
      let metadata: Record<string, unknown> = {};
      if (lastHb?.metadata) {
        try {
          metadata = typeof lastHb.metadata === 'string'
            ? JSON.parse(lastHb.metadata as string)
            : lastHb.metadata as Record<string, unknown>;
        } catch { /* ignore */ }
      }

      let status = 'offline';
      if (lastHb?.created_at) {
        const lastTime = new Date(lastHb.created_at as string).getTime();
        const now = Date.now();
        const diffMin = (now - lastTime) / 60000;
        if (diffMin < 2) status = 'online';
        else if (diffMin < 10) status = 'idle';
      }

      stations.push({
        station_id: stationId,
        name: user.name,
        status,
        last_heartbeat: lastHb?.created_at || null,
        current_page: metadata.current_page || null,
        current_item: metadata.current_item || null,
        setup_complete: !!setupResult.rows[0],
        heartbeats_today: parseInt(String(todayResult.rows[0]?.count || 0)),
      });
    }

    res.json(stations);
  } catch (error) {
    console.error('Get monitor stations error:', error);
    res.status(500).json({ error: 'Failed to get station statuses' });
  }
});

// ==================== STATION MANAGEMENT ====================

// Seed 10 station accounts (admin-only, idempotent)
// Pass ?force=true to reset passwords for existing accounts
app.post('/api/admin/seed-stations', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const forceReset = req.query.force === 'true';
    const stations = [
      { num: '01', name: 'Station 01 - Intake', pass: 'refurbz01!' },
      { num: '02', name: 'Station 02 - Testing', pass: 'refurbz02!' },
      { num: '03', name: 'Station 03 - Diagnostics', pass: 'refurbz03!' },
      { num: '04', name: 'Station 04 - Data Wipe', pass: 'refurbz04!' },
      { num: '05', name: 'Station 05 - Repair A', pass: 'refurbz05!' },
      { num: '06', name: 'Station 06 - Repair B', pass: 'refurbz06!' },
      { num: '07', name: 'Station 07 - Cleaning', pass: 'refurbz07!' },
      { num: '08', name: 'Station 08 - Final QC', pass: 'refurbz08!' },
      { num: '09', name: 'Station 09 - Certification', pass: 'refurbz09!' },
      { num: '10', name: 'Station 10 - Packaging', pass: 'refurbz10!' },
    ];

    const created: { email: string; name: string; station_id: string }[] = [];
    const skipped: string[] = [];
    const reset: string[] = [];

    for (const s of stations) {
      const email = `station${s.num}@quickrefurbz.local`;
      const existing = await getUserByEmail(email);
      if (existing) {
        if (forceReset) {
          const passwordHash = await bcrypt.hash(s.pass, 10);
          const dbType = process.env.DB_TYPE || 'sqlite';
          const nowExpr = dbType === 'postgres' ? 'now()' : "datetime('now')";
          await db.query(
            `UPDATE users SET password_hash = $1, updated_at = ${nowExpr} WHERE email = $2`,
            [passwordHash, email]
          );
          reset.push(email);
        } else {
          skipped.push(email);
        }
        continue;
      }

      const id = generateUUID();
      const passwordHash = await bcrypt.hash(s.pass, 10);
      const dbType = process.env.DB_TYPE || 'sqlite';
      const nowExpr = dbType === 'postgres' ? 'now()' : "datetime('now')";
      const trueVal = dbType === 'postgres' ? 'true' : '1';

      await db.query(
        `INSERT INTO users (id, email, password_hash, name, role, is_active, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'technician', ${trueVal}, ${trueVal}, ${nowExpr}, ${nowExpr})`,
        [id, email, passwordHash, s.name]
      );

      created.push({ email, name: s.name, station_id: `RFB-${s.num}` });
    }

    res.json({ created, skipped, reset, total: created.length + skipped.length + reset.length });
  } catch (error) {
    console.error('Seed stations error:', error);
    res.status(500).json({ error: 'Failed to seed station accounts' });
  }
});

// Station heartbeat (authenticated station users)
app.post('/api/stations/heartbeat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { station_id, current_page, current_item, uptime } = req.body;
    const userId = req.user?.id;
    const ip = req.ip || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const dbType = process.env.DB_TYPE || 'sqlite';

    const id = generateUUID();
    const metadata = JSON.stringify({ current_page, current_item, uptime });

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO station_logins (id, user_id, station_id, event, ip_address, user_agent, metadata, created_at)
         VALUES ($1, $2, $3, 'heartbeat', $4, $5, $6::jsonb, now())`,
        [id, userId, station_id || '', ip, ua, metadata]
      );
    } else {
      await db.query(
        `INSERT INTO station_logins (id, user_id, station_id, event, ip_address, user_agent, metadata, created_at)
         VALUES ($1, $2, $3, 'heartbeat', $4, $5, $6, datetime('now'))`,
        [id, userId, station_id || '', ip, ua, metadata]
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
});

// Station setup complete
app.post('/api/stations/setup-complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getPool();
    const { station_id, workstation_id, warehouse_id } = req.body;
    const userId = req.user?.id;
    const ip = req.ip || req.socket.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const dbType = process.env.DB_TYPE || 'sqlite';

    const id = generateUUID();
    const metadata = JSON.stringify({ workstation_id, warehouse_id });

    if (dbType === 'postgres') {
      await db.query(
        `INSERT INTO station_logins (id, user_id, station_id, event, ip_address, user_agent, metadata, created_at)
         VALUES ($1, $2, $3, 'setup_complete', $4, $5, $6::jsonb, now())`,
        [id, userId, station_id || '', ip, ua, metadata]
      );
    } else {
      await db.query(
        `INSERT INTO station_logins (id, user_id, station_id, event, ip_address, user_agent, metadata, created_at)
         VALUES ($1, $2, $3, 'setup_complete', $4, $5, $6, datetime('now'))`,
        [id, userId, station_id || '', ip, ua, metadata]
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Setup complete error:', error);
    res.status(500).json({ error: 'Failed to record setup complete' });
  }
});

// Get all station statuses (admin only)
app.get('/api/admin/stations', authMiddleware, adminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const db = getPool();

    // Get all station users
    const usersResult = await db.query<Record<string, unknown>>(
      `SELECT id, email, name, is_active, created_at FROM users
       WHERE email LIKE '%@quickrefurbz.local' ORDER BY email`
    );

    // Get latest heartbeat per station user
    const stations = [];
    for (const user of usersResult.rows) {
      const stationNum = (user.email as string).match(/station(\d+)/)?.[1] || '??';
      const stationId = `RFB-${stationNum}`;

      // Latest heartbeat
      const hbResult = await db.query<Record<string, unknown>>(
        `SELECT metadata, created_at FROM station_logins
         WHERE user_id::text = $1 AND event = 'heartbeat'
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      // Setup status
      const setupResult = await db.query<Record<string, unknown>>(
        `SELECT created_at FROM station_logins
         WHERE user_id::text = $1 AND event = 'setup_complete'
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      // Items processed today
      const todayResult = await db.query<Record<string, unknown>>(
        `SELECT COUNT(*) as count FROM station_logins
         WHERE user_id::text = $1 AND event = 'heartbeat'
         AND created_at >= CURRENT_DATE`,
        [user.id]
      );

      const lastHb = hbResult.rows[0];
      let metadata: Record<string, unknown> = {};
      if (lastHb?.metadata) {
        try {
          metadata = typeof lastHb.metadata === 'string'
            ? JSON.parse(lastHb.metadata as string)
            : lastHb.metadata as Record<string, unknown>;
        } catch { /* ignore */ }
      }

      // Determine status based on heartbeat recency
      let status = 'offline';
      if (lastHb?.created_at) {
        const lastTime = new Date(lastHb.created_at as string).getTime();
        const now = Date.now();
        const diffMin = (now - lastTime) / 60000;
        if (diffMin < 2) status = 'online';
        else if (diffMin < 10) status = 'idle';
      }

      stations.push({
        station_id: stationId,
        user_id: user.id,
        name: user.name,
        email: user.email,
        status,
        last_heartbeat: lastHb?.created_at || null,
        current_page: metadata.current_page || null,
        current_item: metadata.current_item || null,
        setup_complete: !!setupResult.rows[0],
        setup_at: setupResult.rows[0]?.created_at || null,
        heartbeats_today: parseInt(String(todayResult.rows[0]?.count || 0)),
      });
    }

    res.json(stations);
  } catch (error) {
    console.error('Get stations error:', error);
    res.status(500).json({ error: 'Failed to get station statuses' });
  }
});

// Get station activity log (admin only)
app.get('/api/admin/stations/:id/activity', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getPool();
    const stationId = String(req.params.id); // e.g., RFB-01
    const stationNum = stationId.replace('RFB-', '');
    const email = `station${stationNum}@quickrefurbz.local`;

    // Find user by email
    const userResult = await db.query<Record<string, unknown>>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (!userResult.rows[0]) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    const userId = userResult.rows[0].id;
    const limit = parseInt(queryString(req.query.limit) || '50');

    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM station_logins
       WHERE user_id::text = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get station activity error:', error);
    res.status(500).json({ error: 'Failed to get station activity' });
  }
});

// ==================== API 404 CATCH-ALL ====================

app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
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
