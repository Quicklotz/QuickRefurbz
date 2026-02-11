/**
 * QuickRefurbz - Pallet Manager
 * Pallet CRUD operations with QR pallet ID system
 */

import type {
  Pallet,
  PalletStatus,
  Retailer,
  LiquidationSource
} from './types.js';
import { getPool, generateUUID } from './database.js';
import { generateRfbPalletId } from './rfbIdGenerator.js';

const isPostgres = () => (process.env.DB_TYPE || 'sqlite') === 'postgres';

// ==================== CREATE ====================

export interface CreatePalletOptions {
  retailer: Retailer;
  liquidationSource: LiquidationSource;
  sourcePalletId?: string;
  sourceOrderId?: string;
  sourceManifestUrl?: string;
  purchaseDate?: Date;
  totalCogs?: number;
  expectedItems?: number;
  warehouseId?: string;
  notes?: string;
}

export async function createPallet(options: CreatePalletOptions): Promise<Pallet> {
  const db = getPool();
  const palletId = await generateRfbPalletId();
  const id = generateUUID();

  const result = await db.query(`
    INSERT INTO pallets (
      id, pallet_id, retailer, liquidation_source,
      source_pallet_id, source_order_id, source_manifest_url,
      purchase_date, total_cogs, expected_items,
      warehouse_id, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    id,
    palletId,
    options.retailer,
    options.liquidationSource,
    options.sourcePalletId || null,
    options.sourceOrderId || null,
    options.sourceManifestUrl || null,
    options.purchaseDate ? (options.purchaseDate instanceof Date ? options.purchaseDate.toISOString().split('T')[0] : options.purchaseDate) : null,
    options.totalCogs || 0,
    options.expectedItems || 0,
    options.warehouseId || null,
    options.notes || null
  ]);

  return rowToPallet(result.rows[0]);
}

// ==================== READ ====================

export async function getPalletById(palletId: string): Promise<Pallet | null> {
  const db = getPool();
  const result = await db.query(`
    SELECT * FROM pallets
    WHERE id = $1 OR pallet_id = $1 OR source_pallet_id = $1
  `, [palletId]);

  if (result.rows.length === 0) return null;
  return rowToPallet(result.rows[0]);
}

export interface ListPalletsOptions {
  status?: PalletStatus;
  retailer?: Retailer;
  source?: LiquidationSource;
  warehouseId?: string;
  limit?: number;
}

export async function listPallets(options: ListPalletsOptions = {}): Promise<Pallet[]> {
  const db = getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }

  if (options.retailer) {
    conditions.push(`retailer = $${paramIndex++}`);
    params.push(options.retailer);
  }

  if (options.source) {
    conditions.push(`liquidation_source = $${paramIndex++}`);
    params.push(options.source);
  }

  if (options.warehouseId) {
    conditions.push(`warehouse_id = $${paramIndex++}`);
    params.push(options.warehouseId);
  }

  let query = 'SELECT * FROM pallets';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  const result = await db.query(query, params);
  return result.rows.map(rowToPallet);
}

export async function getActivePallets(): Promise<Pallet[]> {
  return listPallets({ status: 'IN_PROGRESS' });
}

export async function getReceivingPallets(): Promise<Pallet[]> {
  return listPallets({ status: 'RECEIVING' });
}

// ==================== UPDATE ====================

export async function updatePallet(
  palletId: string,
  updates: Partial<Pallet>
): Promise<Pallet | null> {
  const pallet = await getPalletById(palletId);
  if (!pallet) return null;

  const db = getPool();
  const setClause: string[] = [isPostgres() ? 'updated_at = now()' : "updated_at = datetime('now')"];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (updates.sourcePalletId !== undefined) {
    setClause.push(`source_pallet_id = $${paramIndex++}`);
    params.push(updates.sourcePalletId);
  }

  if (updates.sourceOrderId !== undefined) {
    setClause.push(`source_order_id = $${paramIndex++}`);
    params.push(updates.sourceOrderId);
  }

  if (updates.sourceManifestUrl !== undefined) {
    setClause.push(`source_manifest_url = $${paramIndex++}`);
    params.push(updates.sourceManifestUrl);
  }

  if (updates.totalCogs !== undefined) {
    setClause.push(`total_cogs = $${paramIndex++}`);
    params.push(updates.totalCogs);
  }

  if (updates.expectedItems !== undefined) {
    setClause.push(`expected_items = $${paramIndex++}`);
    params.push(updates.expectedItems);
  }

  if (updates.receivedItems !== undefined) {
    setClause.push(`received_items = $${paramIndex++}`);
    params.push(updates.receivedItems);
  }

  if (updates.completedItems !== undefined) {
    setClause.push(`completed_items = $${paramIndex++}`);
    params.push(updates.completedItems);
  }

  if (updates.status !== undefined) {
    setClause.push(`status = $${paramIndex++}`);
    params.push(updates.status);
  }

  if (updates.warehouseId !== undefined) {
    setClause.push(`warehouse_id = $${paramIndex++}`);
    params.push(updates.warehouseId);
  }

  if (updates.notes !== undefined) {
    setClause.push(`notes = $${paramIndex++}`);
    params.push(updates.notes);
  }

  if (updates.completedAt !== undefined) {
    setClause.push(`completed_at = $${paramIndex++}`);
    params.push(updates.completedAt instanceof Date ? updates.completedAt.toISOString() : updates.completedAt);
  }

  params.push(pallet.id);
  const result = await db.query(
    `UPDATE pallets SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return rowToPallet(result.rows[0]);
}

export async function incrementReceivedItems(palletId: string): Promise<Pallet | null> {
  const pallet = await getPalletById(palletId);
  if (!pallet) return null;

  const newStatus: PalletStatus = pallet.status === 'RECEIVING' ? 'IN_PROGRESS' : pallet.status;

  return updatePallet(palletId, {
    receivedItems: pallet.receivedItems + 1,
    status: newStatus
  });
}

export async function incrementCompletedItems(palletId: string): Promise<Pallet | null> {
  const pallet = await getPalletById(palletId);
  if (!pallet) return null;

  const newCompletedItems = pallet.completedItems + 1;
  const isComplete = newCompletedItems >= pallet.receivedItems && pallet.receivedItems > 0;

  return updatePallet(palletId, {
    completedItems: newCompletedItems,
    status: isComplete ? 'COMPLETE' : pallet.status,
    completedAt: isComplete ? new Date() : pallet.completedAt
  });
}

export async function startPallet(palletId: string): Promise<Pallet | null> {
  const pallet = await getPalletById(palletId);
  if (!pallet) {
    throw new Error(`Pallet not found: ${palletId}`);
  }

  if (pallet.status !== 'RECEIVING') {
    throw new Error(`Pallet ${pallet.palletId} is not in RECEIVING status`);
  }

  return updatePallet(palletId, { status: 'IN_PROGRESS' });
}

export async function completePallet(palletId: string): Promise<Pallet | null> {
  const pallet = await getPalletById(palletId);
  if (!pallet) {
    throw new Error(`Pallet not found: ${palletId}`);
  }

  return updatePallet(palletId, {
    status: 'COMPLETE',
    completedAt: new Date()
  });
}

// ==================== DELETE ====================

export async function deletePallet(palletId: string): Promise<boolean> {
  const pallet = await getPalletById(palletId);
  if (!pallet) return false;

  const db = getPool();

  // Check if pallet has items
  const itemsResult = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM refurb_items WHERE qr_pallet_id = $1',
    [pallet.palletId]
  );
  const itemCount = parseInt(itemsResult.rows[0].count);
  if (itemCount > 0) {
    throw new Error(`Cannot delete pallet with ${itemCount} items. Remove items first.`);
  }

  const result = await db.query('DELETE FROM pallets WHERE id = $1', [pallet.id]);
  return (result.rowCount ?? 0) > 0;
}

// ==================== ITEMS ====================

export async function getPalletItems(palletId: string): Promise<{ qlid: string; manufacturer: string; model: string; stage: string }[]> {
  const pallet = await getPalletById(palletId);
  if (!pallet) return [];

  const db = getPool();
  const result = await db.query<{ qlid: string; manufacturer: string; model: string; current_stage: string }>(`
    SELECT qlid, manufacturer, model, current_stage
    FROM refurb_items
    WHERE qr_pallet_id = $1
    ORDER BY created_at ASC
  `, [pallet.palletId]);

  return result.rows.map(row => ({
    qlid: row.qlid,
    manufacturer: row.manufacturer,
    model: row.model,
    stage: row.current_stage
  }));
}

// ==================== STATS ====================

export interface PalletStats {
  total: number;
  byStatus: Record<PalletStatus, number>;
  byRetailer: Record<string, number>;
  bySource: Record<string, number>;
  totalCogs: number;
  avgItemsPerPallet: number;
}

export async function getPalletStats(): Promise<PalletStats> {
  const db = getPool();

  const stats: PalletStats = {
    total: 0,
    byStatus: {
      RECEIVING: 0,
      IN_PROGRESS: 0,
      COMPLETE: 0
    },
    byRetailer: {},
    bySource: {},
    totalCogs: 0,
    avgItemsPerPallet: 0
  };

  // Total count
  const totalResult = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM pallets');
  stats.total = parseInt(totalResult.rows[0].count);

  // By status
  const statusResult = await db.query<{ status: string; count: string }>(`
    SELECT status, COUNT(*) as count
    FROM pallets
    GROUP BY status
  `);
  for (const row of statusResult.rows) {
    stats.byStatus[row.status as PalletStatus] = parseInt(row.count);
  }

  // By retailer
  const retailerResult = await db.query<{ retailer: string; count: string }>(`
    SELECT retailer, COUNT(*) as count
    FROM pallets
    GROUP BY retailer
  `);
  for (const row of retailerResult.rows) {
    stats.byRetailer[row.retailer] = parseInt(row.count);
  }

  // By source
  const sourceResult = await db.query<{ liquidation_source: string; count: string }>(`
    SELECT liquidation_source, COUNT(*) as count
    FROM pallets
    GROUP BY liquidation_source
  `);
  for (const row of sourceResult.rows) {
    stats.bySource[row.liquidation_source] = parseInt(row.count);
  }

  // Total COGS
  const cogsResult = await db.query<{ total: string }>(`
    SELECT COALESCE(SUM(total_cogs), 0) as total FROM pallets
  `);
  stats.totalCogs = parseFloat(cogsResult.rows[0].total);

  // Avg items per pallet
  const avgResult = await db.query<{ avg: string }>(`
    SELECT COALESCE(AVG(received_items), 0) as avg FROM pallets WHERE received_items > 0
  `);
  stats.avgItemsPerPallet = parseFloat(avgResult.rows[0].avg);

  return stats;
}

// ==================== HELPERS ====================

function rowToPallet(row: Record<string, unknown>): Pallet {
  return {
    id: row.id as string,
    palletId: row.pallet_id as string,
    retailer: row.retailer as Retailer,
    liquidationSource: row.liquidation_source as LiquidationSource,
    sourcePalletId: row.source_pallet_id as string | undefined,
    sourceOrderId: row.source_order_id as string | undefined,
    sourceManifestUrl: row.source_manifest_url as string | undefined,
    purchaseDate: row.purchase_date ? new Date(row.purchase_date as string) : undefined,
    totalCogs: parseFloat(row.total_cogs as string) || 0,
    expectedItems: parseInt(row.expected_items as string) || 0,
    receivedItems: parseInt(row.received_items as string) || 0,
    completedItems: parseInt(row.completed_items as string) || 0,
    status: row.status as PalletStatus,
    warehouseId: row.warehouse_id as string | undefined,
    notes: row.notes as string | undefined,
    receivedAt: new Date(row.received_at as string),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined
  };
}
