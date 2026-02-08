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

    // Convert BigInt params to strings for SQLite
    const sqliteParams = finalParams.map(p =>
      typeof p === 'bigint' ? p.toString() : p
    );

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

  // Pallets table (for SQLite mode)
  await db.query(`
    CREATE TABLE IF NOT EXISTS pallets (
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
      qr_pallet_id TEXT REFERENCES pallets(pallet_id),
      pallet_id TEXT NOT NULL,
      barcode_value TEXT,
      intake_employee_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      intake_ts TEXT NOT NULL DEFAULT (datetime('now')),
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      unit_cogs REAL,
      serial_number TEXT,
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
