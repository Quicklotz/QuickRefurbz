/**
 * Sequence Generators for QuickWMS
 * QLID, Internal Pallet IDs, and other identifiers
 */

import { query } from './connection.js';

// ============================================
// QLID Generation (QLID000000001 format)
// ============================================

/**
 * Generate a new unique QLID
 * Format: QLID[SERIES][9-DIGIT-COUNTER]
 * Examples: QLID000000001, QLIDA000000001
 */
export async function generateQLID(): Promise<string> {
  const result = await query(
    `SELECT nextval('public.qlid_sequence') as seq_val`
  );

  const seqVal = BigInt(result.rows[0].seq_val);
  const maxPerSeries = BigInt(999999999);

  let seriesLetter = '';
  let counterPart: string;

  if (seqVal <= maxPerSeries) {
    counterPart = seqVal.toString().padStart(9, '0');
  } else {
    // Calculate series letter (A=1, B=2, etc.)
    const seriesNum = Number((seqVal - BigInt(1)) / maxPerSeries);
    seriesLetter = String.fromCharCode(64 + seriesNum);
    const remainder = ((seqVal - BigInt(1)) % maxPerSeries) + BigInt(1);
    counterPart = remainder.toString().padStart(9, '0');
  }

  return `QLID${seriesLetter}${counterPart}`;
}

/**
 * Generate multiple QLIDs at once (batch operation)
 */
export async function generateQLIDBatch(count: number): Promise<string[]> {
  if (count <= 0) return [];

  const result = await query(
    `SELECT nextval('public.qlid_sequence') as seq_val FROM generate_series(1, $1)`,
    [count]
  );

  const maxPerSeries = BigInt(999999999);

  return result.rows.map((row: any) => {
    const seqVal = BigInt(row.seq_val);

    let seriesLetter = '';
    let counterPart: string;

    if (seqVal <= maxPerSeries) {
      counterPart = seqVal.toString().padStart(9, '0');
    } else {
      const seriesNum = Number((seqVal - BigInt(1)) / maxPerSeries);
      seriesLetter = String.fromCharCode(64 + seriesNum);
      const remainder = ((seqVal - BigInt(1)) % maxPerSeries) + BigInt(1);
      counterPart = remainder.toString().padStart(9, '0');
    }

    return `QLID${seriesLetter}${counterPart}`;
  });
}

/**
 * Parse a QLID into its components
 */
export function parseQLID(qlid: string): {
  isValid: boolean;
  series: string;
  counter: bigint;
  sequential: bigint;
} {
  const match = qlid.match(/^QLID([A-Z]?)(\d{9,10})$/);

  if (!match) {
    return {
      isValid: false,
      series: '',
      counter: BigInt(0),
      sequential: BigInt(0),
    };
  }

  const series = match[1] || '';
  const counter = BigInt(match[2]);

  // Calculate sequential number
  let sequential: bigint;
  if (series === '') {
    sequential = counter;
  } else {
    const seriesNum = BigInt(series.charCodeAt(0) - 64);
    const maxPerSeries = BigInt(999999999);
    sequential = seriesNum * maxPerSeries + counter;
  }

  return {
    isValid: true,
    series,
    counter,
    sequential,
  };
}

/**
 * Validate a QLID format
 */
export function isValidQLID(qlid: string): boolean {
  return /^QLID[A-Z]?\d{9,10}$/.test(qlid);
}

// ============================================
// Internal Pallet ID Generation (P1BBY format)
// ============================================

/**
 * Generate internal pallet ID
 * Format: P[sequence][supplier_code]
 * Example: P1BBY, P2TL, P3QL
 */
export async function generateInternalPalletId(supplierCode: string = 'XX'): Promise<string> {
  // Normalize supplier code to 2-3 uppercase letters
  const code = supplierCode.toUpperCase().substring(0, 3);

  const result = await query(
    `SELECT nextval('public.pallet_sequence') as seq_val`
  );

  const seqVal = result.rows[0].seq_val;
  return `P${seqVal}${code}`;
}

/**
 * Generate pallet ID with date prefix
 * Format: YYYYMMDD-P[sequence][supplier_code]
 */
export async function generateDatedPalletId(supplierCode: string = 'XX'): Promise<string> {
  const code = supplierCode.toUpperCase().substring(0, 3);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const result = await query(
    `SELECT nextval('public.pallet_sequence') as seq_val`
  );

  const seqVal = result.rows[0].seq_val;
  return `${dateStr}-P${seqVal}${code}`;
}

/**
 * Parse internal pallet ID
 */
export function parseInternalPalletId(palletId: string): {
  isValid: boolean;
  sequence: number;
  supplierCode: string;
  date?: string;
} {
  // Try dated format first: YYYYMMDD-P1BBY
  const datedMatch = palletId.match(/^(\d{8})-P(\d+)([A-Z]{2,3})$/);
  if (datedMatch) {
    return {
      isValid: true,
      date: datedMatch[1],
      sequence: parseInt(datedMatch[2], 10),
      supplierCode: datedMatch[3],
    };
  }

  // Try simple format: P1BBY
  const simpleMatch = palletId.match(/^P(\d+)([A-Z]{2,3})$/);
  if (simpleMatch) {
    return {
      isValid: true,
      sequence: parseInt(simpleMatch[1], 10),
      supplierCode: simpleMatch[2],
    };
  }

  return {
    isValid: false,
    sequence: 0,
    supplierCode: '',
  };
}

/**
 * Validate internal pallet ID format
 */
export function isValidInternalPalletId(palletId: string): boolean {
  return /^(\d{8}-)?P\d+[A-Z]{2,3}$/.test(palletId);
}

// ============================================
// Session ID Generation
// ============================================

/**
 * Generate receiving session ID
 * Format: RCV-YYYYMMDD-HHMMSS-[random]
 */
export function generateSessionId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `RCV-${dateStr}-${timeStr}-${random}`;
}

// ============================================
// Manifest ID Generation
// ============================================

/**
 * Generate manifest ID
 * Format: MAN-[supplier_code]-YYYYMMDD-[sequence]
 */
export async function generateManifestId(supplierCode: string = 'XX'): Promise<string> {
  const code = supplierCode.toUpperCase().substring(0, 3);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const result = await query(
    `SELECT nextval('public.manifest_sequence') as seq_val`
  );

  const seqVal = result.rows[0].seq_val.toString().padStart(4, '0');
  return `MAN-${code}-${dateStr}-${seqVal}`;
}

// ============================================
// Order ID Generation
// ============================================

/**
 * Generate order ID
 * Format: ORD-[type_prefix]-YYYYMMDD-[sequence]
 */
export async function generateOrderId(type: 'purchase' | 'sale' | 'transfer' | 'return' = 'purchase'): Promise<string> {
  const typePrefix: Record<string, string> = {
    purchase: 'PO',
    sale: 'SO',
    transfer: 'TR',
    return: 'RT',
  };

  const prefix = typePrefix[type] || 'ORD';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const result = await query(
    `SELECT nextval('public.order_sequence') as seq_val`
  );

  const seqVal = result.rows[0].seq_val.toString().padStart(4, '0');
  return `${prefix}-${dateStr}-${seqVal}`;
}

// ============================================
// Supplier ID Generation
// ============================================

/**
 * Generate supplier ID
 * Format: SUP-[code]-[sequence]
 */
export async function generateSupplierId(code: string): Promise<string> {
  const supplierCode = code.toUpperCase().substring(0, 3);

  const result = await query(
    `SELECT nextval('public.supplier_sequence') as seq_val`
  );

  const seqVal = result.rows[0].seq_val.toString().padStart(4, '0');
  return `SUP-${supplierCode}-${seqVal}`;
}

// ============================================
// Barcode Utilities
// ============================================

/**
 * Generate a barcode string for an item
 * Format: [PALLET_ID]-QLID[SERIES][COUNTER] or just QLID
 */
export function generateBarcodeString(qlid: string, palletId?: string): string {
  if (palletId) {
    return `${palletId}-${qlid}`;
  }
  return qlid;
}

/**
 * Parse a barcode string back to QLID and pallet
 */
export function parseBarcodeString(barcode: string): {
  qlid: string;
  palletId?: string;
} {
  const parts = barcode.split('-');

  if (parts.length === 1) {
    return { qlid: barcode };
  }

  // Check if last part is a QLID
  const lastPart = parts[parts.length - 1];
  if (isValidQLID(lastPart)) {
    return {
      qlid: lastPart,
      palletId: parts.slice(0, -1).join('-'),
    };
  }

  // The whole thing might be a QLID
  if (isValidQLID(barcode)) {
    return { qlid: barcode };
  }

  return { qlid: barcode };
}

// ============================================
// Sequence Initialization
// ============================================

/**
 * Ensure all required sequences exist in the database
 */
export async function ensureSequences(): Promise<void> {
  const sequences = [
    'qlid_sequence',
    'pallet_sequence',
    'manifest_sequence',
    'order_sequence',
    'supplier_sequence',
    'session_sequence',
  ];

  for (const seq of sequences) {
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = '${seq}') THEN
          CREATE SEQUENCE public.${seq} START 1;
        END IF;
      END $$;
    `);
  }
}

/**
 * Get current sequence values (for diagnostics)
 */
export async function getSequenceValues(): Promise<Record<string, bigint>> {
  const sequences = [
    'qlid_sequence',
    'pallet_sequence',
    'manifest_sequence',
    'order_sequence',
    'supplier_sequence',
  ];

  const values: Record<string, bigint> = {};

  for (const seq of sequences) {
    try {
      const result = await query(`SELECT last_value FROM public.${seq}`);
      values[seq] = BigInt(result.rows[0].last_value);
    } catch {
      values[seq] = BigInt(0);
    }
  }

  return values;
}
