/**
 * QuickTestz - Station Manager Service
 * CRUD for test stations and their outlets
 */

import { getPool, generateUUID } from '../../database.js';
import type {
  TestStation,
  TestStationInput,
  TestOutlet,
  TestOutletInput,
  SafetyFlags,
} from '../types.js';

// ==================== STATIONS ====================

export async function listStations(): Promise<TestStation[]> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_stations ORDER BY name'
  );
  return result.rows.map(rowToStation);
}

export async function getStation(id: string): Promise<TestStation | null> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_stations WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToStation(result.rows[0]);
}

export async function createStation(input: TestStationInput): Promise<TestStation> {
  const db = getPool();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO test_stations (
      id, name, location, controller_type, controller_base_url,
      network_type, safety_flags, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.name,
      input.location || null,
      input.controllerType,
      input.controllerBaseUrl || null,
      input.networkType || null,
      JSON.stringify(input.safetyFlags || {}),
      now,
    ]
  );

  return {
    id,
    name: input.name,
    location: input.location,
    controllerType: input.controllerType,
    controllerBaseUrl: input.controllerBaseUrl,
    networkType: input.networkType,
    safetyFlags: input.safetyFlags || {},
    createdAt: new Date(now),
  };
}

export async function updateStation(
  id: string,
  input: Partial<TestStationInput>
): Promise<TestStation | null> {
  const existing = await getStation(id);
  if (!existing) return null;

  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `UPDATE test_stations SET
      name = $1, location = $2, controller_type = $3,
      controller_base_url = $4, network_type = $5,
      safety_flags = $6, updated_at = $7
     WHERE id = $8`,
    [
      input.name ?? existing.name,
      input.location ?? existing.location,
      input.controllerType ?? existing.controllerType,
      input.controllerBaseUrl ?? existing.controllerBaseUrl,
      input.networkType ?? existing.networkType,
      JSON.stringify(input.safetyFlags ?? existing.safetyFlags),
      now,
      id,
    ]
  );

  return getStation(id);
}

export async function deleteStation(id: string): Promise<boolean> {
  const db = getPool();
  // Delete child outlets first
  await db.query('DELETE FROM test_outlets WHERE station_id = $1', [id]);
  const result = await db.query('DELETE FROM test_stations WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== OUTLETS ====================

export async function listOutlets(stationId: string): Promise<TestOutlet[]> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_outlets WHERE station_id = $1 ORDER BY label',
    [stationId]
  );
  return result.rows.map(rowToOutlet);
}

export async function getOutlet(id: string): Promise<TestOutlet | null> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_outlets WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToOutlet(result.rows[0]);
}

export async function createOutlet(input: TestOutletInput): Promise<TestOutlet> {
  const db = getPool();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO test_outlets (
      id, station_id, label, controller_channel, max_amps,
      supports_on_off, supports_power_metering, enabled, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.stationId,
      input.label,
      input.controllerChannel,
      input.maxAmps ?? null,
      input.supportsOnOff ?? true,
      input.supportsPowerMetering ?? true,
      input.enabled ?? true,
      now,
    ]
  );

  return {
    id,
    stationId: input.stationId,
    label: input.label,
    controllerChannel: input.controllerChannel,
    maxAmps: input.maxAmps,
    supportsOnOff: input.supportsOnOff ?? true,
    supportsPowerMetering: input.supportsPowerMetering ?? true,
    enabled: input.enabled ?? true,
    createdAt: new Date(now),
  };
}

export async function updateOutlet(
  id: string,
  input: Partial<TestOutletInput>
): Promise<TestOutlet | null> {
  const existing = await getOutlet(id);
  if (!existing) return null;

  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `UPDATE test_outlets SET
      label = $1, controller_channel = $2, max_amps = $3,
      supports_on_off = $4, supports_power_metering = $5,
      enabled = $6, updated_at = $7
     WHERE id = $8`,
    [
      input.label ?? existing.label,
      input.controllerChannel ?? existing.controllerChannel,
      input.maxAmps ?? existing.maxAmps,
      input.supportsOnOff ?? existing.supportsOnOff,
      input.supportsPowerMetering ?? existing.supportsPowerMetering,
      input.enabled ?? existing.enabled,
      now,
      id,
    ]
  );

  return getOutlet(id);
}

export async function deleteOutlet(id: string): Promise<boolean> {
  const db = getPool();
  const result = await db.query('DELETE FROM test_outlets WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== ROW CONVERTERS ====================

function rowToStation(row: Record<string, unknown>): TestStation {
  let safetyFlags: SafetyFlags = {};
  if (row.safety_flags) {
    if (typeof row.safety_flags === 'string') {
      try { safetyFlags = JSON.parse(row.safety_flags); } catch { /* empty */ }
    } else {
      safetyFlags = row.safety_flags as SafetyFlags;
    }
  }

  return {
    id: row.id as string,
    name: row.name as string,
    location: row.location as string | undefined,
    controllerType: row.controller_type as TestStation['controllerType'],
    controllerBaseUrl: row.controller_base_url as string | undefined,
    networkType: row.network_type as TestStation['networkType'],
    safetyFlags,
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

function rowToOutlet(row: Record<string, unknown>): TestOutlet {
  return {
    id: row.id as string,
    stationId: row.station_id as string,
    label: row.label as string,
    controllerChannel: row.controller_channel as string,
    maxAmps: row.max_amps as number | undefined,
    supportsOnOff: Boolean(row.supports_on_off),
    supportsPowerMetering: Boolean(row.supports_power_metering),
    enabled: Boolean(row.enabled),
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}
