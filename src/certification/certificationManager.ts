/**
 * QuickDiagnosticz - Certification Manager
 * Handles issuing, managing, and revoking device certifications
 */

import {
  getPool,
  generateUUID,
  getNextCertificationId,
  isPostgres,
} from '../database.js';
import { ProductCategory } from '../types.js';
import {
  Certification,
  CertificationInput,
  CertificationLevel,
  CertificationPhoto,
  CertificationPhotoType,
  CertificationCheck,
  DeviceHistoryReport,
  IssueCertificationRequest,
  RevokeCertificationRequest,
  CertificationStats,
  STANDARD_CHECKS,
  CERT_TO_GRADE,
  WarrantyInfo,
  WarrantyType,
  WarrantyStatus,
  UPSCALED_WARRANTY_BY_LEVEL,
} from './types.js';
import { getSessionSummary } from '../diagnostics/sessionManager.js';
import { ExternalCheck } from '../diagnostics/types.js';

// ==================== CERTIFICATION MANAGEMENT ====================

/**
 * Issue a new certification for a device
 */
export async function issueCertification(
  input: IssueCertificationRequest
): Promise<Certification> {
  const db = getPool();

  // Generate IDs
  const id = generateUUID();
  const certificationId = await getNextCertificationId();

  // Calculate validity (default 90 days)
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 90);

  // Generate public report URL
  const publicReportUrl = `https://cert.upscaled.com/r/${certificationId}`;

  // Build warranty info
  let warrantyInfo: WarrantyInfo | undefined;
  if (input.warrantyType || input.warrantyStatus || input.warrantyEndDate) {
    const endDate = input.warrantyEndDate ? new Date(input.warrantyEndDate) : undefined;
    const daysRemaining = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : undefined;

    warrantyInfo = {
      type: (input.warrantyType || 'NONE') as WarrantyType,
      status: (input.warrantyStatus || 'UNKNOWN') as WarrantyStatus,
      provider: input.warrantyProvider,
      startDate: input.warrantyStartDate ? new Date(input.warrantyStartDate) : undefined,
      endDate,
      daysRemaining: daysRemaining && daysRemaining > 0 ? daysRemaining : 0,
      coverageType: input.warrantyCoverageType,
      notes: input.warrantyNotes,
      verifiedAt: new Date(),
      verificationMethod: 'MANUAL',
    };
  }

  // Add Upscaled warranty based on certification level
  const upscaledWarranty = UPSCALED_WARRANTY_BY_LEVEL[input.certificationLevel];
  const upscaledWarrantyEnd = new Date();
  upscaledWarrantyEnd.setDate(upscaledWarrantyEnd.getDate() + upscaledWarranty.days);

  const now = new Date().toISOString();

  // Serialize warranty info to JSON for storage
  const warrantyInfoJson = warrantyInfo ? JSON.stringify({
    ...warrantyInfo,
    startDate: warrantyInfo.startDate?.toISOString(),
    endDate: warrantyInfo.endDate?.toISOString(),
    verifiedAt: warrantyInfo.verifiedAt?.toISOString(),
  }) : null;

  await db.query(
    `INSERT INTO certifications (
      id, certification_id, qlid, job_id, session_id,
      category, manufacturer, model, serial_number,
      certification_level,
      reported_stolen, financial_hold, warranty_status, warranty_info,
      imei, imei2, esn, mac_address,
      certified_by, certified_by_name, certified_at,
      public_report_url, valid_until,
      is_revoked, created_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10,
      $11, $12, $13, $14,
      $15, $16, $17, $18,
      $19, $20, $21,
      $22, $23,
      $24, $21
    )`,
    [
      id,
      certificationId,
      input.qlid,
      input.jobId || null,
      input.sessionId || null,
      input.category,
      input.manufacturer,
      input.model,
      input.serialNumber || null,
      input.certificationLevel,
      isPostgres() ? (input.reportedStolen || false) : (input.reportedStolen ? 1 : 0),
      isPostgres() ? (input.financialHold || false) : (input.financialHold ? 1 : 0),
      input.warrantyStatus?.toString() || warrantyInfo?.status || null,
      warrantyInfoJson,
      input.imei || null,
      input.imei2 || null,
      input.esn || null,
      input.macAddress || null,
      input.certifiedBy,
      input.certifiedByName || null,
      now,
      publicReportUrl,
      validUntil.toISOString().split('T')[0],
      isPostgres() ? false : 0,
    ]
  );

  // Add photos if provided
  if (input.photos && input.photos.length > 0) {
    for (let i = 0; i < input.photos.length; i++) {
      const photo = input.photos[i];
      await addCertificationPhoto(id, {
        photoType: photo.photoType,
        photoUrl: photo.photoUrl,
        caption: photo.caption,
        displayOrder: i,
      });
    }
  }

  const certification: Certification = {
    id,
    certificationId,
    qlid: input.qlid,
    jobId: input.jobId,
    sessionId: input.sessionId,
    category: input.category,
    manufacturer: input.manufacturer,
    model: input.model,
    serialNumber: input.serialNumber,
    certificationLevel: input.certificationLevel,
    reportedStolen: input.reportedStolen || false,
    financialHold: input.financialHold || false,
    warrantyInfo,
    warrantyStatus: warrantyInfo?.status || input.warrantyStatus?.toString(),
    imei: input.imei,
    imei2: input.imei2,
    esn: input.esn,
    macAddress: input.macAddress,
    certifiedBy: input.certifiedBy,
    certifiedByName: input.certifiedByName,
    certifiedAt: new Date(now),
    publicReportUrl,
    validUntil,
    isRevoked: false,
    createdAt: new Date(now),
  };

  return certification;
}

/**
 * Get certification by ID or certification ID
 */
export async function getCertification(identifier: string): Promise<Certification | null> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM certifications
     WHERE id = $1 OR certification_id = $1 OR qlid = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [identifier]
  );

  if (result.rows.length === 0) return null;

  return rowToCertification(result.rows[0]);
}

/**
 * Revoke a certification
 */
export async function revokeCertification(
  certificationId: string,
  input: RevokeCertificationRequest
): Promise<Certification> {
  const db = getPool();

  const cert = await getCertification(certificationId);
  if (!cert) {
    throw new Error(`Certification not found: ${certificationId}`);
  }

  if (cert.isRevoked) {
    throw new Error('Certification is already revoked');
  }

  const now = new Date().toISOString();

  await db.query(
    `UPDATE certifications SET
      is_revoked = $1,
      revoked_at = $2,
      revoked_by = $3,
      revoked_reason = $4,
      updated_at = $2
     WHERE id = $5`,
    [
      isPostgres() ? true : 1,
      now,
      input.revokedBy,
      input.reason,
      cert.id,
    ]
  );

  return {
    ...cert,
    isRevoked: true,
    revokedAt: new Date(now),
    revokedBy: input.revokedBy,
    revokedReason: input.reason,
    updatedAt: new Date(now),
  };
}

/**
 * Update certification with generated assets (PDF, label, QR code URLs)
 */
export async function updateCertificationAssets(
  certificationId: string,
  assets: {
    reportPdfUrl?: string;
    labelPngUrl?: string;
    qrCodeUrl?: string;
  }
): Promise<void> {
  const db = getPool();

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (assets.reportPdfUrl) {
    updates.push(`report_pdf_url = $${paramIndex++}`);
    params.push(assets.reportPdfUrl);
  }

  if (assets.labelPngUrl) {
    updates.push(`label_png_url = $${paramIndex++}`);
    params.push(assets.labelPngUrl);
  }

  if (assets.qrCodeUrl) {
    updates.push(`qr_code_url = $${paramIndex++}`);
    params.push(assets.qrCodeUrl);
  }

  if (updates.length === 0) return;

  updates.push(`updated_at = $${paramIndex++}`);
  params.push(new Date().toISOString());

  params.push(certificationId);

  await db.query(
    `UPDATE certifications SET ${updates.join(', ')} WHERE id = $${paramIndex} OR certification_id = $${paramIndex}`,
    params
  );
}

/**
 * Add a photo to a certification
 */
export async function addCertificationPhoto(
  certificationId: string,
  input: {
    photoType: CertificationPhotoType;
    photoUrl: string;
    thumbnailUrl?: string;
    caption?: string;
    displayOrder?: number;
  }
): Promise<CertificationPhoto> {
  const db = getPool();

  const id = generateUUID();
  const now = new Date().toISOString();

  // Get cert ID if we were passed certification_id string
  const cert = await getCertification(certificationId);
  const certId = cert?.id || certificationId;

  await db.query(
    `INSERT INTO certification_photos (
      id, certification_id, photo_type, photo_url,
      thumbnail_url, caption, display_order, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      certId,
      input.photoType,
      input.photoUrl,
      input.thumbnailUrl || null,
      input.caption || null,
      input.displayOrder || 0,
      now,
    ]
  );

  return {
    id,
    certificationId: certId,
    photoType: input.photoType,
    photoUrl: input.photoUrl,
    thumbnailUrl: input.thumbnailUrl,
    caption: input.caption,
    displayOrder: input.displayOrder || 0,
    createdAt: new Date(now),
  };
}

/**
 * Get photos for a certification
 */
export async function getCertificationPhotos(
  certificationId: string
): Promise<CertificationPhoto[]> {
  const db = getPool();

  // Get cert ID
  const cert = await getCertification(certificationId);
  const certId = cert?.id || certificationId;

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM certification_photos
     WHERE certification_id = $1
     ORDER BY display_order`,
    [certId]
  );

  return result.rows.map(rowToPhoto);
}

/**
 * Get external checks for a certification
 */
export async function getCertificationChecks(
  certificationId: string
): Promise<ExternalCheck[]> {
  const db = getPool();

  const cert = await getCertification(certificationId);
  const certId = cert?.id || certificationId;

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM external_checks WHERE certification_id = $1`,
    [certId]
  );

  return result.rows.map(rowToExternalCheck);
}

/**
 * Build certification check list for report
 */
export function buildCertificationChecks(
  certification: Certification,
  sessionSummary?: any,
  externalChecks?: ExternalCheck[]
): CertificationCheck[] {
  const checks: CertificationCheck[] = [];

  // Stolen status check
  checks.push({
    code: 'STOLEN',
    name: certification.reportedStolen
      ? 'Reported lost or stolen'
      : 'Not reported lost or stolen',
    passed: !certification.reportedStolen,
    icon: certification.reportedStolen ? 'error' : 'check',
  });

  // Financial hold check
  checks.push({
    code: 'FINANCIAL',
    name: certification.financialHold
      ? 'Financial issues reported'
      : 'No financial issues reported',
    passed: !certification.financialHold,
    icon: certification.financialHold ? 'error' : 'check',
  });

  // Functional tests check
  if (sessionSummary) {
    const passed = sessionSummary.criticalFailures === 0;
    checks.push({
      code: 'FUNCTIONAL',
      name: passed
        ? 'All functional tests passed'
        : `${sessionSummary.criticalFailures} critical test(s) failed`,
      passed,
      details: `Pass rate: ${sessionSummary.passRate.toFixed(1)}%`,
      icon: passed ? 'check' : 'error',
    });
  }

  // Safety check
  checks.push({
    code: 'SAFETY',
    name: 'Passed safety inspection',
    passed: true,
    icon: 'check',
  });

  // Cosmetic condition
  const isExcellent = certification.certificationLevel === 'EXCELLENT';
  checks.push({
    code: 'COSMETIC',
    name: isExcellent
      ? 'Excellent cosmetic condition'
      : 'Good cosmetic condition',
    passed: certification.certificationLevel !== 'NOT_CERTIFIED',
    icon: 'check',
  });

  return checks;
}

/**
 * Get full device history report data
 */
export async function getDeviceHistoryReport(
  certificationId: string
): Promise<DeviceHistoryReport | null> {
  const certification = await getCertification(certificationId);
  if (!certification) return null;

  const photos = await getCertificationPhotos(certificationId);
  const externalChecks = await getCertificationChecks(certificationId);

  let sessionSummary;
  let testResults;

  if (certification.sessionId) {
    sessionSummary = await getSessionSummary(certification.sessionId);
    if (sessionSummary) {
      testResults = sessionSummary.results.map(r => ({
        testCode: r.testCode,
        testName: r.testCode, // Would need to join with tests table for name
        result: r.result,
        measurementValue: r.measurementValue,
        measurementUnit: r.measurementUnit,
        notes: r.notes,
      }));
    }
  }

  const checks = buildCertificationChecks(certification, sessionSummary, externalChecks);

  return {
    certification,
    session: sessionSummary?.session,
    externalChecks,
    photos,
    checks,
    testResults,
    reportDate: new Date(),
  };
}

/**
 * Verify a certification (public API)
 */
export async function verifyCertification(certificationId: string): Promise<{
  valid: boolean;
  certification?: Certification;
  checks: CertificationCheck[];
  message: string;
}> {
  const certification = await getCertification(certificationId);

  if (!certification) {
    return {
      valid: false,
      checks: [],
      message: 'Certification not found',
    };
  }

  if (certification.isRevoked) {
    return {
      valid: false,
      certification,
      checks: [],
      message: `Certification revoked: ${certification.revokedReason || 'No reason provided'}`,
    };
  }

  if (certification.validUntil && new Date() > certification.validUntil) {
    return {
      valid: false,
      certification,
      checks: [],
      message: 'Certification has expired',
    };
  }

  const checks = buildCertificationChecks(certification);
  const allChecksPassed = checks.every(c => c.passed);

  return {
    valid: allChecksPassed,
    certification,
    checks,
    message: allChecksPassed
      ? 'Certification is valid'
      : 'Certification has issues',
  };
}

/**
 * List certifications with filters
 */
export async function listCertifications(options: {
  category?: ProductCategory;
  level?: CertificationLevel;
  certifiedBy?: string;
  qlid?: string;
  fromDate?: Date;
  toDate?: Date;
  includeRevoked?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Certification[]> {
  const db = getPool();

  let sql = 'SELECT * FROM certifications WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.category) {
    sql += ` AND category = $${paramIndex++}`;
    params.push(options.category);
  }

  if (options.level) {
    sql += ` AND certification_level = $${paramIndex++}`;
    params.push(options.level);
  }

  if (options.certifiedBy) {
    sql += ` AND certified_by = $${paramIndex++}`;
    params.push(options.certifiedBy);
  }

  if (options.qlid) {
    sql += ` AND qlid = $${paramIndex++}`;
    params.push(options.qlid);
  }

  if (options.fromDate) {
    sql += ` AND certified_at >= $${paramIndex++}`;
    params.push(options.fromDate.toISOString());
  }

  if (options.toDate) {
    sql += ` AND certified_at <= $${paramIndex++}`;
    params.push(options.toDate.toISOString());
  }

  if (!options.includeRevoked) {
    sql += isPostgres() ? ' AND is_revoked = false' : ' AND is_revoked = 0';
  }

  sql += ' ORDER BY certified_at DESC';

  if (options.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const result = await db.query<Record<string, unknown>>(sql, params);
  return result.rows.map(rowToCertification);
}

/**
 * Get certification statistics
 */
export async function getCertificationStats(
  period: 'today' | 'week' | 'month' | 'all' = 'all'
): Promise<CertificationStats> {
  const db = getPool();

  let dateFilter = '';
  if (period !== 'all') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    dateFilter = ` AND certified_at >= '${startDate!.toISOString()}'`;
  }

  // Total certifications
  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM certifications WHERE 1=1${dateFilter}`
  );
  const totalCertifications = parseInt(String(totalResult.rows[0].count));

  // By level
  const byLevel: Record<CertificationLevel, number> = {
    EXCELLENT: 0,
    GOOD: 0,
    FAIR: 0,
    NOT_CERTIFIED: 0,
  };

  for (const level of Object.keys(byLevel) as CertificationLevel[]) {
    const levelResult = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM certifications WHERE certification_level = $1${dateFilter}`,
      [level]
    );
    byLevel[level] = parseInt(String(levelResult.rows[0].count));
  }

  // Certification rate (certified vs not certified)
  const certifiedCount = byLevel.EXCELLENT + byLevel.GOOD + byLevel.FAIR;
  const certificationRate = totalCertifications > 0
    ? (certifiedCount / totalCertifications) * 100
    : 0;

  // By category
  const categoryResult = await db.query<Record<string, unknown>>(
    `SELECT category, certification_level, COUNT(*) as count
     FROM certifications
     WHERE 1=1${dateFilter}
     GROUP BY category, certification_level`
  );

  const byCategory: CertificationStats['byCategory'] = {} as any;
  for (const row of categoryResult.rows) {
    const cat = row.category as ProductCategory;
    const level = row.certification_level as CertificationLevel;
    const count = parseInt(String(row.count));

    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, excellent: 0, good: 0, fair: 0, notCertified: 0 };
    }

    byCategory[cat].total += count;
    switch (level) {
      case 'EXCELLENT':
        byCategory[cat].excellent += count;
        break;
      case 'GOOD':
        byCategory[cat].good += count;
        break;
      case 'FAIR':
        byCategory[cat].fair += count;
        break;
      case 'NOT_CERTIFIED':
        byCategory[cat].notCertified += count;
        break;
    }
  }

  // Recent certifications
  const recentResult = await db.query<Record<string, unknown>>(
    `SELECT * FROM certifications
     WHERE 1=1${dateFilter}
     ORDER BY certified_at DESC
     LIMIT 10`
  );
  const recentCertifications = recentResult.rows.map(rowToCertification);

  return {
    period,
    totalCertifications,
    byLevel,
    certificationRate,
    byCategory,
    recentCertifications,
  };
}

// ==================== ROW CONVERTERS ====================

function parseWarrantyInfo(data: unknown): WarrantyInfo | undefined {
  if (!data) return undefined;

  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return {
      type: parsed.type as WarrantyType,
      status: parsed.status as WarrantyStatus,
      provider: parsed.provider,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      daysRemaining: parsed.daysRemaining,
      coverageType: parsed.coverageType,
      deductible: parsed.deductible,
      verifiedAt: parsed.verifiedAt ? new Date(parsed.verifiedAt) : undefined,
      verifiedBy: parsed.verifiedBy,
      verificationMethod: parsed.verificationMethod,
      notes: parsed.notes,
    };
  } catch {
    return undefined;
  }
}

function rowToCertification(row: Record<string, unknown>): Certification {
  const warrantyInfo = parseWarrantyInfo(row.warranty_info);

  return {
    id: row.id as string,
    certificationId: row.certification_id as string,
    qlid: row.qlid as string,
    jobId: row.job_id as string | undefined,
    sessionId: row.session_id as string | undefined,
    category: row.category as ProductCategory,
    manufacturer: row.manufacturer as string,
    model: row.model as string,
    serialNumber: row.serial_number as string | undefined,
    certificationLevel: row.certification_level as CertificationLevel,
    reportedStolen: row.reported_stolen === true || row.reported_stolen === 1,
    financialHold: row.financial_hold === true || row.financial_hold === 1,
    warrantyInfo,
    warrantyStatus: row.warranty_status as string | undefined,
    imei: row.imei as string | undefined,
    imei2: row.imei2 as string | undefined,
    esn: row.esn as string | undefined,
    macAddress: row.mac_address as string | undefined,
    certifiedBy: row.certified_by as string,
    certifiedByName: row.certified_by_name as string | undefined,
    certifiedAt: new Date(row.certified_at as string),
    reportPdfUrl: row.report_pdf_url as string | undefined,
    labelPngUrl: row.label_png_url as string | undefined,
    qrCodeUrl: row.qr_code_url as string | undefined,
    publicReportUrl: row.public_report_url as string | undefined,
    validUntil: row.valid_until ? new Date(row.valid_until as string) : undefined,
    isRevoked: row.is_revoked === true || row.is_revoked === 1,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : undefined,
    revokedBy: row.revoked_by as string | undefined,
    revokedReason: row.revoked_reason as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

function rowToPhoto(row: Record<string, unknown>): CertificationPhoto {
  return {
    id: row.id as string,
    certificationId: row.certification_id as string,
    photoType: row.photo_type as CertificationPhotoType,
    photoUrl: row.photo_url as string,
    thumbnailUrl: row.thumbnail_url as string | undefined,
    caption: row.caption as string | undefined,
    displayOrder: row.display_order as number,
    createdAt: new Date(row.created_at as string),
  };
}

function rowToExternalCheck(row: Record<string, unknown>): ExternalCheck {
  return {
    id: row.id as string,
    certificationId: row.certification_id as string | undefined,
    sessionId: row.session_id as string | undefined,
    qlid: row.qlid as string,
    checkType: row.check_type as any,
    provider: row.provider as any,
    requestPayload: row.request_payload as Record<string, unknown> | undefined,
    responsePayload: row.response_payload as Record<string, unknown> | undefined,
    status: row.status as any,
    statusDetails: row.status_details as string | undefined,
    isStolen: row.is_stolen === true || row.is_stolen === 1,
    isBlacklisted: row.is_blacklisted === true || row.is_blacklisted === 1,
    hasFinancialHold: row.has_financial_hold === true || row.has_financial_hold === 1,
    warrantyStatus: row.warranty_status as string | undefined,
    recallStatus: row.recall_status as string | undefined,
    checkedAt: new Date(row.checked_at as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
  };
}
