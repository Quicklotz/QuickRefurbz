/**
 * QuickRefurbz - RFB Certification SKU
 *
 * Extended SKU format: RFB-{PalletID}-{QLID}Z-{Grade}-R{Rack}S{Shelf}
 * Example: RFB-P1BBY-QLID100001Z-A-R14S06
 *
 * Components:
 *   RFB       = Refurbished prefix
 *   P1BBY     = Pallet ID (from intake)
 *   QLID100001Z = Item QLID + Z terminator (prevents grade confusion)
 *   A         = Final grade (A/B/C/D/F)
 *   R14S06    = Rack 14, Shelf 06
 */

import type { FinalGrade } from './types.js';

export interface RfbCertificationSKU {
  prefix: 'RFB';
  palletId: string;
  qlid: string;
  grade: FinalGrade;
  rack: number;
  shelf: number;
  full: string;
}

/**
 * Build an RFB Certification SKU
 */
export function buildRfbCertificationSKU(opts: {
  palletId: string;
  qlid: string;
  grade: FinalGrade;
  rack: number;
  shelf: number;
}): string {
  const { palletId, qlid, grade, rack, shelf } = opts;
  const rackStr = `R${rack.toString().padStart(2, '0')}`;
  const shelfStr = `S${shelf.toString().padStart(2, '0')}`;
  return `RFB-${palletId}-${qlid}Z-${grade}-${rackStr}${shelfStr}`;
}

/**
 * Parse an RFB Certification SKU back into components
 * Returns null if the string doesn't match the expected format
 */
export function parseRfbCertificationSKU(sku: string): RfbCertificationSKU | null {
  // RFB-P1BBY-QLID000000001Z-A-R14S06
  const match = sku.match(
    /^(RFB)-(P\d+[A-Z]{3})-(QLID\d{9})Z-([ABCDF])-R(\d{2})S(\d{2})$/
  );
  if (!match) return null;

  return {
    prefix: 'RFB',
    palletId: match[2],
    qlid: match[3],
    grade: match[4] as FinalGrade,
    rack: parseInt(match[5], 10),
    shelf: parseInt(match[6], 10),
    full: sku,
  };
}
