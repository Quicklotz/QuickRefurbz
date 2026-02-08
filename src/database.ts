/**
 * QuickRefurbz - Database Module
 * Supports SQLite (local dev) and Postgres (production)
 *
 * Set DB_TYPE=postgres for production, defaults to sqlite
 */

import path from 'path';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';

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

// ==================== SQLITE ADAPTER ====================

class SQLiteAdapter implements DatabaseAdapter {
  private db: import('better-sqlite3').Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  private getDb(): import('better-sqlite3').Database {
    if (!this.db) {
      // Use require for better-sqlite3 (native module)
      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath) as import('better-sqlite3').Database;
      // Enable foreign keys
      this.db!.pragma('foreign_keys = ON');
    }
    return this.db!;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const db = this.getDb();

    // Handle Postgres-specific syntax first
    let sqliteSQL = this.convertPostgresToSQLite(sql);

    // Convert Postgres-style $1, $2 params to SQLite ? placeholders
    // In Postgres, $1 can be used multiple times, but SQLite needs a ? for each occurrence
    // So we need to expand the params array to match the number of ?s
    const expandedParams: unknown[] = [];
    let convertedSQL = '';
    let lastIndex = 0;
    const paramRegex = /\$(\d+)/g;
    let match;

    while ((match = paramRegex.exec(sqliteSQL)) !== null) {
      convertedSQL += sqliteSQL.slice(lastIndex, match.index) + '?';
      const paramIndex = parseInt(match[1]) - 1; // $1 -> index 0
      if (paramIndex >= 0 && paramIndex < params.length) {
        expandedParams.push(params[paramIndex]);
      }
      lastIndex = match.index + match[0].length;
    }
    convertedSQL += sqliteSQL.slice(lastIndex);
    sqliteSQL = convertedSQL || sqliteSQL;

    // Use expanded params if we did any conversion, otherwise use original
    const finalParams = expandedParams.length > 0 ? expandedParams : params;

    // Convert BigInt params to strings for SQLite
    const sqliteParams = finalParams.map(p =>
      typeof p === 'bigint' ? p.toString() : p
    );

    try {
      const trimmedSQL = sqliteSQL.trim().toUpperCase();

      if (trimmedSQL.startsWith('SELECT') || trimmedSQL.startsWith('WITH')) {
        const stmt = db.prepare(sqliteSQL);
        const rows = stmt.all(...sqliteParams) as T[];
        return { rows, rowCount: rows.length };
      } else if (trimmedSQL.startsWith('INSERT') && sqliteSQL.toUpperCase().includes('RETURNING')) {
        // Handle INSERT ... RETURNING
        const insertSQL = sqliteSQL.replace(/\s+RETURNING\s+\*\s*$/i, '');
        const stmt = db.prepare(insertSQL);
        const info = stmt.run(...sqliteParams);

        // Fetch the inserted row
        const tableName = this.extractTableName(sqliteSQL, 'INSERT INTO');
        if (tableName) {
          const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`);
          const rows = [selectStmt.get(info.lastInsertRowid)] as T[];
          return { rows, rowCount: 1 };
        }
        return { rows: [], rowCount: info.changes };
      } else if (trimmedSQL.startsWith('UPDATE') && sqliteSQL.toUpperCase().includes('RETURNING')) {
        // Handle UPDATE ... RETURNING - need to get the row first
        const updateSQL = sqliteSQL.replace(/\s+RETURNING\s+\*\s*$/i, '');
        const stmt = db.prepare(updateSQL);
        const info = stmt.run(...sqliteParams);

        // For UPDATE RETURNING, we need to re-fetch based on the WHERE clause
        // This is a simplified approach - get the last param which is usually the ID/QLID
        const tableName = this.extractTableName(sqliteSQL, 'UPDATE');
        if (tableName && sqliteParams.length > 0) {
          const lastParam = sqliteParams[sqliteParams.length - 1];
          // Try both id and qlid columns for the lookup
          try {
            const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE qlid = ? OR id = ?`);
            const row = selectStmt.get(lastParam, lastParam);
            return { rows: row ? [row as T] : [], rowCount: info.changes };
          } catch {
            const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
            const row = selectStmt.get(lastParam);
            return { rows: row ? [row as T] : [], rowCount: info.changes };
          }
        }
        return { rows: [], rowCount: info.changes };
      } else {
        const stmt = db.prepare(sqliteSQL);
        const info = stmt.run(...sqliteParams);
        return { rows: [], rowCount: info.changes };
      }
    } catch (error) {
      // If it's a "no such table" or similar, just return empty for CREATE IF NOT EXISTS
      if (sql.includes('IF NOT EXISTS') || sql.includes('IF EXISTS')) {
        return { rows: [], rowCount: 0 };
      }
      throw error;
    }
  }

  private extractTableName(sql: string, prefix: string): string | null {
    const match = sql.match(new RegExp(`${prefix}\\s+([\\w_]+)`, 'i'));
    return match ? match[1] : null;
  }

  private convertPostgresToSQLite(sql: string): string {
    let result = sql;

    // Remove Postgres-specific parts
    result = result.replace(/::date/gi, '');
    result = result.replace(/::text/gi, '');
    result = result.replace(/TIMESTAMPTZ/gi, 'TEXT');
    result = result.replace(/BIGINT/gi, 'INTEGER');
    result = result.replace(/NUMERIC/gi, 'REAL');
    result = result.replace(/BOOLEAN/gi, 'INTEGER');
    result = result.replace(/UUID/gi, 'TEXT');
    result = result.replace(/TEXT\[\]/gi, 'TEXT'); // Arrays become JSON strings

    // Remove DEFAULT gen_random_uuid() - we handle this in code
    result = result.replace(/DEFAULT\s+gen_random_uuid\(\)/gi, '');

    // Remove GENERATED ALWAYS AS ... STORED (computed columns)
    result = result.replace(/\s+GENERATED\s+ALWAYS\s+AS\s+\([^)]+\)\s+STORED/gi, '');

    // Handle now() -> datetime('now')
    result = result.replace(/now\(\)/gi, "datetime('now')");
    result = result.replace(/CURRENT_DATE/gi, "date('now')");

    // Handle CREATE SEQUENCE (skip for SQLite)
    if (result.trim().toUpperCase().startsWith('CREATE SEQUENCE')) {
      return 'SELECT 1'; // No-op
    }

    // Handle CREATE INDEX IF NOT EXISTS (split multiple indexes)
    if (result.includes('CREATE INDEX') && result.includes(';')) {
      // Just take the first one
      const firstIndex = result.split(';')[0];
      return firstIndex.trim();
    }

    return result;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ==================== POSTGRES ADAPTER ====================

class PostgresAdapter implements DatabaseAdapter {
  private pool: import('pg').Pool | null = null;

  private getPool(): import('pg').Pool {
    if (!this.pool) {
      // Use require for pg
      const pg = require('pg');
      const { Pool } = pg;

      this.pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        database: process.env.PGDATABASE || 'quickrefurbz',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || ''
      }) as import('pg').Pool;
    }
    return this.pool!;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const pool = this.getPool();
    const result = await pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? undefined
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// ==================== DATABASE SINGLETON ====================

let adapter: DatabaseAdapter | null = null;

export function getDb(): DatabaseAdapter {
  if (!adapter) {
    const dbType = process.env.DB_TYPE || 'sqlite';

    if (dbType === 'postgres') {
      adapter = new PostgresAdapter();
    } else {
      // SQLite - use data directory
      const dataDir = process.env.DATA_DIR || './data';
      const dbPath = path.join(dataDir, 'quickrefurbz.db');
      adapter = new SQLiteAdapter(dbPath);
    }
  }
  return adapter;
}

// Alias for backward compatibility
export function getPool(): DatabaseAdapter {
  return getDb();
}

export async function closeDb(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}

// Alias for backward compatibility
export async function closePool(): Promise<void> {
  return closeDb();
}

// ==================== QLID GENERATION ====================

const BASE = 10_000_000_000n; // 10^10 as BigInt

/**
 * Convert series_index to Excel-style letters
 * 0 -> ""
 * 1 -> "A"
 * 26 -> "Z"
 * 27 -> "AA"
 * 28 -> "AB"
 * etc.
 */
export function seriesIndexToLetters(index: bigint): string {
  if (index === 0n) return '';

  let result = '';
  let n = index;

  while (n > 0n) {
    n--; // Adjust for 1-based indexing (A=1, not A=0)
    const remainder = Number(n % 26n);
    result = String.fromCharCode(65 + remainder) + result;
    n = n / 26n;
  }

  return result;
}

/**
 * Parse QLID string back to tick value
 * QLID0000000001 -> 1
 * QLIDA0000000000 -> 10000000000
 */
export function qlidToTick(qlid: string): bigint {
  const match = qlid.match(/^QLID([A-Z]*)(\d{10})$/);
  if (!match) {
    throw new Error(`Invalid QLID format: ${qlid}`);
  }

  const series = match[1];
  const counter = BigInt(match[2]);

  // Convert series letters back to index
  let seriesIndex = 0n;
  if (series.length > 0) {
    for (let i = 0; i < series.length; i++) {
      seriesIndex = seriesIndex * 26n + BigInt(series.charCodeAt(i) - 64);
    }
  }

  return seriesIndex * BASE + counter;
}

/**
 * Convert tick to QLID string
 * 1 -> QLID0000000001
 * 10000000000 -> QLIDA0000000000
 */
export function tickToQlid(tick: bigint): string {
  const seriesIndex = tick / BASE;
  const counter = tick % BASE;
  const series = seriesIndexToLetters(seriesIndex);
  const paddedCounter = counter.toString().padStart(10, '0');
  return `QLID${series}${paddedCounter}`;
}

/**
 * Generate a new QLID atomically
 * Uses Postgres SEQUENCE or SQLite autoincrement table
 * Returns { tick, qlid }
 */
export async function generateQlid(): Promise<{ tick: bigint; qlid: string }> {
  const db = getDb();
  const dbType = process.env.DB_TYPE || 'sqlite';

  let tick: bigint;

  if (dbType === 'postgres') {
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('qlid_sequence') as nextval"
    );
    tick = BigInt(result.rows[0].nextval);
  } else {
    // SQLite: use a sequence table
    await db.query(`
      INSERT INTO qlid_sequence (placeholder) VALUES (1)
    `);
    const result = await db.query<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );
    tick = BigInt(result.rows[0].id);
  }

  const qlid = tickToQlid(tick);
  return { tick, qlid };
}

/**
 * Generate next ticket number
 */
export async function getNextTicketNumber(): Promise<string> {
  const db = getDb();
  const dbType = process.env.DB_TYPE || 'sqlite';

  let num: number;

  if (dbType === 'postgres') {
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('ticket_sequence') as nextval"
    );
    num = parseInt(result.rows[0].nextval);
  } else {
    // SQLite: use a sequence table
    await db.query(`
      INSERT INTO ticket_sequence (placeholder) VALUES (1)
    `);
    const result = await db.query<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );
    num = result.rows[0].id;
  }

  return `TK${num.toString().padStart(7, '0')}`;
}

/**
 * Generate next pallet ID (QR0000001 format)
 */
export async function getNextPalletId(): Promise<string> {
  const db = getDb();
  const dbType = process.env.DB_TYPE || 'sqlite';

  let num: number;

  if (dbType === 'postgres') {
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('pallet_sequence') as nextval"
    );
    num = parseInt(result.rows[0].nextval);
  } else {
    // SQLite: use a sequence table
    await db.query(`
      INSERT INTO pallet_sequence (placeholder) VALUES (1)
    `);
    const result = await db.query<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );
    num = result.rows[0].id;
  }

  return `QR${num.toString().padStart(7, '0')}`;
}

// ==================== BARCODE PARSING ====================

export interface ParsedBarcode {
  palletId: string;
  qlid: string;
  series: string;
  counter: string;
}

/**
 * Parse barcode or QLID input
 * Accepts:
 *   - Full barcode: P1BBY-QLID0000000001
 *   - Raw QLID: QLID0000000001
 * Returns the canonical QLID
 */
export function parseIdentifier(input: string): { qlid: string; palletId?: string } {
  // Try full barcode format: {PalletID}-QLID{SERIES}{10-digit}
  const barcodeMatch = input.match(/^([A-Z0-9]+)-QLID([A-Z]*)(\d{10})$/);
  if (barcodeMatch) {
    return {
      palletId: barcodeMatch[1],
      qlid: `QLID${barcodeMatch[2]}${barcodeMatch[3]}`
    };
  }

  // Try raw QLID format: QLID{SERIES}{10-digit}
  const qlidMatch = input.match(/^QLID([A-Z]*)(\d{10})$/);
  if (qlidMatch) {
    return {
      qlid: `QLID${qlidMatch[1]}${qlidMatch[2]}`
    };
  }

  throw new Error(`Invalid identifier format: ${input}. Expected P1BBY-QLID0000000001 or QLID0000000001`);
}

/**
 * Build full barcode string from palletId and qlid
 */
export function buildBarcode(palletId: string, qlid: string): string {
  return `${palletId}-${qlid}`;
}

/**
 * Validate QLID format
 */
export function isValidQlid(qlid: string): boolean {
  return /^QLID[A-Z]*\d{10}$/.test(qlid);
}

/**
 * Validate barcode format
 */
export function isValidBarcode(barcode: string): boolean {
  return /^[A-Z0-9]+-QLID[A-Z]*\d{10}$/.test(barcode);
}

/**
 * Generate a UUID (works for both SQLite and Postgres)
 */
export function generateUUID(): string {
  return randomUUID();
}

// ==================== SCHEMA INITIALIZATION ====================

export async function initializeDatabase(): Promise<void> {
  const db = getDb();
  const dbType = process.env.DB_TYPE || 'sqlite';
  const isPostgres = dbType === 'postgres';

  if (isPostgres) {
    // Postgres-specific initialization
    await initializePostgres(db);
  } else {
    // SQLite-specific initialization
    await initializeSQLite(db);
  }

  console.log(`Database initialized successfully (${dbType})`);
}

async function initializePostgres(db: DatabaseAdapter): Promise<void> {
  // Create sequences
  await db.query(`
    CREATE SEQUENCE IF NOT EXISTS qlid_sequence
    START WITH 1 INCREMENT BY 1 NO MAXVALUE NO CYCLE
  `);

  await db.query(`
    CREATE SEQUENCE IF NOT EXISTS ticket_sequence
    START WITH 1 INCREMENT BY 1 NO MAXVALUE NO CYCLE
  `);

  await db.query(`
    CREATE SEQUENCE IF NOT EXISTS pallet_sequence
    START WITH 1 INCREMENT BY 1 NO MAXVALUE NO CYCLE
  `);

  // Create pallets table
  await db.query(`
    CREATE TABLE IF NOT EXISTS pallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pallet_id TEXT UNIQUE NOT NULL,
      retailer TEXT NOT NULL,
      liquidation_source TEXT NOT NULL,
      source_pallet_id TEXT,
      source_order_id TEXT,
      source_manifest_url TEXT,
      purchase_date DATE,
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

  await db.query(`CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pallets_retailer ON pallets(retailer)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pallets_source ON pallets(liquidation_source)`);

  // Create items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS refurb_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid_tick BIGINT UNIQUE NOT NULL,
      qlid TEXT UNIQUE NOT NULL,
      qr_pallet_id TEXT REFERENCES pallets(pallet_id),
      pallet_id TEXT NOT NULL,
      barcode_value TEXT GENERATED ALWAYS AS (pallet_id || '-' || qlid) STORED,
      intake_employee_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      intake_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      serial_number TEXT,
      current_stage TEXT NOT NULL DEFAULT 'INTAKE',
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      assigned_technician_id TEXT,
      unit_cogs NUMERIC,
      final_grade TEXT,
      estimated_value NUMERIC,
      next_workflow TEXT,
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_pallet_id ON refurb_items(pallet_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_current_stage ON refurb_items(current_stage)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_qlid ON refurb_items(qlid)`);

  // Create stage history
  await db.query(`
    CREATE TABLE IF NOT EXISTS stage_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT NOT NULL REFERENCES refurb_items(qlid),
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      technician_id TEXT,
      technician_name TEXT,
      duration_minutes INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Create tickets
  await db.query(`
    CREATE TABLE IF NOT EXISTS repair_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_number TEXT UNIQUE NOT NULL,
      qlid TEXT NOT NULL REFERENCES refurb_items(qlid),
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

  // Create parts inventory
  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_inventory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      part_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      compatible_categories TEXT[],
      compatible_manufacturers TEXT[],
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

  // Create parts usage
  await db.query(`
    CREATE TABLE IF NOT EXISTS parts_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qlid TEXT NOT NULL REFERENCES refurb_items(qlid),
      ticket_id UUID REFERENCES repair_tickets(id),
      ticket_number TEXT,
      part_id UUID NOT NULL REFERENCES parts_inventory(id),
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

  // Create technicians
  await db.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specialties TEXT[],
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function initializeSQLite(db: DatabaseAdapter): Promise<void> {
  // Create sequence tables for SQLite
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

  // Create pallets table (SQLite version)
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

  await db.query(`CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets(status)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pallets_retailer ON pallets(retailer)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pallets_source ON pallets(liquidation_source)`);

  // Create items table (SQLite version)
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

  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_pallet_id ON refurb_items(pallet_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_current_stage ON refurb_items(current_stage)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_items_qlid ON refurb_items(qlid)`);

  // Create stage history
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

  // Create tickets
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

  // Create parts inventory (arrays stored as JSON)
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

  // Create parts usage
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
      FOREIGN KEY (qlid) REFERENCES refurb_items(qlid),
      FOREIGN KEY (part_id) REFERENCES parts_inventory(id)
    )
  `);

  // Create technicians (arrays stored as JSON)
  await db.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specialties TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
