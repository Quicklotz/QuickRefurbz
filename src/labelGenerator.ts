/**
 * QuickRefurbz - Label Generator
 * Generates thermal labels with Code128 barcodes
 *
 * Barcode payload: {PalletID}-QLID{SERIES}{NNNNNNNNNN}
 * Human-readable: EmployeeID, WarehouseID, Timestamp (NOT in barcode)
 */

import bwipjs from 'bwip-js';
import type { LabelData, RefurbLabelData } from './types.js';
import { getRetailerFromPalletId, RETAILER_DISPLAY, GRADE_DISPLAY, CATEGORY_DISPLAY } from './types.js';

export const LABEL_PRESETS: Record<string, { widthMm: number; heightMm: number; dpi: number; name: string }> = {
  '2x1':   { widthMm: 50.8, heightMm: 25.4, dpi: 203, name: '2" x 1"' },
  '2x1.5': { widthMm: 50.8, heightMm: 38.1, dpi: 203, name: '2" x 1.5"' },
  '4x2':   { widthMm: 101.6, heightMm: 50.8, dpi: 203, name: '4" x 2"' },
  '4x6':   { widthMm: 101.6, heightMm: 152.4, dpi: 203, name: '4" x 6"' },
};

export interface LabelOptions {
  width?: number;      // Label width in mm (default: 50)
  height?: number;     // Label height in mm (default: 25)
  dpi?: number;        // Dots per inch (default: 203 for thermal)
}

export interface GeneratedLabel {
  png: Buffer;
  zpl?: string;        // Zebra Programming Language (for ZPL printers)
  labelData: LabelData;
}

/**
 * Generate a label PNG with Code128 barcode
 */
export async function generateLabel(
  labelData: LabelData,
  options: LabelOptions = {}
): Promise<GeneratedLabel> {
  const width = options.width || 50;
  const height = options.height || 25;
  const dpi = options.dpi || 203;

  // Convert mm to pixels at given DPI
  const widthPx = Math.round((width / 25.4) * dpi);
  const heightPx = Math.round((height / 25.4) * dpi);

  // Generate Code128 barcode as PNG
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: labelData.barcodeValue,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
    textsize: 8,
    paddingwidth: 2,
    paddingheight: 2
  });

  // Generate ZPL for Zebra printers
  const zpl = generateZPL(labelData, widthPx, heightPx);

  return {
    png,
    zpl,
    labelData
  };
}

/**
 * Generate ZPL (Zebra Programming Language) for direct thermal printing
 */
export function generateZPL(labelData: LabelData, widthDots: number, heightDots: number): string {
  const retailer = getRetailerFromPalletId(labelData.palletId);
  const retailerName = RETAILER_DISPLAY[retailer];
  const timestamp = labelData.timestamp.toISOString().replace('T', ' ').slice(0, 19);

  // ZPL template for 2" x 1" label at 203 DPI
  return `
^XA
^FO10,10^A0N,20,20^FD${labelData.palletId} - ${retailerName}^FS
^FO10,35^BY2^BCN,50,Y,N,N^FD${labelData.barcodeValue}^FS
^FO10,100^A0N,16,16^FDEmployee: ${labelData.employeeId}^FS
^FO200,100^A0N,16,16^FDWH: ${labelData.warehouseId}^FS
^FO10,120^A0N,14,14^FD${timestamp}^FS
${labelData.manufacturer ? `^FO10,140^A0N,14,14^FD${labelData.manufacturer} ${labelData.model || ''}^FS` : ''}
^XZ
`.trim();
}

/**
 * Format label data for console/text output
 */
export function formatLabelText(labelData: LabelData): string {
  const retailer = getRetailerFromPalletId(labelData.palletId);
  const retailerName = RETAILER_DISPLAY[retailer];
  const timestamp = labelData.timestamp.toISOString().replace('T', ' ').slice(0, 19);

  const lines = [
    '┌────────────────────────────────────────────┐',
    `│ ${labelData.palletId} - ${retailerName.padEnd(30)}│`,
    '├────────────────────────────────────────────┤',
    `│ ║║║ ${labelData.barcodeValue.padEnd(36)}│`,
    '├────────────────────────────────────────────┤',
    `│ Employee: ${labelData.employeeId.padEnd(32)}│`,
    `│ Warehouse: ${labelData.warehouseId.padEnd(31)}│`,
    `│ ${timestamp.padEnd(42)}│`,
  ];

  if (labelData.manufacturer) {
    const product = `${labelData.manufacturer} ${labelData.model || ''}`.slice(0, 40);
    lines.push(`│ ${product.padEnd(42)}│`);
  }

  lines.push('└────────────────────────────────────────────┘');

  return lines.join('\n');
}

/**
 * Print label to console (for testing/preview)
 */
export function printLabelPreview(labelData: LabelData): void {
  console.log('\n' + formatLabelText(labelData) + '\n');
}

/**
 * Batch generate labels for multiple items
 */
export async function generateLabels(
  items: LabelData[],
  options: LabelOptions = {}
): Promise<GeneratedLabel[]> {
  const labels: GeneratedLabel[] = [];

  for (const item of items) {
    const label = await generateLabel(item, options);
    labels.push(label);
  }

  return labels;
}

/**
 * Export label data to CSV for external printing systems
 */
export function exportLabelsToCSV(labels: LabelData[]): string {
  const headers = ['Barcode', 'QLID', 'PalletID', 'EmployeeID', 'WarehouseID', 'Timestamp', 'Manufacturer', 'Model'];
  const rows = labels.map(l => [
    l.barcodeValue,
    l.qlid,
    l.palletId,
    l.employeeId,
    l.warehouseId,
    l.timestamp.toISOString(),
    l.manufacturer || '',
    l.model || ''
  ].map(v => `"${v}"`).join(','));

  return [headers.join(','), ...rows].join('\n');
}

// ==================== PALLET-ONLY LABELS ====================

export interface PalletLabelData {
  palletId: string;
  retailer: string;
  liquidationSource: string;
  receivedItems: number;
  expectedItems: number;
  warehouseId?: string;
}

/**
 * Generate a pallet-only label (no QLID)
 */
export async function generatePalletLabel(pallet: PalletLabelData): Promise<{ png: Buffer; zpl: string }> {
  const retailerName = RETAILER_DISPLAY[pallet.retailer as keyof typeof RETAILER_DISPLAY] || pallet.retailer;

  // Generate Code128 barcode with just palletId
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: pallet.palletId,
    scale: 4,
    height: 15,
    includetext: true,
    textxalign: 'center',
    textsize: 12,
    paddingwidth: 4,
    paddingheight: 4
  });

  const zpl = generatePalletZPL(pallet);

  return { png, zpl };
}

/**
 * Generate ZPL for pallet-only label
 */
export function generatePalletZPL(pallet: PalletLabelData, widthDots?: number, heightDots?: number): string {
  const retailerName = RETAILER_DISPLAY[pallet.retailer as keyof typeof RETAILER_DISPLAY] || pallet.retailer;
  const sourceName = pallet.liquidationSource;

  const w = widthDots || 406; // default 2" at 203 DPI
  const h = heightDots || 203; // default 1" at 203 DPI
  const sx = w / 406;
  const sy = h / 203;

  // ZPL for label at given size (default 2" x 1" at 203 DPI)
  return `
^XA
^FO${Math.round(20*sx)},${Math.round(15*sy)}^A0N,${Math.round(28*sy)},${Math.round(28*sx)}^FD${pallet.palletId}^FS
^FO${Math.round(20*sx)},${Math.round(50*sy)}^BY3^BCN,${Math.round(70*sy)},Y,N,N^FD${pallet.palletId}^FS
^FO${Math.round(20*sx)},${Math.round(135*sy)}^A0N,${Math.round(20*sy)},${Math.round(20*sx)}^FD${retailerName}^FS
^FO${Math.round(20*sx)},${Math.round(160*sy)}^A0N,${Math.round(18*sy)},${Math.round(18*sx)}^FD${sourceName}^FS
^FO${Math.round(20*sx)},${Math.round(185*sy)}^A0N,${Math.round(16*sy)},${Math.round(16*sx)}^FDItems: ${pallet.receivedItems} / ${pallet.expectedItems}^FS
^XZ
`.trim();
}

/**
 * Send ZPL to Zebra printer via TCP socket
 */
export async function sendZplToPrinter(printerIp: string, zpl: string): Promise<void> {
  const net = await import('net');

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    socket.connect(9100, printerIp, () => {
      socket.write(zpl);
      socket.end();
    });

    socket.on('close', () => resolve());
    socket.on('error', (err) => reject(err));

    // Timeout after 10 seconds
    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('Printer connection timeout'));
    });
  });
}

// ==================== REFURBISHED ITEM LABELS ====================

/**
 * Generate a refurbished item label (RFB-QLID format)
 * Used when an item completes refurbishment and is certified
 */
export async function generateRefurbLabel(item: RefurbLabelData): Promise<{ png: Buffer; zpl: string }> {
  // Generate Code128 barcode with QSKU (RFB-QLID format)
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: item.qsku,
    scale: 4,
    height: 12,
    includetext: true,
    textxalign: 'center',
    textsize: 10,
    paddingwidth: 4,
    paddingheight: 4
  });

  const zpl = generateRefurbZPL(item);

  return { png, zpl };
}

/**
 * Generate ZPL for refurbished item label with enhanced grade badge
 * 2" x 1.5" label format at 203 DPI
 */
export function generateRefurbZPL(item: RefurbLabelData, widthDots?: number, heightDots?: number): string {
  const gradeDisplay = GRADE_DISPLAY[item.finalGrade] || item.finalGrade;
  const categoryDisplay = CATEGORY_DISPLAY[item.category] || item.category;
  const retailerDisplay = item.retailer ? (RETAILER_DISPLAY[item.retailer] || item.retailer) : '';
  const warrantyText = item.warrantyEligible ? 'WARRANTY' : '';
  const dateStr = item.completedAt.toISOString().split('T')[0];

  const w = widthDots || 406; // default 2" at 203 DPI
  const h = heightDots || 305; // default 1.5" at 203 DPI
  const sx = w / 406;
  const sy = h / 305;

  // Grade badge - prominent box with grade letter
  const gradeBadge = `
^FO${Math.round(350*sx)},${Math.round(10*sy)}^GB${Math.round(50*sx)},${Math.round(50*sy)},${Math.round(50*sx)},B^FS
^FO${Math.round(350*sx)},${Math.round(10*sy)}^FR^A0N,${Math.round(44*sy)},${Math.round(44*sx)}^FW1^FD${item.finalGrade}^FS
  `.trim();

  // Warranty badge if eligible
  const warrantyBadge = item.warrantyEligible ? `
^FO${Math.round(350*sx)},${Math.round(70*sy)}^GB${Math.round(50*sx)},${Math.round(20*sy)},2,B^FS
^FO${Math.round(352*sx)},${Math.round(72*sy)}^A0N,${Math.round(14*sy)},${Math.round(14*sx)}^FDWARRANTY^FS
  `.trim() : '';

  // ZPL for label at given size (default 2" x 1.5" at 203 DPI) with QR code
  // QR code links to item lookup URL
  const qrData = item.certificationId
    ? `${process.env.PUBLIC_URL || 'https://quickrefurbz.com'}/verify/${item.certificationId}`
    : item.qsku;

  return `
^XA
^FO${Math.round(20*sx)},${Math.round(10*sy)}^A0N,${Math.round(24*sy)},${Math.round(24*sx)}^FDREFURBISHED^FS
${gradeBadge}
${warrantyBadge}
^FO${Math.round(20*sx)},${Math.round(40*sy)}^BY2,3.0^BCN,${Math.round(50*sy)},Y,N,N^FD${item.qsku}^FS
^FO${Math.round(20*sx)},${Math.round(105*sy)}^A0N,${Math.round(18*sy)},${Math.round(18*sx)}^FD${(item.manufacturer + ' ' + item.model).slice(0, 30)}^FS
^FO${Math.round(20*sx)},${Math.round(128*sy)}^A0N,${Math.round(14*sy)},${Math.round(14*sx)}^FD${categoryDisplay}${retailerDisplay ? ` | ${retailerDisplay}` : ''}^FS
^FO${Math.round(20*sx)},${Math.round(150*sy)}^A0N,${Math.round(12*sy)},${Math.round(12*sx)}^FD${dateStr}${item.serialNumber ? ` | S/N: ${item.serialNumber}` : ''}^FS
^FO${Math.round(20*sx)},${Math.round(170*sy)}^A0N,${Math.round(10*sy)},${Math.round(10*sx)}^FDGrade ${gradeDisplay} | ${item.certificationId || 'Pending Cert'}^FS
^FO${Math.round(300*sx)},${Math.round(100*sy)}^BQN,2,3^FDLA,${qrData}^FS
^XZ
`.trim();
}

/**
 * Generate enhanced refurb label with QR code
 */
export async function generateEnhancedRefurbLabel(item: RefurbLabelData): Promise<{
  png: Buffer;
  qrPng: Buffer;
  zpl: string;
}> {
  // Generate main Code128 barcode
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: item.qsku,
    scale: 4,
    height: 12,
    includetext: true,
    textxalign: 'center',
    textsize: 10,
    paddingwidth: 4,
    paddingheight: 4
  });

  // Generate QR code for quick lookup
  const qrData = item.certificationId
    ? `${process.env.PUBLIC_URL || 'https://quickrefurbz.com'}/verify/${item.certificationId}`
    : item.qsku;

  const qrPng = await bwipjs.toBuffer({
    bcid: 'qrcode',
    text: qrData,
    scale: 3,
    padding: 2
  } as any);

  const zpl = generateRefurbZPL(item);

  return { png, qrPng, zpl };
}

/**
 * Format refurb label data for console/text output (preview)
 */
export function formatRefurbLabelText(item: RefurbLabelData): string {
  const gradeDisplay = GRADE_DISPLAY[item.finalGrade] || item.finalGrade;
  const categoryDisplay = CATEGORY_DISPLAY[item.category] || item.category;
  const retailerDisplay = item.retailer ? (RETAILER_DISPLAY[item.retailer] || item.retailer) : '';
  const dateStr = item.completedAt.toISOString().split('T')[0];

  const lines = [
    '┌──────────────────────────────────────────────────┐',
    '│          ★ REFURBISHED ★                        │',
    '├──────────────────────────────────────────────────┤',
    `│ ║║║ ${item.qsku.padEnd(42)}│`,
    '├──────────────────────────────────────────────────┤',
    `│ ${(item.manufacturer + ' ' + item.model).slice(0, 46).padEnd(48)}│`,
    `│ ${categoryDisplay}${retailerDisplay ? ` | ${retailerDisplay}` : ''}`.slice(0, 50).padEnd(50) + '│',
    `│ Grade: ${gradeDisplay.padEnd(40)}│`,
    item.warrantyEligible ? '│ ✓ WARRANTY ELIGIBLE                              │' : '',
    `│ ${dateStr}${item.serialNumber ? ` | S/N: ${item.serialNumber}` : ''}`.slice(0, 50).padEnd(50) + '│',
    item.certificationId ? `│ Cert: ${item.certificationId.padEnd(42)}│` : '',
    '└──────────────────────────────────────────────────┘'
  ].filter(Boolean);

  return lines.join('\n');
}
