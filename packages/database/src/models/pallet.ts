/**
 * Pallet Model - Pallet management
 */

import { query, transaction } from '../connection.js';
import { paginate, buildWhereClause, type PaginationOptions, type PaginatedResult, type WhereCondition } from '../utils/query.js';

export type PalletStatus = 'open' | 'building' | 'full' | 'staged' | 'shipped' | 'received';

export interface Pallet {
  id: string;
  palletId: string;
  type?: string;
  status: PalletStatus;
  location?: string;
  warehouse?: string;
  itemCount: number;
  totalCost?: number;
  totalMsrp?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePalletInput {
  palletId: string;
  type?: string;
  status?: PalletStatus;
  location?: string;
  warehouse?: string;
}

export interface UpdatePalletInput {
  type?: string;
  status?: PalletStatus;
  location?: string;
  warehouse?: string;
  itemCount?: number;
  totalCost?: number;
  totalMsrp?: number;
}

function rowToPallet(row: any): Pallet {
  return {
    id: row.id,
    palletId: row.pallet_id,
    type: row.type,
    status: row.status,
    location: row.location,
    warehouse: row.warehouse,
    itemCount: parseInt(row.item_count || '0', 10),
    totalCost: row.total_cost ? parseFloat(row.total_cost) : undefined,
    totalMsrp: row.total_msrp ? parseFloat(row.total_msrp) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PalletModel {
  /**
   * Create a new pallet
   */
  async create(input: CreatePalletInput): Promise<Pallet> {
    const result = await query(
      `INSERT INTO public.pallets (
        pallet_id, type, status, location, warehouse
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        input.palletId,
        input.type,
        input.status || 'open',
        input.location,
        input.warehouse,
      ]
    );

    return rowToPallet(result.rows[0]);
  }

  /**
   * Get pallet by ID
   */
  async getById(id: string): Promise<Pallet | null> {
    const result = await query(
      'SELECT * FROM public.pallets WHERE id = $1',
      [id]
    );
    return result.rows[0] ? rowToPallet(result.rows[0]) : null;
  }

  /**
   * Get pallet by pallet ID
   */
  async getByPalletId(palletId: string): Promise<Pallet | null> {
    const result = await query(
      'SELECT * FROM public.pallets WHERE pallet_id = $1',
      [palletId]
    );
    return result.rows[0] ? rowToPallet(result.rows[0]) : null;
  }

  /**
   * Find pallets with filters
   */
  async find(
    conditions: WhereCondition[] = [],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Pallet>> {
    const { where, params } = buildWhereClause(conditions);
    const baseQuery = `SELECT * FROM public.pallets ${where}`;

    return paginate<Pallet>(
      baseQuery,
      params,
      options,
      (row) => rowToPallet(row)
    );
  }

  /**
   * Update pallet
   */
  async update(id: string, input: UpdatePalletInput): Promise<Pallet | null> {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: { key: keyof UpdatePalletInput; column: string }[] = [
      { key: 'type', column: 'type' },
      { key: 'status', column: 'status' },
      { key: 'location', column: 'location' },
      { key: 'warehouse', column: 'warehouse' },
      { key: 'itemCount', column: 'item_count' },
      { key: 'totalCost', column: 'total_cost' },
      { key: 'totalMsrp', column: 'total_msrp' },
    ];

    for (const { key, column } of fields) {
      if (input[key] !== undefined) {
        sets.push(`${column} = $${paramIndex}`);
        values.push(input[key]);
        paramIndex++;
      }
    }

    if (sets.length === 0) {
      return this.getById(id);
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE public.pallets SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ? rowToPallet(result.rows[0]) : null;
  }

  /**
   * Update pallet status
   */
  async updateStatus(palletId: string, status: PalletStatus): Promise<Pallet | null> {
    const result = await query(
      `UPDATE public.pallets
       SET status = $1, updated_at = NOW()
       WHERE pallet_id = $2
       RETURNING *`,
      [status, palletId]
    );
    return result.rows[0] ? rowToPallet(result.rows[0]) : null;
  }

  /**
   * Add item to pallet (increments count)
   */
  async addItem(palletId: string, cost?: number, msrp?: number): Promise<void> {
    await query(
      `UPDATE public.pallets
       SET item_count = item_count + 1,
           total_cost = COALESCE(total_cost, 0) + COALESCE($1, 0),
           total_msrp = COALESCE(total_msrp, 0) + COALESCE($2, 0),
           updated_at = NOW()
       WHERE pallet_id = $3`,
      [cost, msrp, palletId]
    );
  }

  /**
   * Remove item from pallet (decrements count)
   */
  async removeItem(palletId: string, cost?: number, msrp?: number): Promise<void> {
    await query(
      `UPDATE public.pallets
       SET item_count = GREATEST(item_count - 1, 0),
           total_cost = GREATEST(COALESCE(total_cost, 0) - COALESCE($1, 0), 0),
           total_msrp = GREATEST(COALESCE(total_msrp, 0) - COALESCE($2, 0), 0),
           updated_at = NOW()
       WHERE pallet_id = $3`,
      [cost, msrp, palletId]
    );
  }

  /**
   * Delete pallet
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM public.pallets WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get pallets by status
   */
  async getByStatus(status: PalletStatus): Promise<Pallet[]> {
    const result = await query(
      'SELECT * FROM public.pallets WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    return result.rows.map(rowToPallet);
  }

  /**
   * Get pallets by warehouse
   */
  async getByWarehouse(warehouse: string): Promise<Pallet[]> {
    const result = await query(
      'SELECT * FROM public.pallets WHERE warehouse = $1 ORDER BY created_at DESC',
      [warehouse]
    );
    return result.rows.map(rowToPallet);
  }

  /**
   * Get open pallets (available for adding items)
   */
  async getOpenPallets(warehouse?: string): Promise<Pallet[]> {
    let sql = "SELECT * FROM public.pallets WHERE status IN ('open', 'building')";
    const params: any[] = [];

    if (warehouse) {
      sql += ' AND warehouse = $1';
      params.push(warehouse);
    }

    sql += ' ORDER BY created_at ASC';

    const result = await query(sql, params);
    return result.rows.map(rowToPallet);
  }

  /**
   * Count pallets by status
   */
  async countByStatus(): Promise<Record<PalletStatus, number>> {
    const result = await query(
      `SELECT status, COUNT(*) as count
       FROM public.pallets
       GROUP BY status`
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts as Record<PalletStatus, number>;
  }

  /**
   * Generate next pallet ID
   */
  async generatePalletId(prefix = 'PAL'): Promise<string> {
    const result = await query(
      `SELECT pallet_id FROM public.pallets
       WHERE pallet_id LIKE $1
       ORDER BY pallet_id DESC
       LIMIT 1`,
      [`${prefix}-%`]
    );

    if (result.rows.length === 0) {
      return `${prefix}-0001`;
    }

    const lastId = result.rows[0].pallet_id;
    const match = lastId.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      return `${prefix}-${num.toString().padStart(4, '0')}`;
    }

    return `${prefix}-0001`;
  }
}
