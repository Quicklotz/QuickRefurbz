/**
 * QuickDiagnosticz - Report Generator
 * Generates PDF Device History Reports similar to PhoneCheck
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  Certification,
  CertificationCheck,
  DeviceHistoryReport,
  CERTIFICATION_LEVEL_COLOR,
  CERTIFICATION_LEVEL_DISPLAY,
  DEFAULT_TEMPLATE,
  UPSCALED_GUARANTEE,
} from './types.js';
import { getDeviceHistoryReport, updateCertificationAssets } from './certificationManager.js';

// Report directory
const REPORTS_DIR = process.env.REPORTS_DIR || path.join(process.cwd(), 'data', 'reports');

// Ensure reports directory exists
if (!existsSync(REPORTS_DIR)) {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Generate a Device History Report PDF
 */
export async function generateReportPdf(
  certificationId: string,
  options?: {
    outputPath?: string;
    template?: typeof DEFAULT_TEMPLATE;
  }
): Promise<string> {
  // Get full report data
  const reportData = await getDeviceHistoryReport(certificationId);
  if (!reportData) {
    throw new Error(`Certification not found: ${certificationId}`);
  }

  const template = options?.template || DEFAULT_TEMPLATE;
  const certification = reportData.certification;

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(certification.publicReportUrl || '', {
    width: 80,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  // Create output path
  const outputPath = options?.outputPath ||
    path.join(REPORTS_DIR, `${certification.certificationId}.pdf`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    // ==================== HEADER ====================

    // Logo/Brand area (left)
    doc.fontSize(24)
      .fillColor(template.primaryColor)
      .text('Upscaled', 50, 50);

    doc.fontSize(12)
      .fillColor('#666666')
      .text('Device History Report', 50, 78);

    // Certification ID and Date (right)
    const rightX = 400;
    doc.fontSize(10)
      .fillColor('#333333')
      .text(`ID: ${certification.certificationId}`, rightX, 50)
      .text(`Date: ${formatDate(certification.certifiedAt)}`, rightX, 65);

    // QR Code (top right)
    if (qrCodeDataUrl) {
      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');
      doc.image(qrBuffer, 480, 45, { width: 70, height: 70 });
    }

    // Horizontal line
    doc.moveTo(50, 130)
      .lineTo(562, 130)
      .strokeColor('#e5e5e5')
      .stroke();

    // ==================== DEVICE INFO ====================

    doc.fontSize(10)
      .fillColor('#666666')
      .text('Device Info', 50, 145);

    // Device name (large)
    const deviceName = `${certification.manufacturer} ${certification.model}`;
    doc.fontSize(22)
      .fillColor('#111111')
      .text(deviceName, 50, 165);

    // Device details
    let detailY = 200;
    const details = [
      { label: 'Manufactured by', value: certification.manufacturer },
      { label: 'Model', value: certification.model },
    ];

    if (certification.serialNumber) {
      details.push({ label: 'Serial Number', value: certification.serialNumber });
    }

    if (certification.imei) {
      details.push({ label: 'IMEI', value: certification.imei });
    }

    if (certification.imei2) {
      details.push({ label: 'IMEI 2', value: certification.imei2 });
    }

    if (certification.esn) {
      details.push({ label: 'ESN', value: certification.esn });
    }

    if (certification.macAddress) {
      details.push({ label: 'MAC Address', value: certification.macAddress });
    }

    doc.fontSize(10);
    for (const detail of details) {
      doc.fillColor('#666666')
        .text(`${detail.label}: `, 50, detailY, { continued: true })
        .fillColor('#111111')
        .text(detail.value);
      detailY += 18;
    }

    // Horizontal line
    detailY += 10;
    doc.moveTo(50, detailY)
      .lineTo(562, detailY)
      .strokeColor('#e5e5e5')
      .stroke();

    // ==================== CERTIFICATION CHECKS ====================

    let checkY = detailY + 20;

    for (const check of reportData.checks) {
      // Checkmark circle
      const circleX = 65;
      const checkColor = check.passed ? template.primaryColor : '#ef4444';

      doc.circle(circleX, checkY + 8, 10)
        .fillColor(checkColor)
        .fill();

      // Checkmark symbol
      doc.fillColor('#ffffff')
        .fontSize(12)
        .text(check.passed ? '✓' : '✗', circleX - 4, checkY + 2);

      // Check text
      doc.fillColor('#111111')
        .fontSize(11)
        .text(check.name, 85, checkY + 3);

      if (check.details) {
        doc.fontSize(9)
          .fillColor('#666666')
          .text(check.details, 85, checkY + 18);
        checkY += 40;
      } else {
        checkY += 35;
      }

      // Divider line
      doc.moveTo(50, checkY)
        .lineTo(562, checkY)
        .strokeColor('#f5f5f5')
        .stroke();

      checkY += 5;
    }

    // ==================== TEST RESULTS (if available) ====================

    if (reportData.testResults && reportData.testResults.length > 0) {
      checkY += 15;

      doc.fontSize(12)
        .fillColor('#111111')
        .text('Diagnostic Test Results', 50, checkY);

      checkY += 25;

      // Table header
      doc.fontSize(9)
        .fillColor('#666666')
        .text('Test', 50, checkY)
        .text('Result', 300, checkY)
        .text('Value', 400, checkY);

      checkY += 15;
      doc.moveTo(50, checkY)
        .lineTo(562, checkY)
        .strokeColor('#e5e5e5')
        .stroke();

      checkY += 8;

      for (const result of reportData.testResults.slice(0, 10)) {
        const resultColor = result.result === 'PASS' ? template.primaryColor : '#ef4444';

        doc.fontSize(9)
          .fillColor('#333333')
          .text(result.testCode, 50, checkY)
          .fillColor(resultColor)
          .text(result.result, 300, checkY)
          .fillColor('#333333')
          .text(
            result.measurementValue
              ? `${result.measurementValue}${result.measurementUnit || ''}`
              : '-',
            400,
            checkY
          );

        checkY += 18;
      }

      if (reportData.testResults.length > 10) {
        doc.fontSize(9)
          .fillColor('#666666')
          .text(`... and ${reportData.testResults.length - 10} more tests`, 50, checkY);
        checkY += 20;
      }
    }

    // ==================== GUARANTEE SECTION ====================

    checkY += 20;

    // Guarantee box
    doc.rect(50, checkY, 512, 80)
      .fillColor('#fef3c7')
      .fill();

    // Guarantee icon placeholder
    doc.rect(60, checkY + 15, 40, 50)
      .fillColor('#f59e0b')
      .fill();

    doc.fontSize(14)
      .fillColor('#92400e')
      .text(UPSCALED_GUARANTEE.name, 115, checkY + 20);

    doc.fontSize(9)
      .fillColor('#78350f')
      .text(UPSCALED_GUARANTEE.description, 115, checkY + 40, {
        width: 430,
        lineGap: 2,
      });

    // ==================== FOOTER ====================

    const footerY = 720;

    doc.fontSize(8)
      .fillColor('#999999')
      .text(template.footerText || '', 50, footerY, { align: 'center', width: 512 })
      .moveDown(0.5)
      .text(template.disclaimerText || '', 50, doc.y, { align: 'center', width: 512 });

    // Certification level badge (bottom right)
    const badgeColor = CERTIFICATION_LEVEL_COLOR[certification.certificationLevel];
    const badgeText = CERTIFICATION_LEVEL_DISPLAY[certification.certificationLevel];

    doc.rect(400, footerY - 30, 150, 25)
      .fillColor(badgeColor)
      .fill();

    doc.fontSize(10)
      .fillColor('#ffffff')
      .text(badgeText, 400, footerY - 23, { width: 150, align: 'center' });

    // Finalize
    doc.end();

    stream.on('finish', async () => {
      // Update certification with PDF URL
      await updateCertificationAssets(certification.id, {
        reportPdfUrl: outputPath,
      });

      resolve(outputPath);
    });

    stream.on('error', reject);
  });
}

/**
 * Generate QR code image for certification
 */
export async function generateQrCode(
  certificationId: string,
  url: string,
  options?: {
    outputPath?: string;
    size?: number;
  }
): Promise<string> {
  const size = options?.size || 200;
  const outputPath = options?.outputPath ||
    path.join(REPORTS_DIR, `${certificationId}-qr.png`);

  await QRCode.toFile(outputPath, url, {
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return outputPath;
}

/**
 * Generate QR code as data URL (for embedding)
 */
export async function generateQrCodeDataUrl(url: string, size = 200): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
  });
}

// ==================== HELPER FUNCTIONS ====================

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
