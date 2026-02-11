/**
 * QuickTestz - Profile Manager Service
 * CRUD for test profiles (category-specific thresholds + operator checklists)
 */

import { getPool, generateUUID } from '../../database.js';
import type {
  TestProfile,
  TestProfileInput,
  TestThresholds,
  ChecklistItem,
} from '../types.js';

export async function listProfiles(): Promise<TestProfile[]> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_profiles ORDER BY category, name'
  );
  return result.rows.map(rowToProfile);
}

export async function getProfile(id: string): Promise<TestProfile | null> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_profiles WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToProfile(result.rows[0]);
}

export async function getProfileByCategory(category: string): Promise<TestProfile | null> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_profiles WHERE category = $1 ORDER BY created_at DESC LIMIT 1',
    [category]
  );
  if (result.rows.length === 0) return null;
  return rowToProfile(result.rows[0]);
}

export async function createProfile(input: TestProfileInput): Promise<TestProfile> {
  const db = getPool();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO test_profiles (
      id, category, name, thresholds, operator_checklist, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.category,
      input.name,
      JSON.stringify(input.thresholds),
      JSON.stringify(input.operatorChecklist),
      now,
    ]
  );

  return {
    id,
    category: input.category,
    name: input.name,
    thresholds: input.thresholds,
    operatorChecklist: input.operatorChecklist,
    createdAt: new Date(now),
  };
}

export async function updateProfile(
  id: string,
  input: Partial<TestProfileInput>
): Promise<TestProfile | null> {
  const existing = await getProfile(id);
  if (!existing) return null;

  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `UPDATE test_profiles SET
      category = $1, name = $2, thresholds = $3,
      operator_checklist = $4, updated_at = $5
     WHERE id = $6`,
    [
      input.category ?? existing.category,
      input.name ?? existing.name,
      JSON.stringify(input.thresholds ?? existing.thresholds),
      JSON.stringify(input.operatorChecklist ?? existing.operatorChecklist),
      now,
      id,
    ]
  );

  return getProfile(id);
}

export async function deleteProfile(id: string): Promise<boolean> {
  const db = getPool();
  const result = await db.query('DELETE FROM test_profiles WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== ROW CONVERTER ====================

function rowToProfile(row: Record<string, unknown>): TestProfile {
  return {
    id: row.id as string,
    category: row.category as string,
    name: row.name as string,
    thresholds: parseJson<TestThresholds>(row.thresholds, {
      maxPeakWatts: 1500,
      minStableWatts: 1,
      maxStableWatts: 1500,
      spikeShutdownWatts: 2000,
      minRunSeconds: 30,
    }),
    operatorChecklist: parseJson<ChecklistItem[]>(row.operator_checklist, []),
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (val && typeof val === 'object' && !Array.isArray(val) || Array.isArray(val)) {
    return val as T;
  }
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return fallback;
}
