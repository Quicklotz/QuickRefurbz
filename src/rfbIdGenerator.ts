/**
 * QuickRefurbz - RFB ID Generator
 *
 * QuickIntakez-compatible ID system with RFB prefix for easy reintegration.
 *
 * Format:
 *   Pallet ID: P{num}{RetailerCode} (e.g., P1BBY, P2TGT)
 *   QLID: QLID{9 digits} (e.g., QLID000000001)
 *   Barcode: RFB-{PalletID}-{QLID} (e.g., RFB-P1BBY-QLID000000001)
 *
 * The RFB- prefix indicates the item was intaked through QuickRefurbz
 * rather than QuickIntakez, making it easy to identify origin and
 * merge data when integrating with the full WMS.
 */

import { getPool } from './database.js';
import type { Retailer, RetailerCode } from './types.js';
import { RETAILER_CODE, CODE_TO_RETAILER } from './types.js';

/**
 * Generate next QLID (QuickIntakez-compatible format)
 * Format: QLID{9 digits} (e.g., QLID000000001)
 * Global counter that never resets - same sequence as QuickIntakez
 */
export async function generateRfbQlid(): Promise<{ tick: bigint; qlid: string }> {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const db = getPool();

  let tick: bigint;

  if (dbType === 'postgres') {
    // Use shared QLID sequence (same as QuickIntakez)
    const result = await db.query<{ nextval: string }>(
      "SELECT nextval('qlid_sequence') as nextval"
    );
    tick = BigInt(result.rows[0].nextval);
  } else {
    // SQLite: use local sequence
    await db.query('INSERT INTO qlid_sequence (placeholder) VALUES (1)');
    const result = await db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    tick = BigInt(result.rows[0].id);
  }

  const qlid = `QLID${tick.toString().padStart(9, '0')}`;
  return { tick, qlid };
}

/**
 * Generate next RFB Pallet ID (QuickIntakez-compatible format)
 * Format: P{sequence}{RetailerCode} (e.g., P1BBY, P23TGT)
 *
 * @param retailer - The retailer enum (BESTBUY, TARGET, etc.)
 * @returns Pallet ID string
 */
export async function generateRfbPalletId(retailer: Retailer): Promise<string> {
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

  const retailerCode = RETAILER_CODE[retailer] || 'OTH';
  return `P${num}${retailerCode}`;
}

/**
 * Validate QLID format (QuickIntakez-compatible)
 * Valid: QLID000000001 (QLID + 9 digits)
 */
export function isValidRfbQlid(qlid: string): boolean {
  return /^QLID\d{9}$/.test(qlid);
}

/**
 * Validate Pallet ID format (QuickIntakez-compatible)
 * Valid: P1BBY, P23TGT, P100AMZ (P + number + 3-letter retailer code)
 */
export function isValidRfbPalletId(palletId: string): boolean {
  return /^P\d+[A-Z]{3}$/.test(palletId);
}

/**
 * Parse QLID to get numeric tick
 * QLID000000001 → 1
 */
export function parseRfbQlid(qlid: string): bigint | null {
  const match = qlid.match(/^QLID(\d{9})$/);
  if (!match) return null;
  return BigInt(parseInt(match[1], 10));
}

/**
 * Parse Pallet ID to get components
 * P1BBY → { sequence: 1, retailerCode: 'BBY', retailer: 'BESTBUY' }
 */
export function parseRfbPalletId(palletId: string): {
  sequence: number;
  retailerCode: RetailerCode;
  retailer: Retailer;
} | null {
  const match = palletId.match(/^P(\d+)([A-Z]{3})$/);
  if (!match) return null;

  const retailerCode = match[2] as RetailerCode;
  const retailer = CODE_TO_RETAILER[retailerCode] || 'OTHER';

  return {
    sequence: parseInt(match[1], 10),
    retailerCode,
    retailer
  };
}

/**
 * Build RFB barcode value for label
 * Format: RFB-{palletId}-{qlid}
 * Example: RFB-P1BBY-QLID000000001
 *
 * The RFB- prefix marks this as a QuickRefurbz-originated item
 */
export function buildRfbBarcode(palletId: string, qlid: string): string {
  return `RFB-${palletId}-${qlid}`;
}

/**
 * Parse RFB barcode to extract components
 * Input: RFB-P1BBY-QLID000000001
 * Output: { palletId: 'P1BBY', qlid: 'QLID000000001', retailerCode: 'BBY', isRfbOrigin: true }
 */
export function parseRfbBarcode(barcode: string): {
  palletId: string;
  qlid: string;
  retailerCode: RetailerCode;
  retailer: Retailer;
  isRfbOrigin: boolean;
} | null {
  // RFB format: RFB-P{num}{code}-QLID{9digits}
  const rfbMatch = barcode.match(/^RFB-(P\d+([A-Z]{3}))-(QLID\d{9})$/);
  if (rfbMatch) {
    const retailerCode = rfbMatch[2] as RetailerCode;
    return {
      palletId: rfbMatch[1],
      qlid: rfbMatch[3],
      retailerCode,
      retailer: CODE_TO_RETAILER[retailerCode] || 'OTHER',
      isRfbOrigin: true
    };
  }

  // Also accept QuickIntakez format (without RFB prefix) for compatibility
  const qiMatch = barcode.match(/^(P\d+([A-Z]{3}))-(QLID\d{9})$/);
  if (qiMatch) {
    const retailerCode = qiMatch[2] as RetailerCode;
    return {
      palletId: qiMatch[1],
      qlid: qiMatch[3],
      retailerCode,
      retailer: CODE_TO_RETAILER[retailerCode] || 'OTHER',
      isRfbOrigin: false
    };
  }

  return null;
}

/**
 * Check if barcode is valid RFB format
 * Valid: RFB-P1BBY-QLID000000001
 */
export function isValidRfbBarcode(barcode: string): boolean {
  return /^RFB-P\d+[A-Z]{3}-QLID\d{9}$/.test(barcode);
}

/**
 * Check if barcode is valid (accepts both RFB and QuickIntakez formats)
 */
export function isValidAnyBarcode(barcode: string): boolean {
  // RFB format: RFB-P1BBY-QLID000000001
  if (/^RFB-P\d+[A-Z]{3}-QLID\d{9}$/.test(barcode)) return true;
  // QuickIntakez format: P1BBY-QLID000000001
  if (/^P\d+[A-Z]{3}-QLID\d{9}$/.test(barcode)) return true;
  return false;
}

/**
 * Extract pallet ID from a barcode (works with both RFB and QuickIntakez formats)
 */
export function extractPalletFromBarcode(barcode: string): string | null {
  const parsed = parseRfbBarcode(barcode);
  return parsed?.palletId || null;
}

/**
 * Extract QLID from a barcode (works with both RFB and QuickIntakez formats)
 */
export function extractQlidFromBarcode(barcode: string): string | null {
  const parsed = parseRfbBarcode(barcode);
  return parsed?.qlid || null;
}

/**
 * Check if a barcode originated from QuickRefurbz
 */
export function isRfbOriginBarcode(barcode: string): boolean {
  return barcode.startsWith('RFB-');
}

// Legacy exports for backward compatibility
export { generateRfbQlid as generateRfbId };
export { parseRfbQlid as parseRfbId };
export { isValidRfbQlid as isValidRfbId };
