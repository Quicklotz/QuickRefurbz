/**
 * QuickTestz - Readings Collector Service
 * Polls controller adapters for live power data and persists to test_readings.
 * Runs on a configurable interval (default 1s) during active test runs.
 */

import { getPool, generateUUID } from '../../database.js';
import { getAdapter } from '../adapters/interface.js';
import type { TestStation, TestOutlet, TestReading, InstantReadings } from '../types.js';

const DEFAULT_POLL_INTERVAL_MS = 1000;

interface ActiveCollection {
  testRunId: string;
  station: TestStation;
  outlet: TestOutlet;
  timer: ReturnType<typeof setInterval>;
  readingCount: number;
}

// Track active polling sessions
const activeCollections = new Map<string, ActiveCollection>();

/**
 * Start collecting readings for a test run
 */
export function startCollecting(
  testRunId: string,
  station: TestStation,
  outlet: TestOutlet,
  intervalMs: number = DEFAULT_POLL_INTERVAL_MS
): void {
  if (activeCollections.has(testRunId)) {
    throw new Error(`Already collecting for test run: ${testRunId}`);
  }

  const timer = setInterval(async () => {
    try {
      await pollAndRecord(testRunId, station, outlet);
      const collection = activeCollections.get(testRunId);
      if (collection) collection.readingCount++;
    } catch (err) {
      console.error(`[ReadingsCollector] Poll error for ${testRunId}:`, err);
    }
  }, intervalMs);

  activeCollections.set(testRunId, {
    testRunId,
    station,
    outlet,
    timer,
    readingCount: 0,
  });
}

/**
 * Stop collecting readings for a test run
 */
export function stopCollecting(testRunId: string): number {
  const collection = activeCollections.get(testRunId);
  if (!collection) return 0;

  clearInterval(collection.timer);
  const count = collection.readingCount;
  activeCollections.delete(testRunId);
  return count;
}

/**
 * Check if actively collecting for a test run
 */
export function isCollecting(testRunId: string): boolean {
  return activeCollections.has(testRunId);
}

/**
 * Get count of active collections
 */
export function activeCount(): number {
  return activeCollections.size;
}

/**
 * Stop all active collections (cleanup on shutdown)
 */
export function stopAll(): void {
  for (const [id, collection] of activeCollections) {
    clearInterval(collection.timer);
    activeCollections.delete(id);
  }
}

/**
 * Get readings for a test run
 */
export async function getReadings(
  testRunId: string,
  limit?: number
): Promise<TestReading[]> {
  const db = getPool();
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const result = await db.query<Record<string, unknown>>(
    `SELECT * FROM test_readings WHERE test_run_id = $1 ORDER BY ts DESC ${limitClause}`,
    [testRunId]
  );
  return result.rows.map(rowToReading);
}

/**
 * Get latest reading for a test run
 */
export async function getLatestReading(
  testRunId: string
): Promise<TestReading | null> {
  const readings = await getReadings(testRunId, 1);
  return readings[0] || null;
}

/**
 * Record a single reading manually (for manual adapter or external sources)
 */
export async function recordReading(
  testRunId: string,
  readings: InstantReadings
): Promise<TestReading> {
  return persistReading(testRunId, readings);
}

// ==================== PRIVATE ====================

async function pollAndRecord(
  testRunId: string,
  station: TestStation,
  outlet: TestOutlet
): Promise<void> {
  const adapter = getAdapter(station.controllerType);
  const readings = await adapter.getInstantReadings(station, outlet);
  await persistReading(testRunId, readings);
}

async function persistReading(
  testRunId: string,
  readings: InstantReadings
): Promise<TestReading> {
  const db = getPool();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO test_readings (
      id, test_run_id, ts, watts, volts, amps, raw
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      testRunId,
      now,
      readings.watts ?? null,
      readings.volts ?? null,
      readings.amps ?? null,
      JSON.stringify(readings.raw),
    ]
  );

  return {
    id,
    testRunId,
    ts: new Date(now),
    watts: readings.watts,
    volts: readings.volts,
    amps: readings.amps,
    raw: readings.raw,
  };
}

// ==================== ROW CONVERTER ====================

function rowToReading(row: Record<string, unknown>): TestReading {
  let raw: Record<string, unknown> = {};
  if (row.raw) {
    if (typeof row.raw === 'string') {
      try { raw = JSON.parse(row.raw); } catch { /* empty */ }
    } else {
      raw = row.raw as Record<string, unknown>;
    }
  }

  return {
    id: row.id as string,
    testRunId: row.test_run_id as string,
    ts: new Date(row.ts as string),
    watts: row.watts as number | undefined,
    volts: row.volts as number | undefined,
    amps: row.amps as number | undefined,
    tempC: row.temp_c as number | undefined,
    pressure: row.pressure as number | undefined,
    raw,
  };
}
