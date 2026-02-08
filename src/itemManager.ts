/**
 * QuickRefurbz - Item Manager
 * Manages items through the refurbishment workflow using QLID identity
 */

import type {
  RefurbItem,
  StageTransition,
  RefurbStage,
  ProductCategory,
  JobPriority,
  FinalGrade,
  LabelData
} from './types.js';
import {
  STAGE_ORDER,
  isValidPalletId,
  getRetailerFromPalletId,
  RETAILER_CODE_DISPLAY
} from './types.js';
import {
  getPool,
  generateQlid,
  generateUUID,
  buildBarcode,
  parseIdentifier,
  isValidQlid
} from './database.js';

// ==================== RECEIVE ITEM (INTAKE) ====================

export interface ReceiveItemOptions {
  palletId: string;                    // P1BBY
  manufacturer: string;
  model: string;
  category: ProductCategory;
  serialNumber?: string;
  priority?: JobPriority;
  notes?: string;

  // Required intake metadata
  employeeId: string;                  // Who is intaking
  warehouseId: string;                 // Where
}

export interface ReceiveItemResult {
  item: RefurbItem;
  labelData: LabelData;
}

/**
 * Receive an item into QuickRefurbz
 * Allocates a new QLID atomically from Postgres
 */
export async function receiveItem(options: ReceiveItemOptions): Promise<ReceiveItemResult> {
  // Validate PalletID format
  if (!isValidPalletId(options.palletId)) {
    throw new Error(`Invalid PalletID format: ${options.palletId}. Expected format: P1BBY`);
  }

  const db = getPool();

  // Generate QLID atomically
  const { tick, qlid } = await generateQlid();
  const barcodeValue = buildBarcode(options.palletId, qlid);

  // Insert item (include id and barcode_value for SQLite compatibility)
  const id = generateUUID();
  const result = await db.query<{
    id: string;
    qlid_tick: string;
    qlid: string;
    pallet_id: string;
    barcode_value: string;
    intake_employee_id: string;
    warehouse_id: string;
    intake_ts: Date;
    manufacturer: string;
    model: string;
    category: string;
    serial_number: string | null;
    current_stage: string;
    priority: string;
    assigned_technician_id: string | null;
    final_grade: string | null;
    estimated_value: string | null;
    next_workflow: string | null;
    completed_at: Date | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
  }>(`
    INSERT INTO refurb_items (
      id, qlid_tick, qlid, pallet_id, barcode_value,
      intake_employee_id, warehouse_id,
      manufacturer, model, category,
      serial_number, priority, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [
    id,
    tick.toString(),
    qlid,
    options.palletId,
    barcodeValue,
    options.employeeId,
    options.warehouseId,
    options.manufacturer,
    options.model,
    options.category,
    options.serialNumber || null,
    options.priority || 'NORMAL',
    options.notes || null
  ]);

  const row = result.rows[0];
  const item = rowToItem(row);

  // Log initial stage transition
  await logStageTransition(qlid, null, 'INTAKE', undefined, undefined, 'Received into QuickRefurbz');

  // Prepare label data
  const labelData: LabelData = {
    barcodeValue,
    qlid,
    palletId: options.palletId,
    employeeId: options.employeeId,
    warehouseId: options.warehouseId,
    timestamp: item.intakeTs,
    manufacturer: options.manufacturer,
    model: options.model
  };

  return { item, labelData };
}

// ==================== READ ====================

/**
 * Get item by QLID or barcode
 */
export async function getItem(identifier: string): Promise<RefurbItem | null> {
  const db = getPool();
  let qlid: string;

  try {
    const parsed = parseIdentifier(identifier);
    qlid = parsed.qlid;
  } catch {
    // Maybe it's a direct QLID
    if (!isValidQlid(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    qlid = identifier;
  }

  const result = await db.query(`
    SELECT * FROM refurb_items WHERE qlid = $1
  `, [qlid]);

  if (result.rows.length === 0) return null;
  return rowToItem(result.rows[0]);
}

/**
 * Get item by UUID
 */
export async function getItemById(id: string): Promise<RefurbItem | null> {
  const db = getPool();
  const result = await db.query(`
    SELECT * FROM refurb_items WHERE id = $1
  `, [id]);

  if (result.rows.length === 0) return null;
  return rowToItem(result.rows[0]);
}

export interface ListItemsOptions {
  palletId?: string;
  stage?: RefurbStage;
  category?: ProductCategory;
  technicianId?: string;
  priority?: JobPriority;
  warehouseId?: string;
  limit?: number;
}

export async function listItems(options: ListItemsOptions = {}): Promise<RefurbItem[]> {
  const db = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.palletId) {
    conditions.push(`pallet_id = $${paramIndex++}`);
    params.push(options.palletId);
  }

  if (options.stage) {
    conditions.push(`current_stage = $${paramIndex++}`);
    params.push(options.stage);
  }

  if (options.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(options.category);
  }

  if (options.technicianId) {
    conditions.push(`assigned_technician_id = $${paramIndex++}`);
    params.push(options.technicianId);
  }

  if (options.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    params.push(options.priority);
  }

  if (options.warehouseId) {
    conditions.push(`warehouse_id = $${paramIndex++}`);
    params.push(options.warehouseId);
  }

  let query = 'SELECT * FROM refurb_items';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // Sort by priority (urgent first), then by intake time
  query += ` ORDER BY
    CASE priority
      WHEN 'URGENT' THEN 0
      WHEN 'HIGH' THEN 1
      WHEN 'NORMAL' THEN 2
      WHEN 'LOW' THEN 3
    END,
    intake_ts ASC`;

  if (options.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  const result = await db.query(query, params);
  return result.rows.map(rowToItem);
}

export async function getItemsByStage(stage: RefurbStage): Promise<RefurbItem[]> {
  return listItems({ stage });
}

// ==================== STAGE TRANSITIONS ====================

async function logStageTransition(
  qlid: string,
  fromStage: RefurbStage | null,
  toStage: RefurbStage,
  technicianId?: string,
  technicianName?: string,
  notes?: string,
  durationMinutes?: number
): Promise<void> {
  const db = getPool();
  const id = generateUUID();
  await db.query(`
    INSERT INTO stage_history (id, qlid, from_stage, to_stage, technician_id, technician_name, duration_minutes, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [id, qlid, fromStage, toStage, technicianId, technicianName, durationMinutes, notes]);
}

export interface AdvanceStageOptions {
  technicianId?: string;
  notes?: string;
  serialNumber?: string;
  finalGrade?: FinalGrade;
  estimatedValue?: number;
  nextWorkflow?: string;
}

export async function advanceStage(
  identifier: string,
  options: AdvanceStageOptions = {}
): Promise<RefurbItem> {
  const item = await getItem(identifier);
  if (!item) {
    throw new Error(`Item not found: ${identifier}`);
  }

  const currentIndex = STAGE_ORDER.indexOf(item.currentStage);
  if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) {
    throw new Error(`Item ${item.qlid} is already at final stage: ${item.currentStage}`);
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];
  const db = getPool();

  // Get technician name if provided
  let technicianName: string | undefined;
  if (options.technicianId) {
    const techResult = await db.query<{ name: string }>(
      'SELECT name FROM technicians WHERE id = $1 OR employee_id = $1',
      [options.technicianId]
    );
    if (techResult.rows.length > 0) {
      technicianName = techResult.rows[0].name;
    }
  }

  // Calculate duration in previous stage
  const historyResult = await db.query<{ created_at: string }>(
    'SELECT created_at FROM stage_history WHERE qlid = $1 ORDER BY created_at DESC LIMIT 1',
    [item.qlid]
  );
  let durationMinutes = 0;
  if (historyResult.rows.length > 0) {
    const lastTransition = new Date(historyResult.rows[0].created_at);
    durationMinutes = Math.round((Date.now() - lastTransition.getTime()) / 60000);
  }

  // Build update query
  const updates: string[] = ['current_stage = $1', 'updated_at = now()'];
  const params: unknown[] = [nextStage];
  let paramIndex = 2;

  if (options.technicianId) {
    updates.push(`assigned_technician_id = $${paramIndex++}`);
    params.push(options.technicianId);
  }

  if (options.serialNumber) {
    updates.push(`serial_number = $${paramIndex++}`);
    params.push(options.serialNumber);
  }

  if (nextStage === 'COMPLETE') {
    updates.push('completed_at = now()');
    if (options.finalGrade) {
      updates.push(`final_grade = $${paramIndex++}`);
      params.push(options.finalGrade);
    }
    if (options.estimatedValue !== undefined) {
      updates.push(`estimated_value = $${paramIndex++}`);
      params.push(options.estimatedValue);
    }
    if (options.nextWorkflow) {
      updates.push(`next_workflow = $${paramIndex++}`);
      params.push(options.nextWorkflow);
    }
  }

  params.push(item.qlid);
  const result = await db.query(
    `UPDATE refurb_items SET ${updates.join(', ')} WHERE qlid = $${paramIndex} RETURNING *`,
    params
  );

  // Log transition
  await logStageTransition(
    item.qlid,
    item.currentStage,
    nextStage,
    options.technicianId,
    technicianName,
    options.notes,
    durationMinutes
  );

  return rowToItem(result.rows[0]);
}

export async function setStage(
  identifier: string,
  stage: RefurbStage,
  options: AdvanceStageOptions = {}
): Promise<RefurbItem> {
  const item = await getItem(identifier);
  if (!item) {
    throw new Error(`Item not found: ${identifier}`);
  }

  if (item.currentStage === stage) {
    throw new Error(`Item ${item.qlid} is already in stage ${stage}`);
  }

  const db = getPool();

  // Get technician name
  let technicianName: string | undefined;
  if (options.technicianId) {
    const techResult = await db.query<{ name: string }>(
      'SELECT name FROM technicians WHERE id = $1 OR employee_id = $1',
      [options.technicianId]
    );
    if (techResult.rows.length > 0) {
      technicianName = techResult.rows[0].name;
    }
  }

  const updates: string[] = ['current_stage = $1', 'updated_at = now()'];
  const params: unknown[] = [stage];
  let paramIndex = 2;

  if (options.technicianId) {
    updates.push(`assigned_technician_id = $${paramIndex++}`);
    params.push(options.technicianId);
  }

  if (stage === 'COMPLETE') {
    updates.push('completed_at = now()');
    if (options.finalGrade) {
      updates.push(`final_grade = $${paramIndex++}`);
      params.push(options.finalGrade);
    }
    if (options.estimatedValue !== undefined) {
      updates.push(`estimated_value = $${paramIndex++}`);
      params.push(options.estimatedValue);
    }
    if (options.nextWorkflow) {
      updates.push(`next_workflow = $${paramIndex++}`);
      params.push(options.nextWorkflow);
    }
  }

  params.push(item.qlid);
  const result = await db.query(
    `UPDATE refurb_items SET ${updates.join(', ')} WHERE qlid = $${paramIndex} RETURNING *`,
    params
  );

  await logStageTransition(
    item.qlid,
    item.currentStage,
    stage,
    options.technicianId,
    technicianName,
    options.notes
  );

  return rowToItem(result.rows[0]);
}

// ==================== ASSIGNMENT ====================

export async function assignTechnician(identifier: string, technicianId: string): Promise<RefurbItem> {
  const item = await getItem(identifier);
  if (!item) {
    throw new Error(`Item not found: ${identifier}`);
  }

  const db = getPool();

  // Verify technician exists
  const techResult = await db.query(
    'SELECT id FROM technicians WHERE id = $1 OR employee_id = $1',
    [technicianId]
  );

  if (techResult.rows.length === 0) {
    throw new Error(`Technician not found: ${technicianId}`);
  }

  const result = await db.query(`
    UPDATE refurb_items
    SET assigned_technician_id = $1, updated_at = now()
    WHERE qlid = $2
    RETURNING *
  `, [techResult.rows[0].id, item.qlid]);

  return rowToItem(result.rows[0]);
}

// ==================== HISTORY ====================

export async function getStageHistory(identifier: string): Promise<StageTransition[]> {
  const parsed = parseIdentifier(identifier);
  const db = getPool();

  interface StageHistoryRow {
    id: string;
    qlid: string;
    from_stage: string | null;
    to_stage: string;
    technician_id: string | null;
    technician_name: string | null;
    duration_minutes: number | null;
    notes: string | null;
    created_at: Date;
  }

  const result = await db.query<StageHistoryRow>(`
    SELECT * FROM stage_history
    WHERE qlid = $1
    ORDER BY created_at ASC
  `, [parsed.qlid]);

  return result.rows.map(row => ({
    id: row.id,
    qlid: row.qlid,
    fromStage: row.from_stage as RefurbStage | null,
    toStage: row.to_stage as RefurbStage,
    technicianId: row.technician_id || undefined,
    technicianName: row.technician_name || undefined,
    durationMinutes: row.duration_minutes || undefined,
    notes: row.notes || undefined,
    // Convert SQLite string dates to Date objects
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at as unknown as string)
  }));
}

// ==================== DELETE ====================

export async function deleteItem(identifier: string): Promise<boolean> {
  const item = await getItem(identifier);
  if (!item) return false;

  const db = getPool();

  // Delete stage history first (foreign key)
  await db.query('DELETE FROM stage_history WHERE qlid = $1', [item.qlid]);

  // Delete item
  const result = await db.query('DELETE FROM refurb_items WHERE qlid = $1', [item.qlid]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== STATS ====================

export interface ItemStats {
  total: number;
  byStage: Record<RefurbStage, number>;
  byCategory: Record<string, number>;
  byPriority: Record<JobPriority, number>;
  byPallet: Record<string, number>;
  todayReceived: number;
  todayCompleted: number;
}

export async function getItemStats(): Promise<ItemStats> {
  const db = getPool();

  const stats: ItemStats = {
    total: 0,
    byStage: { INTAKE: 0, TESTING: 0, REPAIR: 0, CLEANING: 0, FINAL_QC: 0, COMPLETE: 0 },
    byCategory: {},
    byPriority: { LOW: 0, NORMAL: 0, HIGH: 0, URGENT: 0 },
    byPallet: {},
    todayReceived: 0,
    todayCompleted: 0
  };

  // Total count
  const totalResult = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM refurb_items');
  stats.total = parseInt(totalResult.rows[0].count);

  // By stage
  const stageResult = await db.query<{ current_stage: string; count: string }>(`
    SELECT current_stage, COUNT(*) as count
    FROM refurb_items
    GROUP BY current_stage
  `);
  for (const row of stageResult.rows) {
    stats.byStage[row.current_stage as RefurbStage] = parseInt(row.count);
  }

  // By category
  const categoryResult = await db.query<{ category: string; count: string }>(`
    SELECT category, COUNT(*) as count
    FROM refurb_items
    GROUP BY category
  `);
  for (const row of categoryResult.rows) {
    stats.byCategory[row.category] = parseInt(row.count);
  }

  // By priority
  const priorityResult = await db.query<{ priority: string; count: string }>(`
    SELECT priority, COUNT(*) as count
    FROM refurb_items
    GROUP BY priority
  `);
  for (const row of priorityResult.rows) {
    stats.byPriority[row.priority as JobPriority] = parseInt(row.count);
  }

  // By pallet
  const palletResult = await db.query<{ pallet_id: string; count: string }>(`
    SELECT pallet_id, COUNT(*) as count
    FROM refurb_items
    GROUP BY pallet_id
  `);
  for (const row of palletResult.rows) {
    stats.byPallet[row.pallet_id] = parseInt(row.count);
  }

  // Today's stats (compatible with both SQLite and Postgres)
  const todayReceivedResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count FROM refurb_items
    WHERE date(intake_ts) = date('now')
  `);
  stats.todayReceived = parseInt(todayReceivedResult.rows[0].count);

  const todayCompletedResult = await db.query<{ count: string }>(`
    SELECT COUNT(*) as count FROM refurb_items
    WHERE date(completed_at) = date('now')
  `);
  stats.todayCompleted = parseInt(todayCompletedResult.rows[0].count);

  return stats;
}

// ==================== HELPERS ====================

function rowToItem(row: Record<string, unknown>): RefurbItem {
  // Helper to convert SQLite string dates to Date objects
  const toDate = (val: unknown): Date => {
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return new Date();
  };

  const toDateOrUndefined = (val: unknown): Date | undefined => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return undefined;
  };

  return {
    id: row.id as string,
    qlidTick: BigInt(row.qlid_tick as string),
    qlid: row.qlid as string,
    palletId: row.pallet_id as string,
    barcodeValue: row.barcode_value as string,
    intakeEmployeeId: row.intake_employee_id as string,
    warehouseId: row.warehouse_id as string,
    intakeTs: toDate(row.intake_ts),
    manufacturer: row.manufacturer as string,
    model: row.model as string,
    category: row.category as ProductCategory,
    serialNumber: row.serial_number as string | undefined,
    currentStage: row.current_stage as RefurbStage,
    priority: row.priority as JobPriority,
    assignedTechnicianId: row.assigned_technician_id as string | undefined,
    finalGrade: row.final_grade as FinalGrade | undefined,
    estimatedValue: row.estimated_value ? parseFloat(row.estimated_value as string) : undefined,
    nextWorkflow: row.next_workflow as string | undefined,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    completedAt: toDateOrUndefined(row.completed_at),
    notes: row.notes as string | undefined
  };
}

// Re-export for convenience
export { getRetailerFromPalletId, RETAILER_CODE_DISPLAY };
