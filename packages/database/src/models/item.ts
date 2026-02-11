/**
 * Item Model - Core inventory item management
 */

import { query, transaction } from '../connection.js';
import { generateQLID } from '../utils/qlid.js';
import { paginate, buildWhereClause, type PaginationOptions, type PaginatedResult, type WhereCondition } from '../utils/query.js';

// Item status progression
export type ItemStatus =
  | 'intake'
  | 'received'
  | 'grading'
  | 'graded'
  | 'refurbishing'
  | 'refurbished'
  | 'listing'
  | 'listed'
  | 'sold'
  | 'shipped'
  | 'returned'
  | 'salvage';

export type ItemCondition =
  | 'new'
  | 'open-box'
  | 'like-new'
  | 'refurbished'
  | 'good'
  | 'fair'
  | 'salvage'
  | 'parts-only';

export type ItemGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'S';

export interface Item {
  id: string;
  qlid: string;
  upc?: string;
  sku?: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  condition?: ItemCondition;
  grade?: ItemGrade;
  cost?: number;
  msrp?: number;
  listedPrice?: number;
  soldPrice?: number;
  status: ItemStatus;
  location?: string;
  warehouse?: string;
  palletId?: string;
  manifestId?: string;
  supplierId?: string;
  images: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateItemInput {
  qlid?: string; // Auto-generated if not provided
  upc?: string;
  sku?: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  condition?: ItemCondition;
  grade?: ItemGrade;
  cost?: number;
  msrp?: number;
  status?: ItemStatus;
  location?: string;
  warehouse?: string;
  palletId?: string;
  manifestId?: string;
  supplierId?: string;
  images?: string[];
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface UpdateItemInput {
  upc?: string;
  sku?: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  model?: string;
  condition?: ItemCondition;
  grade?: ItemGrade;
  cost?: number;
  msrp?: number;
  listedPrice?: number;
  soldPrice?: number;
  status?: ItemStatus;
  location?: string;
  warehouse?: string;
  palletId?: string;
  manifestId?: string;
  supplierId?: string;
  images?: string[];
  metadata?: Record<string, any>;
  updatedBy?: string;
}

// Map database row to Item interface
function rowToItem(row: any): Item {
  return {
    id: row.id,
    qlid: row.qlid,
    upc: row.upc,
    sku: row.sku,
    title: row.title,
    description: row.description,
    category: row.category,
    brand: row.brand,
    model: row.model,
    condition: row.condition,
    grade: row.grade,
    cost: row.cost ? parseFloat(row.cost) : undefined,
    msrp: row.msrp ? parseFloat(row.msrp) : undefined,
    listedPrice: row.listed_price ? parseFloat(row.listed_price) : undefined,
    soldPrice: row.sold_price ? parseFloat(row.sold_price) : undefined,
    status: row.status,
    location: row.location,
    warehouse: row.warehouse,
    palletId: row.pallet_id,
    manifestId: row.manifest_id,
    supplierId: row.supplier_id,
    images: row.images || [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

export class ItemModel {
  /**
   * Create a new item
   */
  async create(input: CreateItemInput): Promise<Item> {
    const qlid = input.qlid || await generateQLID();

    const result = await query(
      `INSERT INTO public.items (
        qlid, upc, sku, title, description, category, brand, model,
        condition, grade, cost, msrp, status, location, warehouse,
        pallet_id, manifest_id, supplier_id, images, metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        qlid,
        input.upc,
        input.sku,
        input.title,
        input.description,
        input.category,
        input.brand,
        input.model,
        input.condition,
        input.grade,
        input.cost,
        input.msrp,
        input.status || 'intake',
        input.location,
        input.warehouse,
        input.palletId,
        input.manifestId,
        input.supplierId,
        JSON.stringify(input.images || []),
        JSON.stringify(input.metadata || {}),
        input.createdBy,
      ]
    );

    return rowToItem(result.rows[0]);
  }

  /**
   * Create multiple items in a transaction
   */
  async createBatch(inputs: CreateItemInput[]): Promise<Item[]> {
    return transaction(async (client) => {
      const items: Item[] = [];

      for (const input of inputs) {
        const qlid = input.qlid || await generateQLID();

        const result = await client.query(
          `INSERT INTO public.items (
            qlid, upc, sku, title, description, category, brand, model,
            condition, grade, cost, msrp, status, location, warehouse,
            pallet_id, manifest_id, supplier_id, images, metadata, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          RETURNING *`,
          [
            qlid,
            input.upc,
            input.sku,
            input.title,
            input.description,
            input.category,
            input.brand,
            input.model,
            input.condition,
            input.grade,
            input.cost,
            input.msrp,
            input.status || 'intake',
            input.location,
            input.warehouse,
            input.palletId,
            input.manifestId,
            input.supplierId,
            JSON.stringify(input.images || []),
            JSON.stringify(input.metadata || {}),
            input.createdBy,
          ]
        );

        items.push(rowToItem(result.rows[0]));
      }

      return items;
    });
  }

  /**
   * Get item by ID
   */
  async getById(id: string): Promise<Item | null> {
    const result = await query(
      'SELECT * FROM public.items WHERE id = $1',
      [id]
    );
    return result.rows[0] ? rowToItem(result.rows[0]) : null;
  }

  /**
   * Get item by QLID
   */
  async getByQLID(qlid: string): Promise<Item | null> {
    const result = await query(
      'SELECT * FROM public.items WHERE qlid = $1',
      [qlid]
    );
    return result.rows[0] ? rowToItem(result.rows[0]) : null;
  }

  /**
   * Get item by UPC
   */
  async getByUPC(upc: string): Promise<Item[]> {
    const result = await query(
      'SELECT * FROM public.items WHERE upc = $1 ORDER BY created_at DESC',
      [upc]
    );
    return result.rows.map(rowToItem);
  }

  /**
   * Find items with filters and pagination
   */
  async find(
    conditions: WhereCondition[] = [],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Item>> {
    const { where, params } = buildWhereClause(conditions);
    const baseQuery = `SELECT * FROM public.items ${where}`;

    return paginate<Item>(
      baseQuery,
      params,
      options,
      (row) => rowToItem(row)
    );
  }

  /**
   * Update item
   */
  async update(id: string, input: UpdateItemInput): Promise<Item | null> {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: { key: keyof UpdateItemInput; column: string }[] = [
      { key: 'upc', column: 'upc' },
      { key: 'sku', column: 'sku' },
      { key: 'title', column: 'title' },
      { key: 'description', column: 'description' },
      { key: 'category', column: 'category' },
      { key: 'brand', column: 'brand' },
      { key: 'model', column: 'model' },
      { key: 'condition', column: 'condition' },
      { key: 'grade', column: 'grade' },
      { key: 'cost', column: 'cost' },
      { key: 'msrp', column: 'msrp' },
      { key: 'listedPrice', column: 'listed_price' },
      { key: 'soldPrice', column: 'sold_price' },
      { key: 'status', column: 'status' },
      { key: 'location', column: 'location' },
      { key: 'warehouse', column: 'warehouse' },
      { key: 'palletId', column: 'pallet_id' },
      { key: 'manifestId', column: 'manifest_id' },
      { key: 'supplierId', column: 'supplier_id' },
      { key: 'updatedBy', column: 'updated_by' },
    ];

    for (const { key, column } of fields) {
      if (input[key] !== undefined) {
        sets.push(`${column} = $${paramIndex}`);
        values.push(input[key]);
        paramIndex++;
      }
    }

    if (input.images !== undefined) {
      sets.push(`images = $${paramIndex}`);
      values.push(JSON.stringify(input.images));
      paramIndex++;
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
      `UPDATE public.items SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ? rowToItem(result.rows[0]) : null;
  }

  /**
   * Update item status
   */
  async updateStatus(qlid: string, status: ItemStatus, updatedBy?: string): Promise<Item | null> {
    const result = await query(
      `UPDATE public.items
       SET status = $1, updated_at = NOW(), updated_by = $2
       WHERE qlid = $3
       RETURNING *`,
      [status, updatedBy, qlid]
    );
    return result.rows[0] ? rowToItem(result.rows[0]) : null;
  }

  /**
   * Assign item to pallet
   */
  async assignToPallet(qlid: string, palletId: string, updatedBy?: string): Promise<Item | null> {
    const result = await query(
      `UPDATE public.items
       SET pallet_id = $1, updated_at = NOW(), updated_by = $2
       WHERE qlid = $3
       RETURNING *`,
      [palletId, updatedBy, qlid]
    );
    return result.rows[0] ? rowToItem(result.rows[0]) : null;
  }

  /**
   * Delete item
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM public.items WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count items by status
   */
  async countByStatus(): Promise<Record<ItemStatus, number>> {
    const result = await query(
      `SELECT status, COUNT(*) as count
       FROM public.items
       GROUP BY status`
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts as Record<ItemStatus, number>;
  }

  /**
   * Get items by manifest
   */
  async getByManifest(manifestId: string): Promise<Item[]> {
    const result = await query(
      'SELECT * FROM public.items WHERE manifest_id = $1 ORDER BY created_at ASC',
      [manifestId]
    );
    return result.rows.map(rowToItem);
  }

  /**
   * Get items by pallet
   */
  async getByPallet(palletId: string): Promise<Item[]> {
    const result = await query(
      'SELECT * FROM public.items WHERE pallet_id = $1 ORDER BY created_at ASC',
      [palletId]
    );
    return result.rows.map(rowToItem);
  }

  /**
   * Search items by title or description
   */
  async search(searchTerm: string, limit = 50): Promise<Item[]> {
    const result = await query(
      `SELECT * FROM public.items
       WHERE title ILIKE $1 OR description ILIKE $1 OR brand ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows.map(rowToItem);
  }
}
