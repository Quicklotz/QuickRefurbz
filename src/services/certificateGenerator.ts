/**
 * Certificate Generator Service
 * Generates PDF certificates for data wiped devices
 * Compliant with NIST 800-88 and DoD 5220.22-M standards
 */

import { getPool, generateUUID } from '../database.js';
import crypto from 'crypto';

// ==================== TYPES ====================

export type WipeMethod = 'NIST_800_88' | 'DOD_5220_22M' | 'SECURE_ERASE' | 'CRYPTO_ERASE' | 'PHYSICAL_DESTROY';
export type VerificationMethod = 'RANDOM_SAMPLE' | 'FULL_VERIFY' | 'VISUAL_INSPECT' | 'ATTESTATION';

export interface DataWipeCertificate {
  id: string;
  certificateNumber: string;
  qlid: string;
  deviceInfo: {
    manufacturer: string;
    model: string;
    serialNumber?: string;
    imei?: string;
    storageType?: string;
    storageCapacity?: string;
  };
  wipeMethod: WipeMethod;
  wipeStartedAt: string;
  wipeCompletedAt: string;
  verificationMethod: VerificationMethod;
  verificationPassed: boolean;
  technicianId: string;
  technicianName?: string;
  verificationCode: string;
  notes?: string;
  createdAt: string;
}

export interface CreateCertificateInput {
  qlid: string;
  deviceInfo: {
    manufacturer: string;
    model: string;
    serialNumber?: string;
    imei?: string;
    storageType?: string;
    storageCapacity?: string;
  };
  wipeMethod: WipeMethod;
  wipeStartedAt: string;
  wipeCompletedAt: string;
  verificationMethod: VerificationMethod;
  verificationPassed: boolean;
  technicianId: string;
  notes?: string;
}

// ==================== CONSTANTS ====================

const WIPE_METHOD_DISPLAY: Record<WipeMethod, { name: string; description: string }> = {
  NIST_800_88: {
    name: 'NIST SP 800-88',
    description: 'National Institute of Standards and Technology Guidelines for Media Sanitization'
  },
  DOD_5220_22M: {
    name: 'DoD 5220.22-M',
    description: 'Department of Defense Clearing and Sanitization Standard'
  },
  SECURE_ERASE: {
    name: 'Secure Erase',
    description: 'ATA Secure Erase command for SSDs/HDDs'
  },
  CRYPTO_ERASE: {
    name: 'Cryptographic Erase',
    description: 'Encryption key destruction rendering data unrecoverable'
  },
  PHYSICAL_DESTROY: {
    name: 'Physical Destruction',
    description: 'Physical destruction of storage media'
  }
};

const VERIFICATION_DISPLAY: Record<VerificationMethod, string> = {
  RANDOM_SAMPLE: 'Random Sector Sampling Verification',
  FULL_VERIFY: 'Full Media Verification Scan',
  VISUAL_INSPECT: 'Visual Inspection (Physical Destruction)',
  ATTESTATION: 'Technician Attestation'
};

// ==================== HELPER FUNCTIONS ====================

function generateCertificateNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `DWC-${year}${month}-${random}`;
}

function generateVerificationCode(data: {
  certificateNumber: string;
  qlid: string;
  wipeCompletedAt: string;
}): string {
  const payload = `${data.certificateNumber}|${data.qlid}|${data.wipeCompletedAt}`;
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return hash.substring(0, 12).toUpperCase();
}

// ==================== PUBLIC API ====================

/**
 * Create a new data wipe certificate
 */
export async function createCertificate(input: CreateCertificateInput): Promise<DataWipeCertificate> {
  const db = getPool();
  const id = generateUUID();
  const certificateNumber = generateCertificateNumber();

  // Get technician name
  const techResult = await db.query<{ name: string }>(
    `SELECT name FROM technicians WHERE id = $1`,
    [input.technicianId]
  );
  const technicianName = techResult.rows[0]?.name || 'Unknown';

  const verificationCode = generateVerificationCode({
    certificateNumber,
    qlid: input.qlid,
    wipeCompletedAt: input.wipeCompletedAt
  });

  await db.query(`
    INSERT INTO data_wipe_certificates (
      id, certificate_number, qlid, device_info,
      wipe_method, wipe_started_at, wipe_completed_at,
      verification_method, verification_passed,
      technician_id, technician_name, verification_code, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, [
    id,
    certificateNumber,
    input.qlid,
    JSON.stringify(input.deviceInfo),
    input.wipeMethod,
    input.wipeStartedAt,
    input.wipeCompletedAt,
    input.verificationMethod,
    input.verificationPassed,
    input.technicianId,
    technicianName,
    verificationCode,
    input.notes || null
  ]);

  return {
    id,
    certificateNumber,
    qlid: input.qlid,
    deviceInfo: input.deviceInfo,
    wipeMethod: input.wipeMethod,
    wipeStartedAt: input.wipeStartedAt,
    wipeCompletedAt: input.wipeCompletedAt,
    verificationMethod: input.verificationMethod,
    verificationPassed: input.verificationPassed,
    technicianId: input.technicianId,
    technicianName,
    verificationCode,
    notes: input.notes,
    createdAt: new Date().toISOString()
  };
}

/**
 * Get certificate by ID or certificate number
 */
export async function getCertificate(identifier: string): Promise<DataWipeCertificate | null> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    certificate_number: string;
    qlid: string;
    device_info: string;
    wipe_method: string;
    wipe_started_at: string;
    wipe_completed_at: string;
    verification_method: string;
    verification_passed: boolean;
    technician_id: string;
    technician_name: string;
    verification_code: string;
    notes: string | null;
    created_at: string;
  }>(`
    SELECT * FROM data_wipe_certificates
    WHERE id = $1 OR certificate_number = $1
  `, [identifier]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    qlid: row.qlid,
    deviceInfo: JSON.parse(row.device_info),
    wipeMethod: row.wipe_method as WipeMethod,
    wipeStartedAt: row.wipe_started_at,
    wipeCompletedAt: row.wipe_completed_at,
    verificationMethod: row.verification_method as VerificationMethod,
    verificationPassed: row.verification_passed,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    verificationCode: row.verification_code,
    notes: row.notes || undefined,
    createdAt: row.created_at
  };
}

/**
 * Get certificate for a QLID
 */
export async function getCertificateForItem(qlid: string): Promise<DataWipeCertificate | null> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    certificate_number: string;
    qlid: string;
    device_info: string;
    wipe_method: string;
    wipe_started_at: string;
    wipe_completed_at: string;
    verification_method: string;
    verification_passed: boolean;
    technician_id: string;
    technician_name: string;
    verification_code: string;
    notes: string | null;
    created_at: string;
  }>(`
    SELECT * FROM data_wipe_certificates
    WHERE qlid = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [qlid]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    qlid: row.qlid,
    deviceInfo: JSON.parse(row.device_info),
    wipeMethod: row.wipe_method as WipeMethod,
    wipeStartedAt: row.wipe_started_at,
    wipeCompletedAt: row.wipe_completed_at,
    verificationMethod: row.verification_method as VerificationMethod,
    verificationPassed: row.verification_passed,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    verificationCode: row.verification_code,
    notes: row.notes || undefined,
    createdAt: row.created_at
  };
}

/**
 * Verify a certificate using verification code
 */
export async function verifyCertificate(certificateNumber: string, verificationCode: string): Promise<{
  valid: boolean;
  certificate?: DataWipeCertificate;
  error?: string;
}> {
  const certificate = await getCertificate(certificateNumber);

  if (!certificate) {
    return { valid: false, error: 'Certificate not found' };
  }

  if (certificate.verificationCode !== verificationCode.toUpperCase()) {
    return { valid: false, error: 'Verification code does not match' };
  }

  return { valid: true, certificate };
}

/**
 * Generate certificate content as text (for PDF generation)
 */
export function generateCertificateContent(cert: DataWipeCertificate): {
  title: string;
  sections: Array<{ heading: string; content: string }>;
} {
  const wipeInfo = WIPE_METHOD_DISPLAY[cert.wipeMethod];
  const verifyInfo = VERIFICATION_DISPLAY[cert.verificationMethod];
  const wipeDate = new Date(cert.wipeCompletedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const wipeTime = new Date(cert.wipeCompletedAt).toLocaleTimeString('en-US');

  return {
    title: 'DATA SANITIZATION CERTIFICATE',
    sections: [
      {
        heading: 'Certificate Information',
        content: `Certificate Number: ${cert.certificateNumber}
Verification Code: ${cert.verificationCode}
Issue Date: ${new Date(cert.createdAt).toLocaleDateString('en-US')}`
      },
      {
        heading: 'Device Information',
        content: `Manufacturer: ${cert.deviceInfo.manufacturer}
Model: ${cert.deviceInfo.model}
${cert.deviceInfo.serialNumber ? `Serial Number: ${cert.deviceInfo.serialNumber}` : ''}
${cert.deviceInfo.imei ? `IMEI: ${cert.deviceInfo.imei}` : ''}
${cert.deviceInfo.storageType ? `Storage Type: ${cert.deviceInfo.storageType}` : ''}
${cert.deviceInfo.storageCapacity ? `Storage Capacity: ${cert.deviceInfo.storageCapacity}` : ''}
QuickRefurbz ID: ${cert.qlid}`.trim()
      },
      {
        heading: 'Sanitization Method',
        content: `Method: ${wipeInfo.name}
Standard: ${wipeInfo.description}
Date Completed: ${wipeDate}
Time Completed: ${wipeTime}`
      },
      {
        heading: 'Verification',
        content: `Method: ${verifyInfo}
Result: ${cert.verificationPassed ? 'PASSED - Data Successfully Sanitized' : 'FAILED - See Notes'}
Technician: ${cert.technicianName || cert.technicianId}`
      },
      ...(cert.notes ? [{
        heading: 'Notes',
        content: cert.notes
      }] : []),
      {
        heading: 'Certification Statement',
        content: `This certifies that the above-referenced device has been sanitized in accordance with ${wipeInfo.name} standards. All user data has been securely erased and the device is safe for reuse or disposal.

This certificate can be verified at: ${process.env.PUBLIC_URL || 'https://quickrefurbz.com'}/verify/${cert.certificateNumber}`
      }
    ]
  };
}

/**
 * Generate certificate as plain text
 */
export function generateCertificateText(cert: DataWipeCertificate): string {
  const content = generateCertificateContent(cert);

  const border = '═'.repeat(60);
  const lines: string[] = [
    border,
    '',
    content.title.padStart(40),
    '',
    border,
    ''
  ];

  for (const section of content.sections) {
    lines.push(`▸ ${section.heading.toUpperCase()}`);
    lines.push('─'.repeat(40));
    lines.push(section.content);
    lines.push('');
  }

  lines.push(border);
  lines.push(`Generated by QuickRefurbz | ${new Date().toISOString()}`);
  lines.push(border);

  return lines.join('\n');
}

/**
 * Get all certificates with optional filtering
 */
export async function listCertificates(options?: {
  limit?: number;
  wipeMethod?: WipeMethod;
}): Promise<DataWipeCertificate[]> {
  const db = getPool();
  const params: any[] = [];
  let query = `SELECT * FROM data_wipe_certificates`;
  const conditions: string[] = [];

  if (options?.wipeMethod) {
    conditions.push(`wipe_method = $${params.length + 1}`);
    params.push(options.wipeMethod);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(options.limit);
  }

  const result = await db.query(query, params);

  return result.rows.map((row: any) => ({
    id: row.id,
    certificateNumber: row.certificate_number,
    qlid: row.qlid,
    deviceInfo: JSON.parse(row.device_info),
    wipeMethod: row.wipe_method as WipeMethod,
    wipeStartedAt: row.wipe_started_at,
    wipeCompletedAt: row.wipe_completed_at,
    verificationMethod: row.verification_method as VerificationMethod,
    verificationPassed: row.verification_passed,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    verificationCode: row.verification_code,
    notes: row.notes || undefined,
    createdAt: row.created_at
  }));
}

/**
 * Get certificate statistics
 */
export async function getCertificateStats(): Promise<{
  total: number;
  byMethod: Record<string, number>;
  passRate: number;
}> {
  const db = getPool();

  const totalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM data_wipe_certificates`
  );

  const methodResult = await db.query<{ wipe_method: string; count: string }>(
    `SELECT wipe_method, COUNT(*) as count FROM data_wipe_certificates GROUP BY wipe_method`
  );

  const passResult = await db.query<{ passed: string; total: string }>(`
    SELECT
      SUM(CASE WHEN verification_passed THEN 1 ELSE 0 END) as passed,
      COUNT(*) as total
    FROM data_wipe_certificates
  `);

  const byMethod: Record<string, number> = {};
  for (const row of methodResult.rows) {
    byMethod[row.wipe_method] = parseInt(row.count);
  }

  const total = parseInt(totalResult.rows[0].count);
  const passed = parseInt(passResult.rows[0].passed || '0');
  const passRate = total > 0 ? (passed / total) * 100 : 0;

  return {
    total,
    byMethod,
    passRate
  };
}
