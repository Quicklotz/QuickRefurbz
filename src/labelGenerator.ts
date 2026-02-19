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
  '1x3':   { widthMm: 25.4, heightMm: 76.2, dpi: 203, name: '1" x 3"' },
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

export type PalletLabelSize = '2x1' | '4x6';

export interface PalletLabelData {
  palletId: string;
  retailer: string;
  liquidationSource: string;
  receivedItems: number;
  expectedItems: number;
  warehouseId?: string;
  dateReceived?: Date;
}

/**
 * Generate a pallet-only label (no QLID)
 * @param labelSize - '2x1' for small labels, '4x6' for warehouse thermal labels (default)
 */
export async function generatePalletLabel(
  pallet: PalletLabelData,
  labelSize: PalletLabelSize = '4x6'
): Promise<{ png: Buffer; zpl: string }> {
  // Scale barcode parameters based on label size
  const is4x6 = labelSize === '4x6';

  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: pallet.palletId,
    scale: is4x6 ? 6 : 4,
    height: is4x6 ? 30 : 15,
    includetext: true,
    textxalign: 'center',
    textsize: is4x6 ? 16 : 12,
    paddingwidth: is4x6 ? 8 : 4,
    paddingheight: is4x6 ? 8 : 4,
  });

  const zpl = labelSize === '4x6'
    ? generatePalletZPL4x6(pallet)
    : generatePalletZPL(pallet);

  return { png, zpl };
}

/**
 * Generate ZPL for pallet-only label (small 2x1 format)
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
 * Generate ZPL for 4" x 6" pallet label at 203 DPI (812 x 1218 dots)
 * Designed for warehouse thermal printers - large barcode scannable from arm's length
 *
 * Layout (top to bottom):
 *  - Large PalletID header text (bold, centered)
 *  - Horizontal rule
 *  - Large Code128 barcode (centered, tall enough for easy scanning)
 *  - PalletID text under barcode (auto from ^BC)
 *  - Horizontal rule
 *  - Retailer name (large)
 *  - Liquidation source
 *  - Expected items count
 *  - Date received
 *  - Warehouse ID (if present)
 */
export function generatePalletZPL4x6(pallet: PalletLabelData): string {
  const retailerName = RETAILER_DISPLAY[pallet.retailer as keyof typeof RETAILER_DISPLAY] || pallet.retailer;
  const sourceName = pallet.liquidationSource;
  const dateStr = pallet.dateReceived
    ? pallet.dateReceived.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const warehouseStr = pallet.warehouseId || '';

  // 4" x 6" at 203 DPI = 812 x 1218 dots
  const W = 812;

  // Calculate barcode width for centering (approximate)
  // ^BY4 = module width 4 dots; Code128 char ~11 modules; plus start/stop
  // For a typical 10-char pallet ID: ~11*10 + 35 start/stop = ~145 modules * 4 = 580 dots
  // Center offset: (812 - 580) / 2 ~ 116
  const barcodeX = 40; // left margin for barcode - slightly off-center-left looks better with ZPL

  return `
^XA
^CI28
^PW${W}
^LL1218
^FO30,30^A0N,64,64^FD${pallet.palletId}^FS
^FO30,100^GB752,3,3,B^FS
^FO${barcodeX},130^BY4,3.0^BCN,280,Y,N,N^FD${pallet.palletId}^FS
^FO30,460^GB752,3,3,B^FS
^FO30,490^A0N,52,52^FD${retailerName}^FS
^FO30,560^A0N,36,36^FDSource: ${sourceName}^FS
^FO30,620^A0N,40,40^FDExpected Items: ${pallet.expectedItems}^FS
^FO30,680^A0N,40,40^FDReceived Items: ${pallet.receivedItems}^FS
^FO30,750^A0N,36,36^FDDate: ${dateStr}^FS
${warehouseStr ? `^FO30,810^A0N,36,36^FDWarehouse: ${warehouseStr}^FS` : ''}
^FO30,880^GB752,3,3,B^FS
^FO30,910^A0N,28,28^FDQuickRefurbz - Scan to track^FS
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

export type RefurbLabelSize = '1x3' | '2x1.5' | '4x6';

/**
 * Generate a refurbished item label (RFB-QLID format)
 * Used when an item completes refurbishment and is certified
 * @param labelSize - '1x3' for intake QLID labels, '2x1.5' for small labels, '4x6' for warehouse thermal labels
 */
export async function generateRefurbLabel(
  item: RefurbLabelData,
  labelSize: RefurbLabelSize = '2x1.5'
): Promise<{ png: Buffer; zpl: string }> {
  const is4x6 = labelSize === '4x6';
  const is1x3 = labelSize === '1x3';

  // For 1x3 intake labels, barcode is PalletID-QLID; otherwise QSKU (RFB-QLID)
  const barcodeText = is1x3 && item.palletId
    ? `${item.palletId}-${item.qlid}`
    : item.qsku;

  // Generate Code128 barcode
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: barcodeText,
    scale: is4x6 ? 6 : is1x3 ? 3 : 4,
    height: is4x6 ? 25 : is1x3 ? 8 : 12,
    includetext: true,
    textxalign: 'center',
    textsize: is4x6 ? 14 : is1x3 ? 8 : 10,
    paddingwidth: is4x6 ? 8 : is1x3 ? 2 : 4,
    paddingheight: is4x6 ? 8 : is1x3 ? 2 : 4,
  });

  const zpl = is1x3
    ? generateRefurbZPL1x3(item)
    : labelSize === '4x6'
      ? generateRefurbZPL4x6(item)
      : generateRefurbZPL(item);

  return { png, zpl };
}

/**
 * Generate ZPL for 1" x 3" QLID intake label at 203 DPI (609 x 203 dots)
 * Simple label for intake identification: barcode + PalletID-QLID text + QLID text
 * No grade badges, QR codes, or warranty info.
 */
export function generateRefurbZPL1x3(item: RefurbLabelData): string {
  // 1" tall x 3" wide at 203 DPI = 203 dots tall x 609 dots wide
  const W = 609;
  const H = 203;

  const barcodeValue = item.palletId
    ? `${item.palletId}-${item.qlid}`
    : item.qlid;

  return `
^XA
^CI28
^PW${W}
^LL${H}
^FO15,10^BY2,3.0^BCN,100,N,N,N^FD${barcodeValue}^FS
^FO15,120^A0N,28,28^FD${barcodeValue}^FS
^FO15,155^A0N,24,24^FD${item.qlid}^FS
^XZ
`.trim();
}

/**
 * Generate ZPL for refurbished item label with enhanced grade badge
 * 2" x 1.5" label format at 203 DPI (406 x 305 dots)
 */
export function generateRefurbZPL(item: RefurbLabelData, widthDots?: number, heightDots?: number): string {
  const gradeDisplay = GRADE_DISPLAY[item.finalGrade] || item.finalGrade;
  const categoryDisplay = CATEGORY_DISPLAY[item.category] || item.category;
  const retailerDisplay = item.retailer ? (RETAILER_DISPLAY[item.retailer] || item.retailer) : '';
  const dateStr = item.completedAt.toISOString().split('T')[0];

  const w = widthDots || 406; // default 2" at 203 DPI
  const h = heightDots || 305; // default 1.5" at 203 DPI

  // QR code links to item lookup URL
  const qrData = item.certificationId
    ? `${process.env.PUBLIC_URL || 'https://quickrefurbz.com'}/verify/${item.certificationId}`
    : item.qsku;

  return `
^XA
^CI28
^PW${w}
^LL${h}
^FO20,10^A0N,24,24^FDREFURBISHED^FS
^FO340,10^GB56,56,56,B^FS
^FO348,14^FR^A0N,44,44^FD${item.finalGrade}^FS
${item.warrantyEligible ? `^FO340,72^GB56,22,2,B^FS\n^FO342,74^A0N,14,14^FDWARRANTY^FS` : ''}
^FO20,40^BY2,3.0^BCN,50,Y,N,N^FD${item.qsku}^FS
^FO20,105^A0N,18,18^FD${(item.manufacturer + ' ' + item.model).slice(0, 30)}^FS
^FO20,128^A0N,14,14^FD${categoryDisplay}${retailerDisplay ? ` | ${retailerDisplay}` : ''}^FS
^FO20,150^A0N,12,12^FD${dateStr}${item.serialNumber ? ` | S/N: ${item.serialNumber}` : ''}^FS
^FO20,170^A0N,10,10^FDGrade ${gradeDisplay} | ${item.certificationId || 'Pending Cert'}^FS
^FO300,100^BQN,2,3^FDLA,${qrData}^FS
^XZ
`.trim();
}

/**
 * Generate ZPL for 4" x 6" refurbished item label at 203 DPI (812 x 1218 dots)
 * Designed for warehouse thermal printers with larger text and barcode
 */
export function generateRefurbZPL4x6(item: RefurbLabelData): string {
  const gradeDisplay = GRADE_DISPLAY[item.finalGrade] || item.finalGrade;
  const categoryDisplay = CATEGORY_DISPLAY[item.category] || item.category;
  const retailerDisplay = item.retailer ? (RETAILER_DISPLAY[item.retailer] || item.retailer) : '';
  const dateStr = item.completedAt.toISOString().split('T')[0];

  const qrData = item.certificationId
    ? `${process.env.PUBLIC_URL || 'https://quickrefurbz.com'}/verify/${item.certificationId}`
    : item.qsku;

  // 4" x 6" at 203 DPI = 812 x 1218 dots
  return `
^XA
^CI28
^PW812
^LL1218
^FO30,30^A0N,48,48^FDREFURBISHED^FS
^FO650,20^GB130,130,130,B^FS
^FO670,30^FR^A0N,100,100^FD${item.finalGrade}^FS
${item.warrantyEligible ? `^FO640,160^GB150,40,2,B^FS\n^FO650,168^A0N,24,24^FDWARRANTY^FS` : ''}
^FO30,100^GB752,3,3,B^FS
^FO40,130^BY3,3.0^BCN,200,Y,N,N^FD${item.qsku}^FS
^FO30,380^GB752,3,3,B^FS
^FO30,410^A0N,44,44^FD${(item.manufacturer + ' ' + item.model).slice(0, 40)}^FS
^FO30,470^A0N,36,36^FD${categoryDisplay}${retailerDisplay ? ` | ${retailerDisplay}` : ''}^FS
^FO30,530^A0N,32,32^FDGrade: ${gradeDisplay}^FS
^FO30,580^A0N,28,28^FD${dateStr}${item.serialNumber ? ` | S/N: ${item.serialNumber}` : ''}^FS
^FO30,630^A0N,24,24^FD${item.certificationId || 'Pending Certification'}^FS
^FO550,410^BQN,2,6^FDLA,${qrData}^FS
^FO30,700^GB752,3,3,B^FS
^FO30,730^A0N,24,24^FDQuickRefurbz Certified^FS
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
