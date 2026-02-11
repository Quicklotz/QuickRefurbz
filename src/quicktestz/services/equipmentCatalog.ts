/**
 * QuickTestz - Equipment Catalog Service
 * CRUD for test equipment catalog items (Shelly, IoTaWatt, APC PDU, etc.)
 */

import { getPool, generateUUID } from '../../database.js';
import type { EquipmentCatalogItem, EquipmentCatalogInput } from '../types.js';

export async function listEquipment(): Promise<EquipmentCatalogItem[]> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_equipment_catalog ORDER BY name'
  );
  return result.rows.map(rowToEquipment);
}

export async function getEquipment(id: string): Promise<EquipmentCatalogItem | null> {
  const db = getPool();
  const result = await db.query<Record<string, unknown>>(
    'SELECT * FROM test_equipment_catalog WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToEquipment(result.rows[0]);
}

export async function createEquipment(input: EquipmentCatalogInput): Promise<EquipmentCatalogItem> {
  const db = getPool();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.query(
    `INSERT INTO test_equipment_catalog (
      id, name, category, vendor, model, integration_type,
      connection, capabilities, link_url, required_for_categories,
      notes, is_custom, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      input.name,
      input.category,
      input.vendor,
      input.model,
      input.integrationType,
      JSON.stringify(input.connection || []),
      JSON.stringify(input.capabilities || []),
      input.linkUrl || null,
      JSON.stringify(input.requiredForCategories || []),
      input.notes || null,
      true, // isCustom = true for user-created
      now,
    ]
  );

  return {
    id,
    name: input.name,
    category: input.category,
    vendor: input.vendor,
    model: input.model,
    integrationType: input.integrationType,
    connection: input.connection || [],
    capabilities: input.capabilities || [],
    linkUrl: input.linkUrl || '',
    requiredForCategories: input.requiredForCategories || [],
    notes: input.notes,
    isCustom: true,
    createdAt: new Date(now),
  };
}

export async function updateEquipment(
  id: string,
  input: Partial<EquipmentCatalogInput>
): Promise<EquipmentCatalogItem | null> {
  const existing = await getEquipment(id);
  if (!existing) return null;

  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `UPDATE test_equipment_catalog SET
      name = $1, category = $2, vendor = $3, model = $4,
      integration_type = $5, connection = $6, capabilities = $7,
      link_url = $8, required_for_categories = $9, notes = $10,
      updated_at = $11
     WHERE id = $12`,
    [
      input.name ?? existing.name,
      input.category ?? existing.category,
      input.vendor ?? existing.vendor,
      input.model ?? existing.model,
      input.integrationType ?? existing.integrationType,
      JSON.stringify(input.connection ?? existing.connection),
      JSON.stringify(input.capabilities ?? existing.capabilities),
      input.linkUrl ?? existing.linkUrl,
      JSON.stringify(input.requiredForCategories ?? existing.requiredForCategories),
      input.notes ?? existing.notes,
      now,
      id,
    ]
  );

  return getEquipment(id);
}

export async function deleteEquipment(id: string): Promise<boolean> {
  const db = getPool();
  const result = await db.query(
    'DELETE FROM test_equipment_catalog WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// ==================== ROW CONVERTER ====================

function rowToEquipment(row: Record<string, unknown>): EquipmentCatalogItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    vendor: row.vendor as string,
    model: row.model as string,
    integrationType: row.integration_type as EquipmentCatalogItem['integrationType'],
    connection: parseJsonArray(row.connection),
    capabilities: parseJsonArray(row.capabilities),
    linkUrl: (row.link_url as string) || '',
    requiredForCategories: parseJsonArray(row.required_for_categories),
    notes: row.notes as string | undefined,
    isCustom: Boolean(row.is_custom),
    createdAt: new Date(row.created_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}
