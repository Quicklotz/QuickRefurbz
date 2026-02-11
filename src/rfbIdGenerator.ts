/**
 * QuickRefurbz - RFB ID Generator
 *
 * Standalone ID system for QuickRefurbz
 * Format: RFB{6 digits} starting at 100001
 * Examples: RFB100001, RFB100002, RFB100003...
 *
 * This is a standalone system that doesn't depend on QuickIntakez
 */

import { getPool } from './database.js';

const RFB_START = 100001;

/**
 * Generate next RFB ID
 * Format: RFB{6 digits} (e.g., RFB100001)
 * Counter starts at 100001 and never resets
 */
export async function generateRfbId(): Promise<{ tick: number; rfbId: string }> {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const db = getPool();

  let tick: number;

  if (dbType === 'postgres') {
    // Get next value from sequence
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('rfb_id_sequence') as nextval"
    );
    tick = parseInt(result.rows[0].nextval);
  } else {
    // SQLite: use local sequence
    await db.query('INSERT INTO rfb_id_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    // Add offset to start at 100001
    tick = result.rows[0].id + RFB_START - 1;
  }

  const rfbId = `RFB${tick.toString().padStart(6, '0')}`;
  return { tick, rfbId };
}

/**
 * Generate next RFB Pallet ID
 * Format: RFB-P-{4 digits} (e.g., RFB-P-0001)
 */
export async function generateRfbPalletId(): Promise<string> {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const db = getPool();

  let num: number;

  if (dbType === 'postgres') {
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('rfb_pallet_sequence') as nextval"
    );
    num = parseInt(result.rows[0].nextval);
  } else {
    await db.query('INSERT INTO rfb_pallet_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    num = result.rows[0].id;
  }

  return `RFB-P-${num.toString().padStart(4, '0')}`;
}

/**
 * Validate RFB ID format
 * Valid: RFB100001 through RFB999999
 */
export function isValidRfbId(rfbId: string): boolean {
  return /^RFB\d{6}$/.test(rfbId);
}

/**
 * Validate RFB Pallet ID format
 * Valid: RFB-P-0001 through RFB-P-9999
 */
export function isValidRfbPalletId(palletId: string): boolean {
  return /^RFB-P-\d{4}$/.test(palletId);
}

/**
 * Parse RFB ID to get numeric tick
 */
export function parseRfbId(rfbId: string): number | null {
  const match = rfbId.match(/^RFB(\d{6})$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Build barcode value for label
 * Format: {palletId}-{rfbId}
 * Example: RFB-P-0001-RFB100001
 */
export function buildRfbBarcode(palletId: string, rfbId: string): string {
  return `${palletId}-${rfbId}`;
}

/**
 * Parse RFB barcode
 * Input: RFB-P-0001-RFB100001
 * Output: { palletId: 'RFB-P-0001', rfbId: 'RFB100001' }
 */
export function parseRfbBarcode(barcode: string): { palletId: string; rfbId: string } | null {
  // Format: RFB-P-XXXX-RFBXXXXXX
  const match = barcode.match(/^(RFB-P-\d{4})-(RFB\d{6})$/);
  if (!match) return null;
  return {
    palletId: match[1],
    rfbId: match[2]
  };
}

/**
 * Check if barcode is valid RFB format
 */
export function isValidRfbBarcode(barcode: string): boolean {
  return /^RFB-P-\d{4}-RFB\d{6}$/.test(barcode);
}
