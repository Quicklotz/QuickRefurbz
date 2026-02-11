/**
 * QuickDiagnosticz - Label Generator
 * Generates thermal certification labels with barcodes and QR codes
 */

import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';
import {
  Certification,
  CertificationLabelData,
  LabelDimensions,
  STANDARD_LABEL,
  CERTIFICATION_LEVEL_COLOR,
  CERTIFICATION_LEVEL_DISPLAY,
} from './types.js';
import { getCertification, updateCertificationAssets } from './certificationManager.js';

// Labels directory
const LABELS_DIR = process.env.LABELS_DIR || path.join(process.cwd(), 'data', 'labels');

// Ensure labels directory exists
if (!existsSync(LABELS_DIR)) {
  mkdirSync(LABELS_DIR, { recursive: true });
}

/**
 * Generate certification label as PNG
 */
export async function generateCertificationLabel(
  certificationId: string,
  options?: {
    outputPath?: string;
    dimensions?: LabelDimensions;
  }
): Promise<string> {
  const certification = await getCertification(certificationId);
  if (!certification) {
    throw new Error(`Certification not found: ${certificationId}`);
  }

  const dimensions = options?.dimensions || STANDARD_LABEL;
  const { width, height } = dimensions;

  // Prepare label data
  const labelData: CertificationLabelData = {
    certificationId: certification.certificationId,
    qlid: certification.qlid,
    barcodeValue: certification.qlid, // Use QLID for barcode
    manufacturer: certification.manufacturer,
    model: certification.model,
    certificationLevel: certification.certificationLevel,
    certificationLevelDisplay: CERTIFICATION_LEVEL_DISPLAY[certification.certificationLevel],
    certifiedAt: certification.certifiedAt,
    technicianId: certification.certifiedBy,
    qrCodeUrl: certification.publicReportUrl || '',
  };

  // Generate barcode
  const barcodeBuffer = await generateBarcode(labelData.barcodeValue);
  const barcodeDataUrl = `data:image/png;base64,${barcodeBuffer.toString('base64')}`;

  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL(labelData.qrCodeUrl, {
    width: 60,
    margin: 0,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  // Get certification level color
  const levelColor = CERTIFICATION_LEVEL_COLOR[labelData.certificationLevel];

  // Format date
  const dateStr = formatDate(labelData.certifiedAt);

  // Truncate model name if too long
  const maxModelLength = 28;
  const displayModel = labelData.model.length > maxModelLength
    ? labelData.model.substring(0, maxModelLength - 3) + '...'
    : labelData.model;

  const deviceName = `${labelData.manufacturer} ${displayModel}`;

  // Build SVG
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .title { font-family: Arial, sans-serif; font-weight: bold; }
          .text { font-family: Arial, sans-serif; }
          .small { font-family: Arial, sans-serif; font-size: 9px; }
        </style>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" fill="white"/>

      <!-- Certification Badge (left side) -->
      <rect x="4" y="4" width="80" height="20" rx="3" fill="${levelColor}"/>
      <text x="44" y="17" class="title" fill="white" font-size="9" text-anchor="middle">
        ${labelData.certificationLevel === 'NOT_CERTIFIED' ? 'NOT CERT' : labelData.certificationLevel}
      </text>

      <!-- UPSCALED CERTIFIED text -->
      <text x="90" y="16" class="title" fill="#333333" font-size="10">
        UPSCALED CERTIFIED
      </text>

      <!-- QR Code placeholder area (right) -->
      <rect x="${width - 68}" y="4" width="64" height="64" fill="white" stroke="#e5e5e5"/>
      <image x="${width - 66}" y="6" width="60" height="60" href="${qrCodeDataUrl}"/>

      <!-- Barcode -->
      <image x="4" y="28" width="260" height="35" href="${barcodeDataUrl}" preserveAspectRatio="xMinYMid meet"/>

      <!-- QLID under barcode -->
      <text x="134" y="72" class="text" fill="#333333" font-size="9" text-anchor="middle">
        ${labelData.qlid}
      </text>

      <!-- Device Name -->
      <text x="4" y="88" class="title" fill="#111111" font-size="11">
        ${escapeXml(deviceName)}
      </text>

      <!-- Bottom row: Grade, Cert ID, Date, Tech -->
      <text x="4" y="102" class="small" fill="#666666">
        GRADE: ${labelData.certificationLevel}
      </text>
      <text x="80" y="102" class="small" fill="#666666">
        CERT: ${labelData.certificationId}
      </text>

      <!-- Date and Tech ID on bottom line -->
      <text x="4" y="114" class="small" fill="#888888">
        Tested: ${dateStr}
      </text>
      <text x="120" y="114" class="small" fill="#888888">
        Tech: ${labelData.technicianId}
      </text>

      <!-- Divider line -->
      <line x1="4" y1="95" x2="${width - 72}" y2="95" stroke="#e5e5e5" stroke-width="0.5"/>

    </svg>
  `;

  // Convert SVG to PNG
  const outputPath = options?.outputPath ||
    path.join(LABELS_DIR, `${certification.certificationId}-label.png`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);

  // Update certification with label URL
  await updateCertificationAssets(certification.id, {
    labelPngUrl: outputPath,
  });

  return outputPath;
}

/**
 * Generate label as buffer (for direct printing)
 */
export async function generateCertificationLabelBuffer(
  certificationId: string,
  dimensions?: LabelDimensions
): Promise<Buffer> {
  const certification = await getCertification(certificationId);
  if (!certification) {
    throw new Error(`Certification not found: ${certificationId}`);
  }

  const { width, height } = dimensions || STANDARD_LABEL;

  const labelData: CertificationLabelData = {
    certificationId: certification.certificationId,
    qlid: certification.qlid,
    barcodeValue: certification.qlid,
    manufacturer: certification.manufacturer,
    model: certification.model,
    certificationLevel: certification.certificationLevel,
    certificationLevelDisplay: CERTIFICATION_LEVEL_DISPLAY[certification.certificationLevel],
    certifiedAt: certification.certifiedAt,
    technicianId: certification.certifiedBy,
    qrCodeUrl: certification.publicReportUrl || '',
  };

  const barcodeBuffer = await generateBarcode(labelData.barcodeValue);
  const barcodeDataUrl = `data:image/png;base64,${barcodeBuffer.toString('base64')}`;

  const qrCodeDataUrl = await QRCode.toDataURL(labelData.qrCodeUrl, {
    width: 60,
    margin: 0,
  });

  const levelColor = CERTIFICATION_LEVEL_COLOR[labelData.certificationLevel];
  const dateStr = formatDate(labelData.certifiedAt);

  const maxModelLength = 28;
  const displayModel = labelData.model.length > maxModelLength
    ? labelData.model.substring(0, maxModelLength - 3) + '...'
    : labelData.model;

  const deviceName = `${labelData.manufacturer} ${displayModel}`;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="white"/>
      <rect x="4" y="4" width="80" height="20" rx="3" fill="${levelColor}"/>
      <text x="44" y="17" font-family="Arial" font-weight="bold" fill="white" font-size="9" text-anchor="middle">
        ${labelData.certificationLevel === 'NOT_CERTIFIED' ? 'NOT CERT' : labelData.certificationLevel}
      </text>
      <text x="90" y="16" font-family="Arial" font-weight="bold" fill="#333333" font-size="10">
        UPSCALED CERTIFIED
      </text>
      <rect x="${width - 68}" y="4" width="64" height="64" fill="white" stroke="#e5e5e5"/>
      <image x="${width - 66}" y="6" width="60" height="60" href="${qrCodeDataUrl}"/>
      <image x="4" y="28" width="260" height="35" href="${barcodeDataUrl}" preserveAspectRatio="xMinYMid meet"/>
      <text x="134" y="72" font-family="Arial" fill="#333333" font-size="9" text-anchor="middle">
        ${labelData.qlid}
      </text>
      <text x="4" y="88" font-family="Arial" font-weight="bold" fill="#111111" font-size="11">
        ${escapeXml(deviceName)}
      </text>
      <line x1="4" y1="95" x2="${width - 72}" y2="95" stroke="#e5e5e5" stroke-width="0.5"/>
      <text x="4" y="102" font-family="Arial" fill="#666666" font-size="9">
        GRADE: ${labelData.certificationLevel}
      </text>
      <text x="80" y="102" font-family="Arial" fill="#666666" font-size="9">
        CERT: ${labelData.certificationId}
      </text>
      <text x="4" y="114" font-family="Arial" fill="#888888" font-size="9">
        Tested: ${dateStr}
      </text>
      <text x="120" y="114" font-family="Arial" fill="#888888" font-size="9">
        Tech: ${labelData.technicianId}
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generate label as data URL (for web display)
 */
export async function generateCertificationLabelDataUrl(
  certificationId: string
): Promise<string> {
  const buffer = await generateCertificationLabelBuffer(certificationId);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/**
 * Get label dimensions
 */
export function getLabelDimensions(): LabelDimensions {
  return STANDARD_LABEL;
}

/**
 * Get labels directory path
 */
export function getLabelsDir(): string {
  return LABELS_DIR;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate Code128 barcode
 */
async function generateBarcode(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: text,
    scale: 2,
    height: 10,
    includetext: false,
    textxalign: 'center',
  });
}

/**
 * Format date for label
 */
function formatDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
