/**
 * QuickRefurbz - Database Module
 * Uses @quickwms/database for shared entities (Items, Pallets)
 * Maintains refurb-specific tables (tickets, parts, technicians, stages)
 *
 * For local dev: Set DB_TYPE=sqlite (uses better-sqlite3)
 * For production: Set DB_TYPE=postgres (uses @quickwms/database)
 */

import path from 'path';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';

// Import from shared package for Postgres mode
import {
  getPool as getSharedPool,
  query as sharedQuery,
  closePool as closeSharedPool,
  generateQLID as sharedGenerateQLID,
  generateInternalPalletId,
  ItemModel,
  PalletModel,
  ensureSequences,
} from '@quickwms/database';

import type {
  Item,
  ItemStatus,
  Pallet,
  CreateItemInput,
  UpdateItemInput,
  QueryResult as SharedQueryResult,
} from '@quickwms/database';

// Re-export shared types
export type { Item, ItemStatus, Pallet, CreateItemInput, UpdateItemInput };

// Create require for ESM compatibility with native modules
const require = createRequire(import.meta.url);

// ==================== TYPE DEFINITIONS ====================

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount?: number;
}

export interface DatabaseAdapter {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

// ==================== SQLITE ADAPTER (LOCAL DEV) ====================

class SQLiteAdapter implements DatabaseAdapter {
  private db: import('better-sqlite3').Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  private getDb(): import('better-sqlite3').Database {
    if (!this.db) {
      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath) as import('better-sqlite3').Database;
      this.db!.pragma('foreign_keys = ON');
    }
    return this.db!;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const db = this.getDb();

    // Convert Postgres-style $1, $2 params to SQLite ? placeholders
    const expandedParams: unknown[] = [];
    let convertedSQL = '';
    let lastIndex = 0;
    const paramRegex = /\$(\d+)/g;
    let match;

    while ((match = paramRegex.exec(sql)) !== null) {
      convertedSQL += sql.slice(lastIndex, match.index) + '?';
      const paramIndex = parseInt(match[1]) - 1;
      if (paramIndex >= 0 && paramIndex < params.length) {
        expandedParams.push(params[paramIndex]);
      }
      lastIndex = match.index + match[0].length;
    }
    convertedSQL += sql.slice(lastIndex);
    const finalSQL = convertedSQL || sql;
    const finalParams = expandedParams.length > 0 ? expandedParams : params;

    // Convert BigInt and Boolean params for SQLite compatibility
    const sqliteParams = finalParams.map(p => {
      if (typeof p === 'bigint') return p.toString();
      if (typeof p === 'boolean') return p ? 1 : 0;
      return p;
    });

    const upperSQL = finalSQL.trim().toUpperCase();

    if (upperSQL.startsWith('SELECT')) {
      const stmt = db.prepare(finalSQL);
      const rows = stmt.all(...sqliteParams) as T[];
      return { rows, rowCount: rows.length };
    }

    if (upperSQL.includes('RETURNING')) {
      // Handle INSERT/UPDATE RETURNING for SQLite
      const returningIdx = finalSQL.toUpperCase().lastIndexOf('RETURNING');
      const baseSql = finalSQL.slice(0, returningIdx).trim();
      const stmt = db.prepare(baseSql);
      const info = stmt.run(...sqliteParams);

      // Try to fetch the row
      const tableMatch = baseSql.match(/(?:INSERT INTO|UPDATE)\s+(\w+)/i);
      if (tableMatch && sqliteParams.length > 0) {
        const tableName = tableMatch[1];
        const isInsert = upperSQL.includes('INSERT');

        try {
          let row: T | undefined;

          if (isInsert) {
            // For INSERT, id is the first param ($1)
            const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
            row = selectStmt.get(sqliteParams[0]) as T | undefined;
          } else {
            // For UPDATE, find the column in WHERE clause (e.g., WHERE qlid = $N or WHERE id = $N)
            const whereMatch = baseSql.match(/WHERE\s+(\w+)\s*=\s*\$\d+/i);
            const whereColumn = whereMatch ? whereMatch[1] : 'id';
            const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE ${whereColumn} = ?`);
            row = selectStmt.get(sqliteParams[sqliteParams.length - 1]) as T | undefined;
          }

          return { rows: row ? [row] : [], rowCount: info.changes };
        } catch {
          return { rows: [], rowCount: info.changes };
        }
      }
      return { rows: [], rowCount: info.changes };
    }

    const stmt = db.prepare(finalSQL);
    const info = stmt.run(...sqliteParams);
    return { rows: [], rowCount: info.changes };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ==================== POSTGRES ADAPTER (SHARED) ====================

class PostgresAdapter implements DatabaseAdapter {
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await sharedQuery(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? undefined,
    };
  }

  async close(): Promise<void> {
    await closeSharedPool();
  }
}

// ==================== DATABASE SINGLETON ====================

let dbAdapter: DatabaseAdapter | null = null;

export function getPool(): DatabaseAdapter {
  if (!dbAdapter) {
    const dbType = process.env.DB_TYPE || 'sqlite';

    if (dbType === 'postgres') {
      dbAdapter = new PostgresAdapter();
    } else {
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      const dbPath = path.join(dataDir, 'quickrefurbz.db');
      dbAdapter = new SQLiteAdapter(dbPath);
    }
  }
  return dbAdapter;
}

export function getDb(): DatabaseAdapter {
  return getPool();
}

export async function closePool(): Promise<void> {
  if (dbAdapter) {
    await dbAdapter.close();
    dbAdapter = null;
  }
}

// ==================== QLID GENERATION ====================

/**
 * Generate next QLID (matches QuickIntakez format)
 * Format: QLID{9 digits} (e.g., QLID000000001)
 * Global counter that never resets
 */
export async function generateQlid(): Promise<{ tick: bigint; qlid: string }> {
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'postgres') {
    // Use shared sequence from @quickwms/database
    const qlid = await sharedGenerateQLID();
    // Parse the QLID to get tick (format: QLID + 9 digits)
    const match = qlid.match(/^QLID(\d{9})$/);
    const tick = match ? BigInt(parseInt(match[1], 10)) : BigInt(0);
    return { tick, qlid };
  } else {
    // SQLite: use local sequence
    const db = getPool();
    await db.query('INSERT INTO qlid_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    const tick = BigInt(result.rows[0].id);
    const qlid = `QLID${tick.toString().padStart(9, '0')}`;
    return { tick, qlid };
  }
}

export function generateUUID(): string {
  return randomUUID();
}

export async function getNextTicketNumber(): Promise<string> {
  const db = getPool();
  const dbType = process.env.DB_TYPE || 'sqlite';

  let num: number;

  if (dbType === 'postgres') {
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('ticket_sequence') as nextval"
    );
    num = parseInt(result.rows[0].nextval);
  } else {
    await db.query('INSERT INTO ticket_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    num = result.rows[0].id;
  }

  return `TK${num.toString().padStart(7, '0')}`;
}

export async function getNextPalletId(): Promise<string> {
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'postgres') {
    // Use shared pallet sequence
    return await generateInternalPalletId('QR');
  } else {
    const db = getPool();
    await db.query('INSERT INTO pallet_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    return `QR${result.rows[0].id.toString().padStart(7, '0')}`;
  }
}

/**
 * Generate next diagnostic session number
 * Format: DS-YYYYMMDD-NNNN
 */
export async function getNextDiagnosticSessionNumber(): Promise<string> {
  const db = getPool();
  const dbType = process.env.DB_TYPE || 'sqlite';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  let num: number;

  if (dbType === 'postgres') {
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('diagnostic_session_sequence') as nextval"
    );
    num = parseInt(result.rows[0].nextval);
  } else {
    await db.query('INSERT INTO diagnostic_session_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    num = result.rows[0].id;
  }

  return `DS-${today}-${num.toString().padStart(4, '0')}`;
}

/**
 * Generate next certification ID
 * Format: UC-YYYYMMDD-NNNN (Upscaled Certified)
 */
export async function getNextCertificationId(): Promise<string> {
  const db = getPool();
  const dbType = process.env.DB_TYPE || 'sqlite';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  let num: number;

  if (dbType === 'postgres') {
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('certification_sequence') as nextval"
    );
    num = parseInt(result.rows[0].nextval);
  } else {
    await db.query('INSERT INTO certification_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    num = result.rows[0].id;
  }

  return `UC-${today}-${num.toString().padStart(4, '0')}`;
}

// ==================== BARCODE PARSING ====================

/**
 * Parse a scanned barcode or identifier
 * Accepts:
 *   - Full barcode: P1BBY-QLID000000001
 *   - Raw QLID: QLID000000001
 *
 * Returns: { qlid, palletId, retailerCode }
 */
export function parseIdentifier(input: string): {
  qlid: string;
  palletId?: string;
  retailerCode?: string;
} {
  // Full barcode format: P1BBY-QLID000000001
  const barcodeMatch = input.match(/^(P\d+([A-Z]{3}))-(QLID\d{9})$/);
  if (barcodeMatch) {
    return {
      palletId: barcodeMatch[1],
      retailerCode: barcodeMatch[2],
      qlid: barcodeMatch[3],
    };
  }

  // QLID with dash but maybe different format
  if (input.includes('-QLID')) {
    const parts = input.split('-');
    const qlidPart = parts.find(p => p.startsWith('QLID'));
    const palletPart = parts.filter(p => !p.startsWith('QLID')).join('-');
    const retailerMatch = palletPart?.match(/P\d+([A-Z]{3})$/);
    return {
      qlid: qlidPart || input,
      palletId: palletPart || undefined,
      retailerCode: retailerMatch?.[1],
    };
  }

  // Raw QLID: QLID000000001
  if (/^QLID\d{9}$/.test(input)) {
    return { qlid: input };
  }

  // Assume it's a QLID (might be partial)
  return { qlid: input };
}

/**
 * Build barcode from pallet ID and QLID
 * Format: P1BBY-QLID000000001
 */
export function buildBarcode(palletId: string, qlid: string): string {
  return `${palletId}-${qlid}`;
}

/**
 * Validate QLID format (matches QuickIntakez)
 * Valid: QLID000000001 (QLID + 9 digits)
 */
export function isValidQlid(qlid: string): boolean {
  return /^QLID\d{9}$/.test(qlid);
}

/**
 * Validate full barcode format
 * Valid: P1BBY-QLID000000001
 */
export function isValidBarcode(barcode: string): boolean {
  return /^P\d+[A-Z]{3}-QLID\d{9}$/.test(barcode);
}

/**
 * Check if using Postgres database
 */
export function isPostgres(): boolean {
  return (process.env.DB_TYPE || 'sqlite') === 'postgres';
}

/**
 * Get the correct NOW() function for the current database
 */
export function nowFn(): string {
  return isPostgres() ? 'now()' : "datetime('now')";
}

// ==================== DATABASE INITIALIZATION ====================

export async function initializeDatabase(): Promise<void> {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const db = getPool();

  if (dbType === 'postgres') {
    await initializePostgres(db);
  } else {
    await initializeSQLite(db);
  }

  console.log(`Database initialized successfully (${dbType})`);
}

async function initializePostgres(db: DatabaseAdapter): Promise<void> {
  // Ensure shared sequences exist
  await ensureSequences();

  // Create refurb_pallets table (renamed to avoid conflict with shared QuickWMS pallets table)
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_pallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pallet_id TEXT UNIQUE NOT NULL,
      retailer TEXT NOT NULL,
      liquidation_source TEXT NOT NULL,
      source_pallet_id TEXT,
      source_order_id TEXT,
      source_manifest_url TEXT,
      purchase_date TIMESTAMPTZ,
      total_cogs NUMERIC NOT NULL DEFAULT 0,
      expected_items INTEGER NOT NULL DEFAULT 0,
      received_items INTEGER NOT NULL DEFAULT 0,
      completed_items INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'RECEIVING',
      warehouse_id TEXT,
      notes TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);

  // Create refurb_items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid_tick BIGINT UNIQUE NOT NULL,
      qlid TEXT UNIQUE NOT NULL,
      qr_pallet_id TEXT REFERENCES refurb_pallets(pallet_id),
      pallet_id TEXT NOT NULL,
      barcode_value TEXT,
      intake_employee_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      intake_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      upc TEXT,
      asin TEXT,
      unit_cogs NUMERIC,
      serial_number TEXT,
      condition_notes TEXT,
      current_stage TEXT NOT NULL DEFAULT 'INTAKE',
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      assigned_technician_id TEXT,
      final_grade TEXT,
      estimated_value NUMERIC,
      next_workflow TEXT,
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_items_qlid ON refurb_items(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_items_stage ON refurb_items(current_stage)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_items_pallet ON refurb_items(pallet_id)`);

  // Create pallet sequence
  await db.query(`CREATE SEQUENCE IF NOT EXISTS pallet_sequence START 1`);

  // Create refurb-specific tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS stage_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      technician_id TEXT,
      technician_name TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS repair_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_number TEXT UNIQUE NOT NULL,
      qlid TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_by_technician_id TEXT NOT NULL,
      assigned_technician_id TEXT,
      resolved_by_technician_id TEXT,
      repair_action TEXT,
      repair_notes TEXT,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      part_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      compatible_categories TEXT[] DEFAULT '{}',
      compatible_manufacturers TEXT[] DEFAULT '{}',
      quantity_on_hand INTEGER NOT NULL DEFAULT 0,
      quantity_reserved INTEGER NOT NULL DEFAULT 0,
      reorder_point INTEGER NOT NULL DEFAULT 5,
      reorder_quantity INTEGER NOT NULL DEFAULT 10,
      unit_cost NUMERIC NOT NULL,
      location TEXT,
      last_restocked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT NOT NULL,
      ticket_id TEXT,
      ticket_number TEXT,
      part_id TEXT NOT NULL,
      part_number TEXT NOT NULL,
      part_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost NUMERIC NOT NULL,
      total_cost NUMERIC NOT NULL,
      used_by_technician_id TEXT NOT NULL,
      used_by_technician_name TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      specialties TEXT[] DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Create refurb_items view or table for local stage tracking
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT UNIQUE NOT NULL,
      current_stage TEXT NOT NULL DEFAULT 'INTAKE',
      assigned_technician_id TEXT,
      final_grade TEXT,
      estimated_value NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE SEQUENCE IF NOT EXISTS ticket_sequence START 1`);

  // RFB ID sequences (standalone QuickRefurbz IDs)
  await db.query(`CREATE SEQUENCE IF NOT EXISTS rfb_id_sequence START 100001`);
  await db.query(`CREATE SEQUENCE IF NOT EXISTS rfb_pallet_sequence START 1`);

  // ==================== WORKFLOW TABLES ====================

  // Refurb jobs - main workflow tracking
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT UNIQUE NOT NULL,
      pallet_id TEXT NOT NULL,
      category TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      current_state TEXT NOT NULL DEFAULT 'REFURBZ_QUEUED',
      current_step_index INTEGER NOT NULL DEFAULT 0,
      assigned_technician_id UUID,
      assigned_technician_name TEXT,
      assigned_at TIMESTAMPTZ,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 2,
      final_grade TEXT,
      warranty_eligible BOOLEAN,
      disposition TEXT,
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_jobs_qlid ON refurb_jobs(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_jobs_state ON refurb_jobs(current_state)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_jobs_technician ON refurb_jobs(assigned_technician_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_jobs_category ON refurb_jobs(category)`);

  // Step completions - audit trail for completed steps
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_step_completions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES refurb_jobs(id) ON DELETE CASCADE,
      state_code TEXT NOT NULL,
      step_code TEXT NOT NULL,
      checklist_results JSONB,
      input_values JSONB,
      measurements JSONB,
      notes TEXT,
      photo_urls TEXT[],
      photo_types TEXT[],
      completed_by UUID,
      completed_by_name TEXT,
      duration_seconds INTEGER,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(job_id, state_code, step_code)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_step_completions_job ON refurb_step_completions(job_id)`);

  // Job diagnoses - defect codes and repair tracking
  await db.query(`
    CREATE TABLE IF NOT EXISTS job_diagnoses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES refurb_jobs(id) ON DELETE CASCADE,
      defect_code TEXT NOT NULL,
      severity TEXT NOT NULL,
      measurements JSONB,
      notes TEXT,
      photo_urls TEXT[],
      repair_action TEXT,
      parts_required JSONB,
      estimated_minutes INTEGER,
      repair_status TEXT NOT NULL DEFAULT 'PENDING',
      repaired_at TIMESTAMPTZ,
      repaired_by UUID,
      repair_notes TEXT,
      parts_used JSONB,
      diagnosed_by UUID NOT NULL,
      diagnosed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_job_diagnoses_job ON job_diagnoses(job_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_job_diagnoses_status ON job_diagnoses(repair_status)`);

  // Defect codes - master list
  await db.query(`
    CREATE TABLE IF NOT EXISTS defect_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      component TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      repair_sop TEXT,
      estimated_minutes INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_defect_codes_category ON defect_codes(category)`);

  // Category SOP overrides - customization per category
  await db.query(`
    CREATE TABLE IF NOT EXISTS category_sop_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      state_code TEXT NOT NULL,
      step_code TEXT NOT NULL,
      is_applicable BOOLEAN NOT NULL DEFAULT true,
      override_prompt TEXT,
      override_help_text TEXT,
      override_checklist JSONB,
      override_input_schema JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(category, step_code)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_sop_overrides_category ON category_sop_overrides(category)`);

  // Workflow state transitions - audit log
  await db.query(`
    CREATE TABLE IF NOT EXISTS workflow_transitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES refurb_jobs(id) ON DELETE CASCADE,
      from_state TEXT,
      to_state TEXT NOT NULL,
      action TEXT NOT NULL,
      technician_id UUID,
      technician_name TEXT,
      reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_workflow_transitions_job ON workflow_transitions(job_id)`);

  // App settings - key/value store
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Data wipe reports
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_wipe_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT NOT NULL,
      job_id UUID REFERENCES refurb_jobs(id),
      device_info JSONB,
      wipe_method TEXT NOT NULL,
      wipe_status TEXT NOT NULL DEFAULT 'PENDING',
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      verified_at TIMESTAMPTZ,
      verified_by UUID,
      verification_method TEXT,
      certificate_data JSONB,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_data_wipe_qlid ON data_wipe_reports(qlid)`);

  // Data wipe certificates (structured certificates for NIST/DoD compliance)
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_wipe_certificates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certificate_number TEXT UNIQUE NOT NULL,
      qlid TEXT NOT NULL,
      device_info JSONB NOT NULL,
      wipe_method TEXT NOT NULL,
      wipe_started_at TIMESTAMPTZ NOT NULL,
      wipe_completed_at TIMESTAMPTZ NOT NULL,
      verification_method TEXT NOT NULL,
      verification_passed BOOLEAN NOT NULL DEFAULT true,
      technician_id TEXT NOT NULL,
      technician_name TEXT,
      verification_code TEXT UNIQUE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_wipe_certs_qlid ON data_wipe_certificates(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wipe_certs_cert_number ON data_wipe_certificates(certificate_number)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wipe_certs_verification ON data_wipe_certificates(verification_code)`);

  // Webhook subscriptions for data feeds
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events JSONB NOT NULL DEFAULT '[]',
      format TEXT NOT NULL DEFAULT 'json',
      headers JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_triggered_at TIMESTAMPTZ,
      last_status INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_subs_active ON webhook_subscriptions(is_active)`);

  // Webhook deliveries (delivery log and retry queue)
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      status_code INTEGER,
      response TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      delivered_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status = 'pending'`);

  // Parts suppliers
  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      api_url TEXT,
      api_key TEXT,
      sync_type TEXT NOT NULL DEFAULT 'MANUAL',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_sync TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Work sessions
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      workstation_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      session_date DATE NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON work_sessions(session_date)`);

  // Users table
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician',
      is_active BOOLEAN NOT NULL DEFAULT false,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      invited_by UUID,
      invited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  // Auth tokens (for invites, password resets, email verification)
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id)`);

  // ==================== QUICKDIAGNOSTICZ TABLES (Postgres) ====================

  // Diagnostic test definitions - master list of tests by category
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_tests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      test_type TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      pass_criteria TEXT NOT NULL,
      measurement_unit TEXT,
      measurement_min NUMERIC,
      measurement_max NUMERIC,
      is_critical BOOLEAN NOT NULL DEFAULT false,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_category ON diagnostic_tests(category)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_code ON diagnostic_tests(code)`);

  // Diagnostic sessions - testing sessions for items
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_number TEXT UNIQUE NOT NULL,
      job_id UUID REFERENCES refurb_jobs(id),
      qlid TEXT NOT NULL,
      category TEXT NOT NULL,
      technician_id TEXT NOT NULL,
      technician_name TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      duration_seconds INTEGER,
      total_tests INTEGER NOT NULL DEFAULT 0,
      passed_tests INTEGER NOT NULL DEFAULT 0,
      failed_tests INTEGER NOT NULL DEFAULT 0,
      skipped_tests INTEGER NOT NULL DEFAULT 0,
      overall_result TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_qlid ON diagnostic_sessions(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_job ON diagnostic_sessions(job_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_technician ON diagnostic_sessions(technician_id)`);

  // Diagnostic session sequence
  await db.query(`CREATE SEQUENCE IF NOT EXISTS diagnostic_session_sequence START 1`);

  // Diagnostic test results - individual test results within a session
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_test_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
      test_id UUID NOT NULL REFERENCES diagnostic_tests(id),
      test_code TEXT NOT NULL,
      result TEXT NOT NULL,
      measurement_value NUMERIC,
      measurement_unit TEXT,
      notes TEXT,
      photo_urls TEXT[],
      tested_by TEXT NOT NULL,
      tested_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_test_results_session ON diagnostic_test_results(session_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_test_results_test ON diagnostic_test_results(test_id)`);

  // Diagnostic defects - defects found during diagnosis
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_defects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
      test_result_id UUID REFERENCES diagnostic_test_results(id),
      defect_code TEXT NOT NULL,
      component TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      notes TEXT,
      photo_urls TEXT[],
      repair_action TEXT,
      repair_estimate_minutes INTEGER,
      parts_required TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_defects_session ON diagnostic_defects(session_id)`);

  // Certifications - issued certifications
  await db.query(`
    CREATE TABLE IF NOT EXISTS certifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certification_id TEXT UNIQUE NOT NULL,
      qlid TEXT NOT NULL,
      job_id UUID REFERENCES refurb_jobs(id),
      session_id UUID REFERENCES diagnostic_sessions(id),
      category TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT,
      certification_level TEXT NOT NULL,
      reported_stolen BOOLEAN NOT NULL DEFAULT false,
      financial_hold BOOLEAN NOT NULL DEFAULT false,
      warranty_status TEXT,
      warranty_info JSONB,
      imei TEXT,
      imei2 TEXT,
      esn TEXT,
      mac_address TEXT,
      certified_by TEXT NOT NULL,
      certified_by_name TEXT,
      certified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      report_pdf_url TEXT,
      label_png_url TEXT,
      qr_code_url TEXT,
      public_report_url TEXT,
      valid_until DATE,
      is_revoked BOOLEAN NOT NULL DEFAULT false,
      revoked_at TIMESTAMPTZ,
      revoked_by TEXT,
      revoked_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_qlid ON certifications(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_cert_id ON certifications(certification_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_session ON certifications(session_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_level ON certifications(certification_level)`);

  // Certification sequence
  await db.query(`CREATE SEQUENCE IF NOT EXISTS certification_sequence START 1`);

  // Certification photos
  await db.query(`
    CREATE TABLE IF NOT EXISTS certification_photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
      photo_type TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      thumbnail_url TEXT,
      caption TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_certification_photos_cert ON certification_photos(certification_id)`);

  // External checks - IMEI, serial, warranty lookups
  await db.query(`
    CREATE TABLE IF NOT EXISTS external_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      certification_id UUID REFERENCES certifications(id),
      session_id UUID REFERENCES diagnostic_sessions(id),
      qlid TEXT NOT NULL,
      check_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      request_payload JSONB,
      response_payload JSONB,
      status TEXT NOT NULL DEFAULT 'PENDING',
      status_details TEXT,
      is_stolen BOOLEAN,
      is_blacklisted BOOLEAN,
      has_financial_hold BOOLEAN,
      warranty_status TEXT,
      recall_status TEXT,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_external_checks_cert ON external_checks(certification_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_external_checks_qlid ON external_checks(qlid)`);

  // Test plans - customizable test configurations
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      enabled_tests TEXT[] NOT NULL DEFAULT '{}',
      disabled_tests TEXT[] NOT NULL DEFAULT '{}',
      is_default BOOLEAN NOT NULL DEFAULT false,
      require_all_critical BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_plans_category ON test_plans(category)`);

  // ==================== HARDWARE DIAGNOSTICS TABLES (Postgres) ====================

  // Hardware instruments - registered test equipment
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_instruments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT,
      connection_type TEXT NOT NULL,
      connection_path TEXT NOT NULL,
      baud_rate INTEGER,
      status TEXT NOT NULL DEFAULT 'DISCONNECTED',
      last_seen_at TIMESTAMPTZ,
      capabilities TEXT[] DEFAULT '{}',
      firmware_version TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hardware_instruments_type ON hardware_instruments(type)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_hardware_instruments_status ON hardware_instruments(status)`);

  // Hardware captures - sigrok signal capture metadata
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_captures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instrument_id UUID REFERENCES hardware_instruments(id),
      file_path TEXT NOT NULL,
      driver TEXT NOT NULL,
      sample_rate TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      channels TEXT[] DEFAULT '{}',
      trigger_condition TEXT,
      file_size INTEGER,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hardware_captures_instrument ON hardware_captures(instrument_id)`);

  // Hardware test executions - tracks automated test plan runs
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_test_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      category TEXT NOT NULL,
      diagnostic_session_id UUID REFERENCES diagnostic_sessions(id),
      status TEXT NOT NULL DEFAULT 'PENDING',
      operator_id TEXT,
      operator_name TEXT,
      station_id TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      total_steps INTEGER NOT NULL DEFAULT 0,
      completed_steps INTEGER NOT NULL DEFAULT 0,
      passed_steps INTEGER NOT NULL DEFAULT 0,
      failed_steps INTEGER NOT NULL DEFAULT 0,
      overall_result TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_test_exec_qlid ON hardware_test_executions(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_test_exec_status ON hardware_test_executions(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_test_exec_session ON hardware_test_executions(diagnostic_session_id)`);

  // Hardware test step results - individual step results linked to diagnostic_test_results
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_test_step_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES hardware_test_executions(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      test_code TEXT NOT NULL,
      status TEXT NOT NULL,
      measured_value NUMERIC,
      measured_unit TEXT,
      expected_min NUMERIC,
      expected_max NUMERIC,
      instrument_id UUID REFERENCES hardware_instruments(id),
      scpi_command TEXT,
      raw_response TEXT,
      diagnostic_test_result_id UUID REFERENCES diagnostic_test_results(id),
      error_message TEXT,
      duration_ms INTEGER,
      measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_step_results_exec ON hardware_test_step_results(execution_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_step_results_code ON hardware_test_step_results(test_code)`);

  // ==================== QUICKTESTZ TABLES (Postgres) ====================

  // Equipment catalog - recommended and custom test equipment
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_equipment_catalog (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      vendor TEXT NOT NULL,
      model TEXT NOT NULL,
      integration_type TEXT NOT NULL,
      connection JSONB NOT NULL DEFAULT '[]',
      capabilities JSONB NOT NULL DEFAULT '[]',
      link_url TEXT,
      required_for_categories JSONB NOT NULL DEFAULT '[]',
      notes TEXT,
      is_custom BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_equipment_catalog_type ON test_equipment_catalog(integration_type)`);

  // Test stations - physical test bench stations
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_stations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      location TEXT,
      controller_type TEXT NOT NULL,
      controller_base_url TEXT,
      network_type TEXT,
      safety_flags JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_stations_name ON test_stations(name)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_stations_controller ON test_stations(controller_type)`);

  // Test outlets - outlets/channels within stations
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_outlets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      station_id UUID NOT NULL REFERENCES test_stations(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      controller_channel TEXT NOT NULL,
      max_amps INTEGER,
      supports_on_off BOOLEAN NOT NULL DEFAULT true,
      supports_power_metering BOOLEAN NOT NULL DEFAULT true,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_outlets_station ON test_outlets(station_id)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_test_outlets_station_channel ON test_outlets(station_id, controller_channel)`);

  // Test profiles - category-specific test configurations
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      thresholds JSONB NOT NULL,
      operator_checklist JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_profiles_category ON test_profiles(category)`);

  // Test runs - actual test executions
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT NOT NULL,
      pallet_id TEXT,
      profile_id UUID NOT NULL REFERENCES test_profiles(id),
      station_id UUID NOT NULL REFERENCES test_stations(id),
      outlet_id UUID NOT NULL REFERENCES test_outlets(id),
      operator_user_id UUID,
      status TEXT NOT NULL DEFAULT 'CREATED',
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      result TEXT,
      score INTEGER,
      anomalies JSONB NOT NULL DEFAULT '[]',
      notes TEXT,
      attachments JSONB NOT NULL DEFAULT '[]',
      checklist_values JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_qlid ON test_runs(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_started ON test_runs(started_at)`);

  // Test readings - time-series power/sensor readings
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_readings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      ts TIMESTAMPTZ NOT NULL,
      watts NUMERIC,
      volts NUMERIC,
      amps NUMERIC,
      temp_c NUMERIC,
      pressure NUMERIC,
      raw JSONB NOT NULL DEFAULT '{}'
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_readings_run_ts ON test_readings(test_run_id, ts)`);

  // Station logins - track station activity and heartbeats
  await db.query(`
    CREATE TABLE IF NOT EXISTS station_logins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      station_id TEXT NOT NULL,
      event TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_station ON station_logins(station_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_user ON station_logins(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_event ON station_logins(event)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_created ON station_logins(created_at)`);

  // Printer settings - saved printer configurations per user/station
  await db.query(`
    CREATE TABLE IF NOT EXISTS printer_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      station_id TEXT,
      printer_ip TEXT NOT NULL,
      printer_name TEXT,
      printer_model TEXT,
      label_width_mm NUMERIC NOT NULL DEFAULT 50.8,
      label_height_mm NUMERIC NOT NULL DEFAULT 25.4,
      print_density_dpi INTEGER NOT NULL DEFAULT 203,
      is_default BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_printer_settings_user ON printer_settings(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_printer_settings_station ON printer_settings(station_id)`);
}

async function initializeSQLite(db: DatabaseAdapter): Promise<void> {
  // Sequence tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS qlid_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeholder INTEGER
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ticket_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeholder INTEGER
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS pallet_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeholder INTEGER
    )
  `);

  // RFB ID sequences (standalone QuickRefurbz IDs)
  await db.query(`
    CREATE TABLE IF NOT EXISTS rfb_id_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeholder INTEGER
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS rfb_pallet_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeholder INTEGER
    )
  `);

  // Refurb pallets table (for SQLite mode - renamed to avoid conflict with shared QuickWMS pallets table)
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_pallets (
      id TEXT PRIMARY KEY,
      pallet_id TEXT UNIQUE NOT NULL,
      retailer TEXT NOT NULL,
      liquidation_source TEXT NOT NULL,
      source_pallet_id TEXT,
      source_order_id TEXT,
      source_manifest_url TEXT,
      purchase_date TEXT,
      total_cogs REAL NOT NULL DEFAULT 0,
      expected_items INTEGER NOT NULL DEFAULT 0,
      received_items INTEGER NOT NULL DEFAULT 0,
      completed_items INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'RECEIVING',
      warehouse_id TEXT,
      notes TEXT,
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `);

  // Items table (for SQLite mode)
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_items (
      id TEXT PRIMARY KEY,
      qlid_tick INTEGER UNIQUE NOT NULL,
      qlid TEXT UNIQUE NOT NULL,
      qr_pallet_id TEXT REFERENCES refurb_pallets(pallet_id),
      pallet_id TEXT NOT NULL,
      barcode_value TEXT,
      intake_employee_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      intake_ts TEXT NOT NULL DEFAULT (datetime('now')),
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      upc TEXT,
      asin TEXT,
      unit_cogs REAL,
      serial_number TEXT,
      condition_notes TEXT,
      current_stage TEXT NOT NULL DEFAULT 'INTAKE',
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      assigned_technician_id TEXT,
      final_grade TEXT,
      estimated_value REAL,
      next_workflow TEXT,
      completed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_qlid ON refurb_items(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_stage ON refurb_items(current_stage)`);

  // Stage history
  await db.query(`
    CREATE TABLE IF NOT EXISTS stage_history (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      technician_id TEXT,
      technician_name TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (qlid) REFERENCES refurb_items(qlid)
    )
  `);

  // Repair tickets
  await db.query(`
    CREATE TABLE IF NOT EXISTS repair_tickets (
      id TEXT PRIMARY KEY,
      ticket_number TEXT UNIQUE NOT NULL,
      qlid TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_by_technician_id TEXT NOT NULL,
      assigned_technician_id TEXT,
      resolved_by_technician_id TEXT,
      repair_action TEXT,
      repair_notes TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (qlid) REFERENCES refurb_items(qlid)
    )
  `);

  // Parts inventory
  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_inventory (
      id TEXT PRIMARY KEY,
      part_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      compatible_categories TEXT DEFAULT '[]',
      compatible_manufacturers TEXT DEFAULT '[]',
      quantity_on_hand INTEGER NOT NULL DEFAULT 0,
      quantity_reserved INTEGER NOT NULL DEFAULT 0,
      reorder_point INTEGER NOT NULL DEFAULT 5,
      reorder_quantity INTEGER NOT NULL DEFAULT 10,
      unit_cost REAL NOT NULL,
      location TEXT,
      last_restocked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Parts usage
  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_usage (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      ticket_id TEXT,
      ticket_number TEXT,
      part_id TEXT NOT NULL,
      part_number TEXT NOT NULL,
      part_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      used_by_technician_id TEXT NOT NULL,
      used_by_technician_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (qlid) REFERENCES refurb_items(qlid)
    )
  `);

  // Technicians
  await db.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      specialties TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ==================== WORKFLOW TABLES (SQLite) ====================

  // Refurb jobs
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_jobs (
      id TEXT PRIMARY KEY,
      qlid TEXT UNIQUE NOT NULL,
      pallet_id TEXT NOT NULL,
      category TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      current_state TEXT NOT NULL DEFAULT 'REFURBZ_QUEUED',
      current_step_index INTEGER NOT NULL DEFAULT 0,
      assigned_technician_id TEXT,
      assigned_technician_name TEXT,
      assigned_at TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 2,
      final_grade TEXT,
      warranty_eligible INTEGER,
      disposition TEXT,
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_jobs_qlid ON refurb_jobs(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_jobs_state ON refurb_jobs(current_state)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_jobs_technician ON refurb_jobs(assigned_technician_id)`);

  // Step completions
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_step_completions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      state_code TEXT NOT NULL,
      step_code TEXT NOT NULL,
      checklist_results TEXT,
      input_values TEXT,
      measurements TEXT,
      notes TEXT,
      photo_urls TEXT,
      photo_types TEXT,
      completed_by TEXT,
      completed_by_name TEXT,
      duration_seconds INTEGER,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(job_id, state_code, step_code),
      FOREIGN KEY (job_id) REFERENCES refurb_jobs(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_step_completions_job ON refurb_step_completions(job_id)`);

  // Job diagnoses
  await db.query(`
    CREATE TABLE IF NOT EXISTS job_diagnoses (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      defect_code TEXT NOT NULL,
      severity TEXT NOT NULL,
      measurements TEXT,
      notes TEXT,
      photo_urls TEXT,
      repair_action TEXT,
      parts_required TEXT,
      estimated_minutes INTEGER,
      repair_status TEXT NOT NULL DEFAULT 'PENDING',
      repaired_at TEXT,
      repaired_by TEXT,
      repair_notes TEXT,
      parts_used TEXT,
      diagnosed_by TEXT NOT NULL,
      diagnosed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES refurb_jobs(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_job_diagnoses_job ON job_diagnoses(job_id)`);

  // Defect codes
  await db.query(`
    CREATE TABLE IF NOT EXISTS defect_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      component TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      repair_sop TEXT,
      estimated_minutes INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Category SOP overrides
  await db.query(`
    CREATE TABLE IF NOT EXISTS category_sop_overrides (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      state_code TEXT NOT NULL,
      step_code TEXT NOT NULL,
      is_applicable INTEGER NOT NULL DEFAULT 1,
      override_prompt TEXT,
      override_help_text TEXT,
      override_checklist TEXT,
      override_input_schema TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(category, step_code)
    )
  `);

  // Workflow transitions
  await db.query(`
    CREATE TABLE IF NOT EXISTS workflow_transitions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      action TEXT NOT NULL,
      technician_id TEXT,
      technician_name TEXT,
      reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES refurb_jobs(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_workflow_transitions_job ON workflow_transitions(job_id)`);

  // App settings - key/value store
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Data wipe reports
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_wipe_reports (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      job_id TEXT,
      device_info TEXT,
      wipe_method TEXT NOT NULL,
      wipe_status TEXT NOT NULL DEFAULT 'PENDING',
      started_at TEXT,
      completed_at TEXT,
      verified_at TEXT,
      verified_by TEXT,
      verification_method TEXT,
      certificate_data TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES refurb_jobs(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_data_wipe_qlid ON data_wipe_reports(qlid)`);

  // Parts suppliers
  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_url TEXT,
      api_key TEXT,
      sync_type TEXT NOT NULL DEFAULT 'MANUAL',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_sync TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Work sessions
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      workstation_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      session_date TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_work_sessions_date ON work_sessions(session_date)`);

  // Users table
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician',
      is_active INTEGER NOT NULL DEFAULT 0,
      email_verified INTEGER NOT NULL DEFAULT 0,
      invited_by TEXT,
      invited_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  // Auth tokens (for invites, password resets, email verification)
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id)`);

  // ==================== QUICKDIAGNOSTICZ TABLES (SQLite) ====================

  // Diagnostic session sequence
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_session_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeholder INTEGER
    )
  `);

  // Certification sequence
  await db.query(`
    CREATE TABLE IF NOT EXISTS certification_sequence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placeholder INTEGER
    )
  `);

  // Diagnostic test definitions
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_tests (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      test_type TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      pass_criteria TEXT NOT NULL,
      measurement_unit TEXT,
      measurement_min REAL,
      measurement_max REAL,
      is_critical INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_category ON diagnostic_tests(category)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_code ON diagnostic_tests(code)`);

  // Diagnostic sessions
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_sessions (
      id TEXT PRIMARY KEY,
      session_number TEXT UNIQUE NOT NULL,
      job_id TEXT,
      qlid TEXT NOT NULL,
      category TEXT NOT NULL,
      technician_id TEXT NOT NULL,
      technician_name TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      duration_seconds INTEGER,
      total_tests INTEGER NOT NULL DEFAULT 0,
      passed_tests INTEGER NOT NULL DEFAULT 0,
      failed_tests INTEGER NOT NULL DEFAULT 0,
      skipped_tests INTEGER NOT NULL DEFAULT 0,
      overall_result TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (job_id) REFERENCES refurb_jobs(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_qlid ON diagnostic_sessions(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_job ON diagnostic_sessions(job_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_technician ON diagnostic_sessions(technician_id)`);

  // Diagnostic test results
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_test_results (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      test_id TEXT NOT NULL,
      test_code TEXT NOT NULL,
      result TEXT NOT NULL,
      measurement_value REAL,
      measurement_unit TEXT,
      notes TEXT,
      photo_urls TEXT,
      tested_by TEXT NOT NULL,
      tested_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (test_id) REFERENCES diagnostic_tests(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_test_results_session ON diagnostic_test_results(session_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_test_results_test ON diagnostic_test_results(test_id)`);

  // Diagnostic defects
  await db.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_defects (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      test_result_id TEXT,
      defect_code TEXT NOT NULL,
      component TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      notes TEXT,
      photo_urls TEXT,
      repair_action TEXT,
      repair_estimate_minutes INTEGER,
      parts_required TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (test_result_id) REFERENCES diagnostic_test_results(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_diagnostic_defects_session ON diagnostic_defects(session_id)`);

  // Certifications
  await db.query(`
    CREATE TABLE IF NOT EXISTS certifications (
      id TEXT PRIMARY KEY,
      certification_id TEXT UNIQUE NOT NULL,
      qlid TEXT NOT NULL,
      job_id TEXT,
      session_id TEXT,
      category TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT,
      certification_level TEXT NOT NULL,
      reported_stolen INTEGER NOT NULL DEFAULT 0,
      financial_hold INTEGER NOT NULL DEFAULT 0,
      warranty_status TEXT,
      warranty_info TEXT,
      imei TEXT,
      imei2 TEXT,
      esn TEXT,
      mac_address TEXT,
      certified_by TEXT NOT NULL,
      certified_by_name TEXT,
      certified_at TEXT NOT NULL DEFAULT (datetime('now')),
      report_pdf_url TEXT,
      label_png_url TEXT,
      qr_code_url TEXT,
      public_report_url TEXT,
      valid_until TEXT,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      revoked_at TEXT,
      revoked_by TEXT,
      revoked_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (job_id) REFERENCES refurb_jobs(id),
      FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_qlid ON certifications(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_cert_id ON certifications(certification_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_session ON certifications(session_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_certifications_level ON certifications(certification_level)`);

  // Certification photos
  await db.query(`
    CREATE TABLE IF NOT EXISTS certification_photos (
      id TEXT PRIMARY KEY,
      certification_id TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      thumbnail_url TEXT,
      caption TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (certification_id) REFERENCES certifications(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_certification_photos_cert ON certification_photos(certification_id)`);

  // External checks
  await db.query(`
    CREATE TABLE IF NOT EXISTS external_checks (
      id TEXT PRIMARY KEY,
      certification_id TEXT,
      session_id TEXT,
      qlid TEXT NOT NULL,
      check_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      request_payload TEXT,
      response_payload TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      status_details TEXT,
      is_stolen INTEGER,
      is_blacklisted INTEGER,
      has_financial_hold INTEGER,
      warranty_status TEXT,
      recall_status TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      FOREIGN KEY (certification_id) REFERENCES certifications(id),
      FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_external_checks_cert ON external_checks(certification_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_external_checks_qlid ON external_checks(qlid)`);

  // Test plans
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_plans (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      enabled_tests TEXT NOT NULL DEFAULT '[]',
      disabled_tests TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0,
      require_all_critical INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_plans_category ON test_plans(category)`);

  // ==================== HARDWARE DIAGNOSTICS TABLES (SQLite) ====================

  // Hardware instruments
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_instruments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT,
      connection_type TEXT NOT NULL,
      connection_path TEXT NOT NULL,
      baud_rate INTEGER,
      status TEXT NOT NULL DEFAULT 'DISCONNECTED',
      last_seen_at TEXT,
      capabilities TEXT DEFAULT '[]',
      firmware_version TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hardware_instruments_type ON hardware_instruments(type)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_hardware_instruments_status ON hardware_instruments(status)`);

  // Hardware captures
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_captures (
      id TEXT PRIMARY KEY,
      instrument_id TEXT,
      file_path TEXT NOT NULL,
      driver TEXT NOT NULL,
      sample_rate TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      channels TEXT DEFAULT '[]',
      trigger_condition TEXT,
      file_size INTEGER,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (instrument_id) REFERENCES hardware_instruments(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hardware_captures_instrument ON hardware_captures(instrument_id)`);

  // Hardware test executions
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_test_executions (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      category TEXT NOT NULL,
      diagnostic_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      operator_id TEXT,
      operator_name TEXT,
      station_id TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      total_steps INTEGER NOT NULL DEFAULT 0,
      completed_steps INTEGER NOT NULL DEFAULT 0,
      passed_steps INTEGER NOT NULL DEFAULT 0,
      failed_steps INTEGER NOT NULL DEFAULT 0,
      overall_result TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (diagnostic_session_id) REFERENCES diagnostic_sessions(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_test_exec_qlid ON hardware_test_executions(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_test_exec_status ON hardware_test_executions(status)`);

  // Hardware test step results
  await db.query(`
    CREATE TABLE IF NOT EXISTS hardware_test_step_results (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      step_number INTEGER NOT NULL,
      test_code TEXT NOT NULL,
      status TEXT NOT NULL,
      measured_value REAL,
      measured_unit TEXT,
      expected_min REAL,
      expected_max REAL,
      instrument_id TEXT,
      scpi_command TEXT,
      raw_response TEXT,
      diagnostic_test_result_id TEXT,
      error_message TEXT,
      duration_ms INTEGER,
      measured_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (execution_id) REFERENCES hardware_test_executions(id) ON DELETE CASCADE,
      FOREIGN KEY (instrument_id) REFERENCES hardware_instruments(id),
      FOREIGN KEY (diagnostic_test_result_id) REFERENCES diagnostic_test_results(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_step_results_exec ON hardware_test_step_results(execution_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_hw_step_results_code ON hardware_test_step_results(test_code)`);

  // ==================== QUICKTESTZ TABLES (SQLite) ====================

  // Equipment catalog
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_equipment_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      vendor TEXT NOT NULL,
      model TEXT NOT NULL,
      integration_type TEXT NOT NULL,
      connection TEXT NOT NULL DEFAULT '[]',
      capabilities TEXT NOT NULL DEFAULT '[]',
      link_url TEXT,
      required_for_categories TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_equipment_catalog_type ON test_equipment_catalog(integration_type)`);

  // Test stations
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      controller_type TEXT NOT NULL,
      controller_base_url TEXT,
      network_type TEXT,
      safety_flags TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_stations_name ON test_stations(name)`);

  // Test outlets
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_outlets (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      label TEXT NOT NULL,
      controller_channel TEXT NOT NULL,
      max_amps INTEGER,
      supports_on_off INTEGER NOT NULL DEFAULT 1,
      supports_power_metering INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (station_id) REFERENCES test_stations(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_outlets_station ON test_outlets(station_id)`);

  // Test profiles
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_profiles (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      thresholds TEXT NOT NULL,
      operator_checklist TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_profiles_category ON test_profiles(category)`);

  // Test runs
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      pallet_id TEXT,
      profile_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      outlet_id TEXT NOT NULL,
      operator_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'CREATED',
      started_at TEXT,
      ended_at TEXT,
      result TEXT,
      score INTEGER,
      anomalies TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      attachments TEXT NOT NULL DEFAULT '[]',
      checklist_values TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (profile_id) REFERENCES test_profiles(id),
      FOREIGN KEY (station_id) REFERENCES test_stations(id),
      FOREIGN KEY (outlet_id) REFERENCES test_outlets(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_qlid ON test_runs(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status)`);

  // Test readings
  await db.query(`
    CREATE TABLE IF NOT EXISTS test_readings (
      id TEXT PRIMARY KEY,
      test_run_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      watts REAL,
      volts REAL,
      amps REAL,
      temp_c REAL,
      pressure REAL,
      raw TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_test_readings_run_ts ON test_readings(test_run_id, ts)`);

  // ==================== PRODUCTION ENHANCEMENT TABLES ====================

  // UPC lookup cache
  await db.query(`
    CREATE TABLE IF NOT EXISTS upc_lookup_cache (
      id TEXT PRIMARY KEY,
      upc TEXT UNIQUE NOT NULL,
      brand TEXT,
      model TEXT,
      title TEXT,
      category TEXT,
      msrp REAL,
      image_url TEXT,
      raw_response TEXT,
      provider TEXT DEFAULT 'manual',
      cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_upc_cache_upc ON upc_lookup_cache(upc)`);

  // Item photos
  await db.query(`
    CREATE TABLE IF NOT EXISTS item_photos (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      stage TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      storage_provider TEXT DEFAULT 'local',
      metadata TEXT DEFAULT '{}',
      captured_by TEXT,
      captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_item_photos_qlid ON item_photos(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_item_photos_stage ON item_photos(qlid, stage)`);

  // Grading rubrics (category-specific criteria)
  await db.query(`
    CREATE TABLE IF NOT EXISTS grading_rubrics (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      grade TEXT NOT NULL,
      min_score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      criteria TEXT NOT NULL,
      cosmetic_requirements TEXT,
      functional_requirements TEXT,
      max_defect_count INTEGER,
      warranty_eligible INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, grade)
    )
  `);

  // Grading assessments
  await db.query(`
    CREATE TABLE IF NOT EXISTS grading_assessments (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      job_id TEXT,
      category TEXT NOT NULL,
      criteria_results TEXT NOT NULL,
      cosmetic_score INTEGER,
      functional_score INTEGER,
      overall_score INTEGER,
      calculated_grade TEXT NOT NULL,
      final_grade TEXT,
      override_reason TEXT,
      assessed_by TEXT NOT NULL,
      assessed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_grading_assessments_qlid ON grading_assessments(qlid)`);

  // Parts usage tracking
  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_usage (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      job_id TEXT,
      diagnosis_id TEXT,
      part_id TEXT NOT NULL,
      part_sku TEXT,
      part_name TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      reason TEXT,
      used_by TEXT NOT NULL,
      used_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_parts_usage_qlid ON parts_usage(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_parts_usage_part ON parts_usage(part_id)`);

  // Labor tracking
  await db.query(`
    CREATE TABLE IF NOT EXISTS labor_entries (
      id TEXT PRIMARY KEY,
      qlid TEXT NOT NULL,
      job_id TEXT,
      technician_id TEXT NOT NULL,
      technician_name TEXT,
      stage TEXT NOT NULL,
      task_type TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_minutes INTEGER,
      labor_rate REAL,
      labor_cost REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_labor_entries_qlid ON labor_entries(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_labor_entries_technician ON labor_entries(technician_id)`);

  // Cost summary (materialized view equivalent)
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_costs (
      id TEXT PRIMARY KEY,
      qlid TEXT UNIQUE NOT NULL,
      job_id TEXT,
      unit_cogs REAL DEFAULT 0,
      parts_cost REAL DEFAULT 0,
      labor_cost REAL DEFAULT 0,
      overhead_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      estimated_value REAL,
      profit_margin REAL,
      last_calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_refurb_costs_qlid ON refurb_costs(qlid)`);

  // Data wipe certificates (structured certificates for NIST/DoD compliance)
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_wipe_certificates (
      id TEXT PRIMARY KEY,
      certificate_number TEXT UNIQUE NOT NULL,
      qlid TEXT NOT NULL,
      device_info TEXT NOT NULL,
      wipe_method TEXT NOT NULL,
      wipe_started_at TEXT NOT NULL,
      wipe_completed_at TEXT NOT NULL,
      verification_method TEXT NOT NULL,
      verification_passed INTEGER NOT NULL DEFAULT 1,
      technician_id TEXT NOT NULL,
      technician_name TEXT,
      verification_code TEXT UNIQUE NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wipe_certs_qlid ON data_wipe_certificates(qlid)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wipe_certs_cert_number ON data_wipe_certificates(certificate_number)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wipe_certs_verification ON data_wipe_certificates(verification_code)`);

  // Webhook subscriptions for data feeds
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      format TEXT NOT NULL DEFAULT 'json',
      headers TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_triggered_at TEXT,
      last_status INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_subs_active ON webhook_subscriptions(is_active)`);

  // Webhook deliveries (delivery log and retry queue)
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      status_code INTEGER,
      response TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      delivered_at TEXT,
      FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at)`);

  // Station logins - track station activity and heartbeats
  await db.query(`
    CREATE TABLE IF NOT EXISTS station_logins (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      station_id TEXT NOT NULL,
      event TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_station ON station_logins(station_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_user ON station_logins(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_event ON station_logins(event)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_station_logins_created ON station_logins(created_at)`);

  // Printer settings - saved printer configurations per user/station
  await db.query(`
    CREATE TABLE IF NOT EXISTS printer_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      station_id TEXT,
      printer_ip TEXT NOT NULL,
      printer_name TEXT,
      printer_model TEXT,
      label_width_mm REAL NOT NULL DEFAULT 50.8,
      label_height_mm REAL NOT NULL DEFAULT 25.4,
      print_density_dpi INTEGER NOT NULL DEFAULT 203,
      is_default INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_printer_settings_user ON printer_settings(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_printer_settings_station ON printer_settings(station_id)`);

  // Seed default grading rubrics if empty
  const rubricCheck = await db.query(`SELECT COUNT(*) as count FROM grading_rubrics`);
  if (parseInt(rubricCheck.rows[0].count as string) === 0) {
    await seedDefaultGradingRubrics(db);
  }
}

// Seed default grading rubrics for common categories
async function seedDefaultGradingRubrics(db: DatabaseAdapter): Promise<void> {
  const categories = ['PHONE', 'TABLET', 'LAPTOP', 'DESKTOP', 'TV', 'MONITOR', 'AUDIO', 'GAMING', 'WEARABLE', 'APPLIANCE', 'OTHER'];
  const grades = [
    { grade: 'A', min: 90, max: 100, warranty: 1, maxDefects: 0, cosmetic: 'Like new, no visible wear', functional: 'All features working perfectly' },
    { grade: 'B', min: 75, max: 89, warranty: 1, maxDefects: 2, cosmetic: 'Minor scratches or wear', functional: 'All core features working' },
    { grade: 'C', min: 60, max: 74, warranty: 1, maxDefects: 4, cosmetic: 'Visible wear, light scratches', functional: 'Functional with minor issues' },
    { grade: 'D', min: 40, max: 59, warranty: 0, maxDefects: 6, cosmetic: 'Significant cosmetic damage', functional: 'Functional but needs repair' },
    { grade: 'F', min: 0, max: 39, warranty: 0, maxDefects: 99, cosmetic: 'Heavy damage', functional: 'Parts only or non-functional' },
  ];

  for (const category of categories) {
    for (const g of grades) {
      const id = randomUUID();
      const criteria = JSON.stringify([
        { name: 'Screen/Display', weight: 25, type: 'score' },
        { name: 'Body/Housing', weight: 20, type: 'score' },
        { name: 'Buttons/Ports', weight: 15, type: 'score' },
        { name: 'Battery/Power', weight: 20, type: 'score' },
        { name: 'Functionality', weight: 20, type: 'score' },
      ]);
      await db.query(`
        INSERT OR IGNORE INTO grading_rubrics (id, category, grade, min_score, max_score, criteria, cosmetic_requirements, functional_requirements, max_defect_count, warranty_eligible)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [id, category, g.grade, g.min, g.max, criteria, g.cosmetic, g.functional, g.maxDefects, g.warranty]);
    }
  }
}

// ==================== SHARED ITEM MODEL ACCESS ====================

/**
 * Get the shared ItemModel for working with items in Postgres mode
 */
export function getItemModel(): typeof ItemModel | null {
  const dbType = process.env.DB_TYPE || 'sqlite';
  return dbType === 'postgres' ? ItemModel : null;
}

/**
 * Get the shared PalletModel for working with pallets in Postgres mode
 */
export function getPalletModel(): typeof PalletModel | null {
  const dbType = process.env.DB_TYPE || 'sqlite';
  return dbType === 'postgres' ? PalletModel : null;
}

/**
 * Update item status in the shared database
 */
export async function updateItemStatus(qlid: string, status: ItemStatus): Promise<void> {
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'postgres') {
    // Create instance of ItemModel and use updateStatus method
    const itemModel = new ItemModel();
    await itemModel.updateStatus(qlid, status);
  } else {
    // In SQLite mode, update local table
    const db = getPool();
    // Map refurb stages to item status
    const stageToStatus: Record<string, string> = {
      INTAKE: 'received',
      TESTING: 'refurbishing',
      REPAIR: 'refurbishing',
      CLEANING: 'refurbishing',
      FINAL_QC: 'refurbishing',
      COMPLETE: 'refurbished',
    };
    const mappedStatus = stageToStatus[status] || status;
    await db.query(
      `UPDATE refurb_items SET current_stage = $1, updated_at = datetime('now') WHERE qlid = $2`,
      [mappedStatus, qlid]
    );
  }
}
