/**
 * Manifest Model - Supplier manifest management
 */

import { query, transaction } from '../connection.js';
import { paginate, buildWhereClause, type PaginationOptions, type PaginatedResult, type WhereCondition } from '../utils/query.js';

export type ManifestStatus =
  | 'pending'
  | 'received'
  | 'processing'
  | 'processed'
  | 'closed';

export interface Manifest {
  id: string;
  manifestId: string;
  supplierId?: string;
  supplierName?: string;
  source?: string;
  totalItems: number;
  totalCost?: number;
  receivedDate?: Date;
  status: ManifestStatus;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateManifestInput {
  manifestId: string;
  supplierId?: string;
  supplierName?: string;
  source?: string;
  totalItems?: number;
  totalCost?: number;
  receivedDate?: Date;
  status?: ManifestStatus;
  metadata?: Record<string, any>;
}

export interface UpdateManifestInput {
  supplierId?: string;
  supplierName?: string;
  source?: string;
  totalItems?: number;
  totalCost?: number;
  receivedDate?: Date;
  status?: ManifestStatus;
  metadata?: Record<string, any>;
}

function rowToManifest(row: any): Manifest {
  return {
    id: row.id,
    manifestId: row.manifest_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    source: row.source,
    totalItems: parseInt(row.total_items || '0', 10),
    totalCost: row.total_cost ? parseFloat(row.total_cost) : undefined,
    receivedDate: row.received_date,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ManifestModel {
  /**
   * Create a new manifest
   */
  async create(input: CreateManifestInput): Promise<Manifest> {
    const result = await query(
      `INSERT INTO public.manifests (
        manifest_id, supplier_id, supplier_name, source,
        total_items, total_cost, received_date, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.manifestId,
        input.supplierId,
        input.supplierName,
        input.source,
        input.totalItems || 0,
        input.totalCost,
        input.receivedDate,
        input.status || 'pending',
        JSON.stringify(input.metadata || {}),
      ]
    );

    return rowToManifest(result.rows[0]);
  }

  /**
   * Get manifest by ID
   */
  async getById(id: string): Promise<Manifest | null> {
    const result = await query(
      'SELECT * FROM public.manifests WHERE id = $1',
      [id]
    );
    return result.rows[0] ? rowToManifest(result.rows[0]) : null;
  }

  /**
   * Get manifest by manifest ID
   */
  async getByManifestId(manifestId: string): Promise<Manifest | null> {
    const result = await query(
      'SELECT * FROM public.manifests WHERE manifest_id = $1',
      [manifestId]
    );
    return result.rows[0] ? rowToManifest(result.rows[0]) : null;
  }

  /**
   * Find manifests with filters
   */
  async find(
    conditions: WhereCondition[] = [],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Manifest>> {
    const { where, params } = buildWhereClause(conditions);
    const baseQuery = `SELECT * FROM public.manifests ${where}`;

    return paginate<Manifest>(
      baseQuery,
      params,
      options,
      (row) => rowToManifest(row)
    );
  }

  /**
   * Update manifest
   */
  async update(id: string, input: UpdateManifestInput): Promise<Manifest | null> {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: { key: keyof UpdateManifestInput; column: string }[] = [
      { key: 'supplierId', column: 'supplier_id' },
      { key: 'supplierName', column: 'supplier_name' },
      { key: 'source', column: 'source' },
      { key: 'totalItems', column: 'total_items' },
      { key: 'totalCost', column: 'total_cost' },
      { key: 'receivedDate', column: 'received_date' },
      { key: 'status', column: 'status' },
    ];

    for (const { key, column } of fields) {
      if (input[key] !== undefined) {
        sets.push(`${column} = $${paramIndex}`);
        values.push(input[key]);
        paramIndex++;
      }
    }

    if (input.metadata !== undefined) {
      sets.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (sets.length === 0) {
      return this.getById(id);
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE public.manifests SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ? rowToManifest(result.rows[0]) : null;
  }

  /**
   * Update manifest status
   */
  async updateStatus(manifestId: string, status: ManifestStatus): Promise<Manifest | null> {
    const result = await query(
      `UPDATE public.manifests
       SET status = $1, updated_at = NOW()
       WHERE manifest_id = $2
       RETURNING *`,
      [status, manifestId]
    );
    return result.rows[0] ? rowToManifest(result.rows[0]) : null;
  }

  /**
   * Increment item count
   */
  async incrementItemCount(manifestId: string, count = 1): Promise<void> {
    await query(
      `UPDATE public.manifests
       SET total_items = total_items + $1, updated_at = NOW()
       WHERE manifest_id = $2`,
      [count, manifestId]
    );
  }

  /**
   * Delete manifest
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM public.manifests WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get manifests by supplier
   */
  async getBySupplier(supplierId: string): Promise<Manifest[]> {
    const result = await query(
      'SELECT * FROM public.manifests WHERE supplier_id = $1 ORDER BY created_at DESC',
      [supplierId]
    );
    return result.rows.map(rowToManifest);
  }

  /**
   * Get recent manifests
   */
  async getRecent(limit = 10): Promise<Manifest[]> {
    const result = await query(
      'SELECT * FROM public.manifests ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(rowToManifest);
  }

  /**
   * Count manifests by status
   */
  async countByStatus(): Promise<Record<ManifestStatus, number>> {
    const result = await query(
      `SELECT status, COUNT(*) as count
       FROM public.manifests
       GROUP BY status`
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts as Record<ManifestStatus, number>;
  }
}
