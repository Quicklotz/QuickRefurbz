/**
 * QLID (QuickLotz Item ID) Generation Utilities
 */

import { query } from '../connection.js';

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

/**
 * Generate a barcode string for an item
 * Format: [PALLET_ID]-QLID[SERIES][COUNTER]
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

  // Try joining last two parts as QLID
  if (parts.length >= 2) {
    const potentialQlid = parts.slice(-2).join('');
    if (isValidQLID(potentialQlid)) {
      return {
        qlid: potentialQlid,
        palletId: parts.slice(0, -2).join('-') || undefined,
      };
    }
  }

  return { qlid: barcode };
}
