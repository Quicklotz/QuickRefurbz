/**
 * QuickRefurbz - Label Generator
 * Generates thermal labels with Code128 barcodes
 *
 * Barcode payload: {PalletID}-QLID{SERIES}{NNNNNNNNNN}
 * Human-readable: EmployeeID, WarehouseID, Timestamp (NOT in barcode)
 */

import bwipjs from 'bwip-js';
import type { LabelData } from './types.js';
import { getRetailerFromPalletId, RETAILER_CODE_DISPLAY } from './types.js';

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
function generateZPL(labelData: LabelData, widthDots: number, heightDots: number): string {
  const retailer = getRetailerFromPalletId(labelData.palletId);
  const retailerName = RETAILER_CODE_DISPLAY[retailer];
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
  const retailerName = RETAILER_CODE_DISPLAY[retailer];
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
