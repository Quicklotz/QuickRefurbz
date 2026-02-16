/**
 * QuickRefurbz - Parts Inventory Manager
 * Parts tracking and deduction using QLID identity
 */

import type {
  Part,
  PartsUsage,
  PartCategory,
  ProductCategory
} from './types.js';
import { getPool, parseIdentifier, generateUUID, nowFn, isPostgres } from './database.js';
import { getItem } from './itemManager.js';

// ==================== CREATE ====================

export interface AddPartOptions {
  partNumber: string;
  name: string;
  description?: string;
  category: PartCategory;
  compatibleCategories?: ProductCategory[];
  compatibleManufacturers?: string[];
  quantityOnHand?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  unitCost: number;
  location?: string;
}

export async function addPart(options: AddPartOptions): Promise<Part> {
  const db = getPool();

  // Check for duplicate part number
  const existing = await db.query(
    'SELECT id FROM parts_inventory WHERE part_number = $1',
    [options.partNumber]
  );
  if (existing.rows.length > 0) {
    throw new Error(`Part number ${options.partNumber} already exists`);
  }

  const id = generateUUID();
  // For SQLite, store arrays as JSON strings
  const compatibleCategories = isPostgres()
    ? (options.compatibleCategories || [])
    : JSON.stringify(options.compatibleCategories || []);
  const compatibleManufacturers = isPostgres()
    ? (options.compatibleManufacturers || [])
    : JSON.stringify(options.compatibleManufacturers || []);

  const result = await db.query(`
    INSERT INTO parts_inventory (
      id, part_number, name, description, category,
      compatible_categories, compatible_manufacturers,
      quantity_on_hand, reorder_point, reorder_quantity,
      unit_cost, location
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    id,
    options.partNumber,
    options.name,
    options.description || null,
    options.category,
    compatibleCategories,
    compatibleManufacturers,
    options.quantityOnHand || 0,
    options.reorderPoint || 5,
    options.reorderQuantity || 10,
    options.unitCost,
    options.location || null
  ]);

  if (!result.rows.length) throw new Error('Failed to insert part: INSERT RETURNING returned no rows');
  return rowToPart(result.rows[0]);
}

// ==================== READ ====================

export async function getPartById(partId: string): Promise<Part | null> {
  const db = getPool();
  const result = await db.query(`
    SELECT * FROM parts_inventory
    WHERE id = $1 OR part_number = $1
  `, [partId]);

  if (result.rows.length === 0) return null;
  return rowToPart(result.rows[0]);
}

export interface ListPartsOptions {
  category?: PartCategory;
  lowStockOnly?: boolean;
  compatibleWith?: ProductCategory;
  limit?: number;
}

export async function listParts(options: ListPartsOptions = {}): Promise<Part[]> {
  const db = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(options.category);
  }

  if (options.lowStockOnly) {
    conditions.push('quantity_on_hand <= reorder_point');
  }

  if (options.compatibleWith) {
    if (isPostgres()) {
      conditions.push(`($${paramIndex} = ANY(compatible_categories) OR compatible_categories = '{}')`);
    } else {
      // SQLite: search in JSON array string or empty array
      conditions.push(`(compatible_categories LIKE '%' || $${paramIndex} || '%' OR compatible_categories = '[]')`);
    }
    params.push(options.compatibleWith);
    paramIndex++;
  }

  let query = 'SELECT * FROM parts_inventory';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY name ASC';

  if (options.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  const result = await db.query(query, params);
  return result.rows.map(rowToPart);
}

export async function getLowStockParts(): Promise<Part[]> {
  return listParts({ lowStockOnly: true });
}

// ==================== UPDATE ====================

export async function updatePart(
  partId: string,
  updates: Partial<Part>
): Promise<Part | null> {
  const part = await getPartById(partId);
  if (!part) return null;

  const db = getPool();
  const setClause: string[] = [`updated_at = ${nowFn()}`];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClause.push(`name = $${paramIndex++}`);
    params.push(updates.name);
  }

  if (updates.description !== undefined) {
    setClause.push(`description = $${paramIndex++}`);
    params.push(updates.description);
  }

  if (updates.quantityOnHand !== undefined) {
    setClause.push(`quantity_on_hand = $${paramIndex++}`);
    params.push(updates.quantityOnHand);
  }

  if (updates.quantityReserved !== undefined) {
    setClause.push(`quantity_reserved = $${paramIndex++}`);
    params.push(updates.quantityReserved);
  }

  if (updates.reorderPoint !== undefined) {
    setClause.push(`reorder_point = $${paramIndex++}`);
    params.push(updates.reorderPoint);
  }

  if (updates.reorderQuantity !== undefined) {
    setClause.push(`reorder_quantity = $${paramIndex++}`);
    params.push(updates.reorderQuantity);
  }

  if (updates.unitCost !== undefined) {
    setClause.push(`unit_cost = $${paramIndex++}`);
    params.push(updates.unitCost);
  }

  if (updates.location !== undefined) {
    setClause.push(`location = $${paramIndex++}`);
    params.push(updates.location);
  }

  if (updates.lastRestockedAt !== undefined) {
    setClause.push(`last_restocked_at = $${paramIndex++}`);
    // Convert Date to ISO string for SQLite compatibility
    params.push(updates.lastRestockedAt instanceof Date ? updates.lastRestockedAt.toISOString() : updates.lastRestockedAt);
  }

  params.push(part.id);
  const result = await db.query(
    `UPDATE parts_inventory SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  if (!result.rows.length) throw new Error('Failed to update part: UPDATE RETURNING returned no rows');
  return rowToPart(result.rows[0]);
}

export interface AdjustInventoryOptions {
  adjustment: number;  // Positive for add, negative for subtract
  reason: string;
}

export async function adjustInventory(
  partId: string,
  options: AdjustInventoryOptions
): Promise<Part | null> {
  const part = await getPartById(partId);
  if (!part) {
    throw new Error(`Part not found: ${partId}`);
  }

  const newQuantity = part.quantityOnHand + options.adjustment;
  if (newQuantity < 0) {
    throw new Error(`Cannot reduce quantity below 0. Current: ${part.quantityOnHand}, Adjustment: ${options.adjustment}`);
  }

  return updatePart(partId, {
    quantityOnHand: newQuantity,
    lastRestockedAt: options.adjustment > 0 ? new Date() : part.lastRestockedAt
  });
}

export async function restockPart(
  partId: string,
  quantity: number
): Promise<Part | null> {
  if (quantity <= 0) {
    throw new Error('Restock quantity must be positive');
  }

  return adjustInventory(partId, {
    adjustment: quantity,
    reason: 'Restock'
  });
}

// ==================== USE PARTS ====================

export interface UsePartsOptions {
  identifier: string;                  // QLID or barcode
  ticketId?: string;
  parts: Array<{
    partId: string;
    quantity: number;
    notes?: string;
  }>;
  technicianId: string;
}

export async function useParts(options: UsePartsOptions): Promise<PartsUsage[]> {
  // Verify item exists
  const item = await getItem(options.identifier);
  if (!item) {
    throw new Error(`Item not found: ${options.identifier}`);
  }

  const db = getPool();

  // Verify technician exists
  const techResult = await db.query<{ id: string; name: string }>(
    'SELECT id, name FROM technicians WHERE id = $1 OR employee_id = $1 OR LOWER(name) = LOWER($1)',
    [options.technicianId]
  );
  if (techResult.rows.length === 0) {
    throw new Error(`Technician not found: ${options.technicianId}`);
  }
  const tech = techResult.rows[0];

  // Verify ticket if provided
  let ticketNumber: string | undefined;
  if (options.ticketId) {
    const ticketResult = await db.query<{ id: string; ticket_number: string }>(
      'SELECT id, ticket_number FROM repair_tickets WHERE id = $1 OR ticket_number = $1',
      [options.ticketId]
    );
    if (ticketResult.rows.length === 0) {
      throw new Error(`Ticket not found: ${options.ticketId}`);
    }
    ticketNumber = ticketResult.rows[0].ticket_number;
  }

  const usageRecords: PartsUsage[] = [];

  for (const partRequest of options.parts) {
    const part = await getPartById(partRequest.partId);
    if (!part) {
      throw new Error(`Part not found: ${partRequest.partId}`);
    }

    const available = part.quantityOnHand - part.quantityReserved;
    if (available < partRequest.quantity) {
      throw new Error(`Insufficient stock for ${part.name}. Available: ${available}, Requested: ${partRequest.quantity}`);
    }

    // Deduct from inventory
    await updatePart(part.id, {
      quantityOnHand: part.quantityOnHand - partRequest.quantity
    });

    // Create usage record
    const usageId = generateUUID();
    const usageResult = await db.query(`
      INSERT INTO parts_usage (
        id, qlid, ticket_id, ticket_number,
        part_id, part_number, part_name,
        quantity, unit_cost, total_cost,
        used_by_technician_id, used_by_technician_name, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      usageId,
      item.qlid,
      options.ticketId || null,
      ticketNumber || null,
      part.id,
      part.partNumber,
      part.name,
      partRequest.quantity,
      part.unitCost,
      part.unitCost * partRequest.quantity,
      tech.id,
      tech.name,
      partRequest.notes || null
    ]);

    if (!usageResult.rows.length) throw new Error('Failed to insert parts usage: INSERT RETURNING returned no rows');
    usageRecords.push(rowToPartsUsage(usageResult.rows[0]));
  }

  return usageRecords;
}

// ==================== USAGE HISTORY ====================

export async function getPartsUsageForItem(identifier: string): Promise<PartsUsage[]> {
  const parsed = parseIdentifier(identifier);
  const db = getPool();

  const result = await db.query(`
    SELECT * FROM parts_usage
    WHERE qlid = $1
    ORDER BY created_at DESC
  `, [parsed.qlid]);

  return result.rows.map(rowToPartsUsage);
}

export async function getPartsUsageForPart(partId: string): Promise<PartsUsage[]> {
  const part = await getPartById(partId);
  if (!part) return [];

  const db = getPool();
  const result = await db.query(`
    SELECT * FROM parts_usage
    WHERE part_id = $1
    ORDER BY created_at DESC
  `, [part.id]);

  return result.rows.map(rowToPartsUsage);
}

export async function getTotalPartsUsage(): Promise<PartsUsage[]> {
  const db = getPool();
  const result = await db.query(`
    SELECT * FROM parts_usage
    ORDER BY created_at DESC
  `);
  return result.rows.map(rowToPartsUsage);
}

// ==================== DELETE ====================

export async function deletePart(partId: string): Promise<boolean> {
  const part = await getPartById(partId);
  if (!part) return false;

  const db = getPool();

  // Check if part has been used
  const usageResult = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM parts_usage WHERE part_id = $1',
    [part.id]
  );
  const usageCount = usageResult.rows[0] ? parseInt(usageResult.rows[0].count) : 0;
  if (usageCount > 0) {
    throw new Error(`Cannot delete part with usage history. Part has been used ${usageCount} times.`);
  }

  const result = await db.query('DELETE FROM parts_inventory WHERE id = $1', [part.id]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== STATS ====================

export interface PartsStats {
  totalParts: number;
  totalValue: number;
  lowStockCount: number;
  byCategory: Record<string, number>;
  totalUsageCount: number;
  totalUsageCost: number;
}

export async function getPartsStats(): Promise<PartsStats> {
  const db = getPool();

  const stats: PartsStats = {
    totalParts: 0,
    totalValue: 0,
    lowStockCount: 0,
    byCategory: {},
    totalUsageCount: 0,
    totalUsageCost: 0
  };

  // Total parts and value
  const partsResult = await db.query<{ count: string; total_value: string }>(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(quantity_on_hand * unit_cost), 0) as total_value
    FROM parts_inventory
  `);
  stats.totalParts = partsResult.rows[0] ? parseInt(partsResult.rows[0].count) : 0;
  stats.totalValue = partsResult.rows[0] ? parseFloat(partsResult.rows[0].total_value) : 0;

  // Low stock count (separate query for SQLite compatibility)
  const lowStockResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count FROM parts_inventory
    WHERE quantity_on_hand <= reorder_point
  `);
  stats.lowStockCount = lowStockResult.rows[0] ? parseInt(lowStockResult.rows[0].count) : 0;

  // By category
  const categoryResult = await db.query<{ category: string; count: string }>(`
    SELECT category, COUNT(*) as count
    FROM parts_inventory
    GROUP BY category
  `);
  for (const row of categoryResult.rows) {
    stats.byCategory[row.category] = parseInt(row.count);
  }

  // Usage stats
  const usageResult = await db.query<{ total_count: string; total_cost: string }>(`
    SELECT
      COALESCE(SUM(quantity), 0) as total_count,
      COALESCE(SUM(total_cost), 0) as total_cost
    FROM parts_usage
  `);
  stats.totalUsageCount = usageResult.rows[0] ? parseInt(usageResult.rows[0].total_count) : 0;
  stats.totalUsageCost = usageResult.rows[0] ? parseFloat(usageResult.rows[0].total_cost) : 0;

  return stats;
}

// ==================== HELPERS ====================

function rowToPart(row: Record<string, unknown>): Part {
  // Handle arrays: could be array (Postgres) or JSON string (SQLite)
  let compatibleCategories: ProductCategory[] = [];
  if (row.compatible_categories) {
    if (typeof row.compatible_categories === 'string') {
      try {
        compatibleCategories = JSON.parse(row.compatible_categories);
      } catch {
        compatibleCategories = [];
      }
    } else {
      compatibleCategories = row.compatible_categories as ProductCategory[];
    }
  }

  let compatibleManufacturers: string[] = [];
  if (row.compatible_manufacturers) {
    if (typeof row.compatible_manufacturers === 'string') {
      try {
        compatibleManufacturers = JSON.parse(row.compatible_manufacturers);
      } catch {
        compatibleManufacturers = [];
      }
    } else {
      compatibleManufacturers = row.compatible_manufacturers as string[];
    }
  }

  return {
    id: row.id as string,
    partNumber: row.part_number as string,
    name: row.name as string,
    description: row.description as string | undefined,
    category: row.category as PartCategory,
    compatibleCategories,
    compatibleManufacturers,
    quantityOnHand: parseInt(row.quantity_on_hand as string),
    quantityReserved: parseInt(row.quantity_reserved as string),
    reorderPoint: parseInt(row.reorder_point as string),
    reorderQuantity: parseInt(row.reorder_quantity as string),
    unitCost: parseFloat(row.unit_cost as string),
    location: row.location as string | undefined,
    lastRestockedAt: row.last_restocked_at as Date | undefined,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}

function rowToPartsUsage(row: Record<string, unknown>): PartsUsage {
  return {
    id: row.id as string,
    qlid: row.qlid as string,
    ticketId: row.ticket_id as string | undefined,
    ticketNumber: row.ticket_number as string | undefined,
    partId: row.part_id as string,
    partNumber: row.part_number as string,
    partName: row.part_name as string,
    quantity: parseInt(row.quantity as string),
    unitCost: parseFloat(row.unit_cost as string),
    totalCost: parseFloat(row.total_cost as string),
    usedByTechnicianId: row.used_by_technician_id as string,
    usedByTechnicianName: row.used_by_technician_name as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: row.created_at as Date
  };
}
