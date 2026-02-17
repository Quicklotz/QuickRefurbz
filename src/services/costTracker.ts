/**
 * Cost Tracker Service
 * Aggregates and calculates total refurbishment costs from all sources
 * (COGS + parts + labor + overhead)
 */

import { getPool, generateUUID } from '../database.js';
import { getPartsUsageForItem } from '../partsInventory.js';

// ==================== TYPES ====================

export interface LaborEntry {
  id: string;
  qlid: string;
  technicianId: string;
  technicianName?: string;
  taskDescription: string;
  minutesSpent: number;
  hourlyRate: number;
  laborCost: number;
  createdAt: string;
}

export interface RefurbCost {
  id: string;
  qlid: string;
  unitCogs: number;
  partsCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  estimatedValue: number | null;
  profitMargin: number | null;
  calculatedAt: string;
}

export interface CostBreakdown {
  qlid: string;
  unitCogs: number;
  partsCost: number;
  partsCount: number;
  laborCost: number;
  laborMinutes: number;
  overheadCost: number;
  totalCost: number;
  estimatedValue: number | null;
  profitMargin: number | null;
  partsDetail: Array<{
    partName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  laborDetail: Array<{
    stage: string;
    technicianName: string;
    durationMinutes: number;
    laborCost: number;
  }>;
}

// ==================== CONFIGURATION ====================

const DEFAULT_LABOR_RATE = parseFloat(process.env.DEFAULT_LABOR_RATE || '25'); // $/hour
const OVERHEAD_RATE = parseFloat(process.env.OVERHEAD_RATE || '0.10'); // 10% overhead

// ==================== LABOR TRACKING ====================

/**
 * Record labor entry for an item
 */
export async function recordLabor(data: {
  qlid: string;
  technicianId: string;
  taskDescription: string;
  minutesSpent: number;
  hourlyRate?: number;
}): Promise<LaborEntry> {
  const db = getPool();
  const id = generateUUID();
  const rate = data.hourlyRate || DEFAULT_LABOR_RATE;
  const now = new Date().toISOString();

  // Get technician name
  const techResult = await db.query<{ name: string }>(
    `SELECT name FROM users WHERE id = $1`,
    [data.technicianId]
  );
  const technicianName = techResult.rows[0]?.name || 'Unknown';

  // labor_cost is a GENERATED column (minutes_spent * hourly_rate / 60), do not insert it
  await db.query(`
    INSERT INTO labor_entries (
      id, qlid, technician_id, technician_name,
      task_description, minutes_spent, hourly_rate
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    id,
    data.qlid,
    data.technicianId,
    technicianName,
    data.taskDescription,
    data.minutesSpent,
    rate
  ]);

  const laborCost = (data.minutesSpent * rate) / 60;

  return {
    id,
    qlid: data.qlid,
    technicianId: data.technicianId,
    technicianName,
    taskDescription: data.taskDescription,
    minutesSpent: data.minutesSpent,
    hourlyRate: rate,
    laborCost,
    createdAt: now
  };
}

/**
 * Get labor entries for an item
 */
export async function getLaborForItem(qlid: string): Promise<LaborEntry[]> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    qlid: string;
    technician_id: string;
    technician_name: string;
    task_description: string;
    minutes_spent: number;
    hourly_rate: number;
    labor_cost: number;
    created_at: string;
  }>(`
    SELECT * FROM labor_entries WHERE qlid = $1 ORDER BY created_at DESC
  `, [qlid]);

  return result.rows.map(row => ({
    id: row.id,
    qlid: row.qlid,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    taskDescription: row.task_description,
    minutesSpent: row.minutes_spent,
    hourlyRate: row.hourly_rate,
    laborCost: row.labor_cost,
    createdAt: row.created_at
  }));
}

// ==================== COST CALCULATION ====================

/**
 * Calculate and save complete cost breakdown for an item
 */
export async function calculateCosts(qlid: string, unitCogs: number = 0): Promise<RefurbCost> {
  const db = getPool();
  const id = generateUUID();

  // Get parts costs
  const partsUsage = await getPartsUsageForItem(qlid);
  const partsCost = partsUsage.reduce((sum, p) => sum + p.totalCost, 0);

  // Get labor costs
  const laborEntries = await getLaborForItem(qlid);
  const laborCost = laborEntries.reduce((sum, l) => sum + l.laborCost, 0);

  // Calculate overhead
  const subtotal = unitCogs + partsCost + laborCost;
  const overheadCost = subtotal * OVERHEAD_RATE;

  // Total cost
  const totalCost = subtotal + overheadCost;

  // Get estimated value from item if available
  const itemResult = await db.query<{ estimated_value: number | null }>(
    `SELECT estimated_value FROM refurb_items WHERE qlid = $1`,
    [qlid]
  );
  const estimatedValue = itemResult.rows[0]?.estimated_value || null;

  // Calculate profit margin
  let profitMargin: number | null = null;
  if (estimatedValue && estimatedValue > 0) {
    profitMargin = ((estimatedValue - totalCost) / estimatedValue) * 100;
  }

  // Save cost record
  await db.query(`
    INSERT INTO refurb_costs (
      id, qlid, unit_cogs, parts_cost, labor_cost, overhead_cost,
      total_cost, estimated_value, profit_margin
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (qlid) DO UPDATE SET
      unit_cogs = EXCLUDED.unit_cogs,
      parts_cost = EXCLUDED.parts_cost,
      labor_cost = EXCLUDED.labor_cost,
      overhead_cost = EXCLUDED.overhead_cost,
      total_cost = EXCLUDED.total_cost,
      estimated_value = EXCLUDED.estimated_value,
      profit_margin = EXCLUDED.profit_margin,
      calculated_at = CURRENT_TIMESTAMP
  `, [
    id,
    qlid,
    unitCogs,
    partsCost,
    laborCost,
    overheadCost,
    totalCost,
    estimatedValue,
    profitMargin
  ]);

  return {
    id,
    qlid,
    unitCogs,
    partsCost,
    laborCost,
    overheadCost,
    totalCost,
    estimatedValue,
    profitMargin,
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Get full cost breakdown with details
 */
export async function getCostBreakdown(qlid: string): Promise<CostBreakdown | null> {
  const db = getPool();

  // Get saved cost summary
  const costResult = await db.query<{
    unit_cogs: number;
    estimated_value: number | null;
  }>(`
    SELECT unit_cogs, estimated_value FROM refurb_costs WHERE qlid = $1
  `, [qlid]);

  const unitCogs = costResult.rows[0]?.unit_cogs || 0;
  const estimatedValue = costResult.rows[0]?.estimated_value || null;

  // Get parts detail
  const partsUsage = await getPartsUsageForItem(qlid);
  const partsCost = partsUsage.reduce((sum, p) => sum + p.totalCost, 0);
  const partsDetail = partsUsage.map(p => ({
    partName: p.partName,
    quantity: p.quantity,
    unitCost: p.unitCost,
    totalCost: p.totalCost
  }));

  // Get labor detail
  const laborEntries = await getLaborForItem(qlid);
  const laborCost = laborEntries.reduce((sum, l) => sum + l.laborCost, 0);
  const laborMinutes = laborEntries.reduce((sum, l) => sum + l.minutesSpent, 0);
  const laborDetail = laborEntries.map(l => ({
    stage: l.taskDescription,
    technicianName: l.technicianName || 'Unknown',
    durationMinutes: l.minutesSpent,
    laborCost: l.laborCost
  }));

  // Calculate totals
  const subtotal = unitCogs + partsCost + laborCost;
  const overheadCost = subtotal * OVERHEAD_RATE;
  const totalCost = subtotal + overheadCost;

  let profitMargin: number | null = null;
  if (estimatedValue && estimatedValue > 0) {
    profitMargin = ((estimatedValue - totalCost) / estimatedValue) * 100;
  }

  return {
    qlid,
    unitCogs,
    partsCost,
    partsCount: partsUsage.length,
    laborCost,
    laborMinutes,
    overheadCost,
    totalCost,
    estimatedValue,
    profitMargin,
    partsDetail,
    laborDetail
  };
}

/**
 * Get cost summary (without details)
 */
export async function getCostSummary(qlid: string): Promise<RefurbCost | null> {
  const db = getPool();

  const result = await db.query<{
    id: string;
    qlid: string;
    unit_cogs: number;
    parts_cost: number;
    labor_cost: number;
    overhead_cost: number;
    total_cost: number;
    estimated_value: number | null;
    profit_margin: number | null;
    calculated_at: string;
  }>(`SELECT * FROM refurb_costs WHERE qlid = $1`, [qlid]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    qlid: row.qlid,
    unitCogs: row.unit_cogs,
    partsCost: row.parts_cost,
    laborCost: row.labor_cost,
    overheadCost: row.overhead_cost,
    totalCost: row.total_cost,
    estimatedValue: row.estimated_value,
    profitMargin: row.profit_margin,
    calculatedAt: row.calculated_at
  };
}

/**
 * Update unit COGS for an item
 */
export async function setUnitCogs(qlid: string, unitCogs: number): Promise<RefurbCost> {
  return calculateCosts(qlid, unitCogs);
}

/**
 * Update estimated value for an item
 */
export async function setEstimatedValue(qlid: string, estimatedValue: number): Promise<void> {
  const db = getPool();

  await db.query(`
    UPDATE refurb_items SET estimated_value = $1 WHERE qlid = $2
  `, [estimatedValue, qlid]);

  // Recalculate costs to update profit margin
  const existingCost = await getCostSummary(qlid);
  if (existingCost) {
    await calculateCosts(qlid, existingCost.unitCogs);
  }
}

// ==================== STATS ====================

/**
 * Get aggregate cost statistics
 */
export async function getCostStats(): Promise<{
  totalItems: number;
  totalPartsCost: number;
  totalLaborCost: number;
  totalCost: number;
  averageCostPerItem: number;
  averageProfitMargin: number;
  totalLaborMinutes: number;
}> {
  const db = getPool();

  const costResult = await db.query<{
    count: string;
    total_parts: string;
    total_labor: string;
    total_cost: string;
    avg_margin: string;
  }>(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(parts_cost), 0) as total_parts,
      COALESCE(SUM(labor_cost), 0) as total_labor,
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(AVG(profit_margin), 0) as avg_margin
    FROM refurb_costs
  `);

  const laborResult = await db.query<{ total_minutes: string }>(`
    SELECT COALESCE(SUM(minutes_spent), 0) as total_minutes FROM labor_entries
  `);

  const row = costResult.rows[0];
  const totalItems = parseInt(row.count);

  return {
    totalItems,
    totalPartsCost: parseFloat(row.total_parts),
    totalLaborCost: parseFloat(row.total_labor),
    totalCost: parseFloat(row.total_cost),
    averageCostPerItem: totalItems > 0 ? parseFloat(row.total_cost) / totalItems : 0,
    averageProfitMargin: parseFloat(row.avg_margin),
    totalLaborMinutes: parseInt(laborResult.rows[0].total_minutes)
  };
}
