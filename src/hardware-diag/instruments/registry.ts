/**
 * Hardware Diagnostics - Instrument Registry
 * CRUD operations for hardware_instruments table
 */

import { getPool, generateUUID, isPostgres } from '../../database.js';
import type {
  HardwareInstrument,
  HardwareInstrumentInput,
  InstrumentStatus,
} from '../types.js';

/**
 * Register a new instrument in the database
 */
export async function registerInstrument(
  input: HardwareInstrumentInput
): Promise<HardwareInstrument> {
  const db = getPool();
  const id = generateUUID();
  const now = new Date().toISOString();

  const capabilitiesValue = isPostgres()
    ? input.capabilities || []
    : JSON.stringify(input.capabilities || []);

  await db.query(
    `INSERT INTO hardware_instruments (
      id, name, type, manufacturer, model, serial_number,
      connection_type, connection_path, baud_rate, status,
      capabilities, firmware_version, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      input.name,
      input.type,
      input.manufacturer,
      input.model,
      input.serialNumber || null,
      input.connectionType,
      input.connectionPath,
      input.baudRate || null,
      'DISCONNECTED',
      capabilitiesValue,
      input.firmwareVersion || null,
      input.notes || null,
      now,
    ]
  );

  return {
    id,
    name: input.name,
    type: input.type,
    manufacturer: input.manufacturer,
    model: input.model,
    serialNumber: input.serialNumber,
    connectionType: input.connectionType,
    connectionPath: input.connectionPath,
    baudRate: input.baudRate,
    status: 'DISCONNECTED',
    capabilities: input.capabilities || [],
    firmwareVersion: input.firmwareVersion,
    notes: input.notes,
    createdAt: new Date(now),
  };
}

/**
 * Get instrument by ID
 */
export async function getInstrument(
  id: string
): Promise<HardwareInstrument | null> {
  const db = getPool();

  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM hardware_instruments WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) return null;
  return rowToInstrument(result.rows[0]);
}

/**
 * List all registered instruments
 */
export async function listInstruments(options?: {
  type?: string;
  status?: InstrumentStatus;
}): Promise<HardwareInstrument[]> {
  const db = getPool();

  let sql = 'SELECT * FROM hardware_instruments WHERE 1=1';
  const params: unknown[] = [];
  let idx = 1;

  if (options?.type) {
    sql += ` AND type = $${idx++}`;
    params.push(options.type);
  }

  if (options?.status) {
    sql += ` AND status = $${idx++}`;
    params.push(options.status);
  }

  sql += ' ORDER BY created_at DESC';

  const result = await db.query<Record<string, unknown>>(sql, params);
  return result.rows.map(rowToInstrument);
}

/**
 * Update instrument status
 */
export async function updateInstrumentStatus(
  id: string,
  status: InstrumentStatus
): Promise<void> {
  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `UPDATE hardware_instruments SET status = $1, last_seen_at = $2, updated_at = $2 WHERE id = $3`,
    [status, now, id]
  );
}

/**
 * Delete instrument
 */
export async function deleteInstrument(id: string): Promise<boolean> {
  const db = getPool();

  const result = await db.query(
    'DELETE FROM hardware_instruments WHERE id = $1',
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}

// ==================== ROW CONVERTER ====================

function rowToInstrument(row: Record<string, unknown>): HardwareInstrument {
  let capabilities: string[] = [];
  if (row.capabilities) {
    capabilities =
      typeof row.capabilities === 'string'
        ? JSON.parse(row.capabilities)
        : (row.capabilities as string[]);
  }

  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as any,
    manufacturer: row.manufacturer as string,
    model: row.model as string,
    serialNumber: row.serial_number as string | undefined,
    connectionType: row.connection_type as any,
    connectionPath: row.connection_path as string,
    baudRate: row.baud_rate as number | undefined,
    status: row.status as any,
    lastSeenAt: row.last_seen_at
      ? new Date(row.last_seen_at as string)
      : undefined,
    capabilities,
    firmwareVersion: row.firmware_version as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at
      ? new Date(row.updated_at as string)
      : undefined,
  };
}
