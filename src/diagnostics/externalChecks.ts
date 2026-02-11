/**
 * QuickDiagnosticz - External Checks Service
 * IMEI, serial number, warranty, and stolen device lookups
 *
 * This module provides integration points for external device verification APIs.
 * Currently implements stub providers; real API integrations can be added.
 */

import { getPool, generateUUID, isPostgres } from '../database.js';
import {
  ExternalCheck,
  ExternalCheckType,
  ExternalCheckProvider,
  ExternalCheckStatus,
} from './types.js';

// ==================== PROVIDER INTERFACES ====================

interface IMEICheckResult {
  valid: boolean;
  isBlacklisted: boolean;
  hasFinancialHold: boolean;
  carrier?: string;
  model?: string;
  manufacturer?: string;
  details?: Record<string, unknown>;
}

interface SerialCheckResult {
  valid: boolean;
  model?: string;
  manufacturer?: string;
  manufactureDate?: string;
  warrantyStatus?: string;
  details?: Record<string, unknown>;
}

interface WarrantyCheckResult {
  hasWarranty: boolean;
  warrantyType?: string;
  warrantyStatus?: string;
  expirationDate?: string;
  coverageDetails?: string;
  details?: Record<string, unknown>;
}

interface StolenCheckResult {
  isStolen: boolean;
  reportedDate?: string;
  reportSource?: string;
  details?: Record<string, unknown>;
}

// ==================== PROVIDER IMPLEMENTATIONS ====================

/**
 * Check IMEI against blacklist databases
 * Stub implementation - replace with real API calls
 */
async function checkIMEI(imei: string, provider: ExternalCheckProvider): Promise<IMEICheckResult> {
  // Validate IMEI format (15 digits)
  if (!/^\d{15}$/.test(imei)) {
    return { valid: false, isBlacklisted: false, hasFinancialHold: false };
  }

  // TODO: Implement real API integrations
  // Example providers: IMEI.info, CheckMEND, Swappa
  switch (provider) {
    case 'IMEI_INFO':
      // Stub: would call imei.info API
      console.log(`[ExternalChecks] IMEI check via IMEI_INFO: ${imei}`);
      break;
    case 'CHECKMEND':
      // Stub: would call CheckMEND API
      console.log(`[ExternalChecks] IMEI check via CHECKMEND: ${imei}`);
      break;
    default:
      console.log(`[ExternalChecks] IMEI check via manual verification: ${imei}`);
  }

  // Return clean result (stub)
  return {
    valid: true,
    isBlacklisted: false,
    hasFinancialHold: false,
    details: { provider, checked: new Date().toISOString() }
  };
}

/**
 * Check serial number with manufacturer
 * Stub implementation - replace with real API calls
 */
async function checkSerial(
  serial: string,
  manufacturer: string,
  provider: ExternalCheckProvider
): Promise<SerialCheckResult> {
  // TODO: Implement real API integrations
  // Example: Apple GSX, Samsung Knox, etc.
  switch (provider) {
    case 'APPLE_GSX':
      // Stub: would call Apple GSX API
      console.log(`[ExternalChecks] Serial check via APPLE_GSX: ${serial}`);
      break;
    case 'SAMSUNG_CHECK':
      // Stub: would call Samsung API
      console.log(`[ExternalChecks] Serial check via SAMSUNG_CHECK: ${serial}`);
      break;
    default:
      console.log(`[ExternalChecks] Serial check via manual verification: ${serial}`);
  }

  // Return result (stub)
  return {
    valid: true,
    manufacturer,
    details: { provider, checked: new Date().toISOString() }
  };
}

/**
 * Check warranty status
 * Stub implementation - replace with real API calls
 */
async function checkWarranty(
  identifier: string,
  identifierType: 'imei' | 'serial',
  provider: ExternalCheckProvider
): Promise<WarrantyCheckResult> {
  console.log(`[ExternalChecks] Warranty check: ${identifierType}=${identifier} via ${provider}`);

  // Return result (stub)
  return {
    hasWarranty: false,
    warrantyStatus: 'UNKNOWN',
    details: { provider, checked: new Date().toISOString() }
  };
}

/**
 * Check if device is reported stolen
 * Stub implementation - replace with real API calls
 */
async function checkStolen(
  identifier: string,
  identifierType: 'imei' | 'serial',
  provider: ExternalCheckProvider
): Promise<StolenCheckResult> {
  console.log(`[ExternalChecks] Stolen check: ${identifierType}=${identifier} via ${provider}`);

  // Return result (stub)
  return {
    isStolen: false,
    details: { provider, checked: new Date().toISOString() }
  };
}

// ==================== MAIN API ====================

/**
 * Perform an external check and save result
 */
export async function performExternalCheck(input: {
  qlid: string;
  checkType: ExternalCheckType;
  provider?: ExternalCheckProvider;
  identifier: string;
  identifierType?: 'imei' | 'serial';
  certificationId?: string;
  sessionId?: string;
}): Promise<ExternalCheck> {
  const db = getPool();
  const id = generateUUID();
  const provider = input.provider || 'MANUAL';
  const identifierType = input.identifierType || (input.checkType === 'IMEI' ? 'imei' : 'serial');

  let status: ExternalCheckStatus = 'PENDING';
  let statusDetails: string | undefined;
  let isStolen: boolean | undefined;
  let isBlacklisted: boolean | undefined;
  let hasFinancialHold: boolean | undefined;
  let warrantyStatus: string | undefined;
  let responsePayload: Record<string, unknown> | undefined;

  try {
    switch (input.checkType) {
      case 'IMEI': {
        const result = await checkIMEI(input.identifier, provider);
        status = result.isBlacklisted || result.hasFinancialHold ? 'FLAGGED' : 'CLEAR';
        isBlacklisted = result.isBlacklisted;
        hasFinancialHold = result.hasFinancialHold;
        responsePayload = result.details;
        break;
      }
      case 'SERIAL': {
        const result = await checkSerial(input.identifier, 'Unknown', provider);
        status = result.valid ? 'CLEAR' : 'ERROR';
        responsePayload = result.details;
        break;
      }
      case 'WARRANTY': {
        const result = await checkWarranty(input.identifier, identifierType, provider);
        status = 'CLEAR';
        warrantyStatus = result.warrantyStatus;
        responsePayload = result.details;
        break;
      }
      case 'STOLEN': {
        const result = await checkStolen(input.identifier, identifierType, provider);
        status = result.isStolen ? 'FLAGGED' : 'CLEAR';
        isStolen = result.isStolen;
        statusDetails = result.reportSource;
        responsePayload = result.details;
        break;
      }
      case 'RECALL': {
        // TODO: Implement CPSC recall check
        status = 'CLEAR';
        break;
      }
    }
  } catch (error: any) {
    status = 'ERROR';
    statusDetails = error.message;
  }

  const now = new Date().toISOString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // Results valid for 30 days

  // Save to database
  await db.query(
    `INSERT INTO external_checks (
      id, certification_id, session_id, qlid,
      check_type, provider,
      request_payload, response_payload,
      status, status_details,
      is_stolen, is_blacklisted, has_financial_hold, warranty_status,
      checked_at, expires_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6,
      $7, $8,
      $9, $10,
      $11, $12, $13, $14,
      $15, $16
    )`,
    [
      id,
      input.certificationId || null,
      input.sessionId || null,
      input.qlid,
      input.checkType,
      provider,
      JSON.stringify({ identifier: input.identifier, identifierType }),
      responsePayload ? JSON.stringify(responsePayload) : null,
      status,
      statusDetails || null,
      isPostgres() ? (isStolen || false) : (isStolen ? 1 : 0),
      isPostgres() ? (isBlacklisted || false) : (isBlacklisted ? 1 : 0),
      isPostgres() ? (hasFinancialHold || false) : (hasFinancialHold ? 1 : 0),
      warrantyStatus || null,
      now,
      expiresAt.toISOString(),
    ]
  );

  return {
    id,
    certificationId: input.certificationId,
    sessionId: input.sessionId,
    qlid: input.qlid,
    checkType: input.checkType,
    provider,
    requestPayload: { identifier: input.identifier, identifierType },
    responsePayload,
    status,
    statusDetails,
    isStolen,
    isBlacklisted,
    hasFinancialHold,
    warrantyStatus,
    checkedAt: new Date(now),
    expiresAt,
  };
}

/**
 * Get all external checks for a device
 */
export async function getExternalChecks(qlid: string): Promise<ExternalCheck[]> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM external_checks WHERE qlid = $1 ORDER BY checked_at DESC`,
    [qlid]
  );

  return result.rows.map(rowToExternalCheck);
}

/**
 * Get external checks for a certification
 */
export async function getExternalChecksForCertification(certificationId: string): Promise<ExternalCheck[]> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM external_checks WHERE certification_id = $1 ORDER BY checked_at DESC`,
    [certificationId]
  );

  return result.rows.map(rowToExternalCheck);
}

/**
 * Check if device has any flags
 */
export async function hasFlags(qlid: string): Promise<{
  hasFlags: boolean;
  isStolen: boolean;
  isBlacklisted: boolean;
  hasFinancialHold: boolean;
}> {
  const checks = await getExternalChecks(qlid);

  return {
    hasFlags: checks.some(c => c.status === 'FLAGGED'),
    isStolen: checks.some(c => c.isStolen),
    isBlacklisted: checks.some(c => c.isBlacklisted),
    hasFinancialHold: checks.some(c => c.hasFinancialHold),
  };
}

/**
 * Run all standard checks for a device
 */
export async function runAllChecks(input: {
  qlid: string;
  imei?: string;
  serial?: string;
  certificationId?: string;
  sessionId?: string;
}): Promise<ExternalCheck[]> {
  const checks: ExternalCheck[] = [];

  if (input.imei) {
    // IMEI blacklist check
    checks.push(await performExternalCheck({
      qlid: input.qlid,
      checkType: 'IMEI',
      identifier: input.imei,
      identifierType: 'imei',
      certificationId: input.certificationId,
      sessionId: input.sessionId,
    }));

    // Stolen check via IMEI
    checks.push(await performExternalCheck({
      qlid: input.qlid,
      checkType: 'STOLEN',
      identifier: input.imei,
      identifierType: 'imei',
      certificationId: input.certificationId,
      sessionId: input.sessionId,
    }));
  }

  if (input.serial) {
    // Serial validation
    checks.push(await performExternalCheck({
      qlid: input.qlid,
      checkType: 'SERIAL',
      identifier: input.serial,
      identifierType: 'serial',
      certificationId: input.certificationId,
      sessionId: input.sessionId,
    }));

    // Warranty check via serial
    checks.push(await performExternalCheck({
      qlid: input.qlid,
      checkType: 'WARRANTY',
      identifier: input.serial,
      identifierType: 'serial',
      certificationId: input.certificationId,
      sessionId: input.sessionId,
    }));
  }

  return checks;
}

// ==================== HELPERS ====================

function rowToExternalCheck(row: Record<string, unknown>): ExternalCheck {
  return {
    id: row.id as string,
    certificationId: row.certification_id as string | undefined,
    sessionId: row.session_id as string | undefined,
    qlid: row.qlid as string,
    checkType: row.check_type as ExternalCheckType,
    provider: row.provider as ExternalCheckProvider,
    requestPayload: row.request_payload ? JSON.parse(row.request_payload as string) : undefined,
    responsePayload: row.response_payload ? JSON.parse(row.response_payload as string) : undefined,
    status: row.status as ExternalCheckStatus,
    statusDetails: row.status_details as string | undefined,
    isStolen: row.is_stolen === true || row.is_stolen === 1,
    isBlacklisted: row.is_blacklisted === true || row.is_blacklisted === 1,
    hasFinancialHold: row.has_financial_hold === true || row.has_financial_hold === 1,
    warrantyStatus: row.warranty_status as string | undefined,
    checkedAt: new Date(row.checked_at as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
  };
}
