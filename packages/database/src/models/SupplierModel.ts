/**
 * Supplier Model - Supplier/Vendor management
 */

import { query } from '../connection.js';
import { generateSupplierId } from '../sequences.js';
import { BaseModel, type ModelConfig, type ColumnMapping, buildWhereClause, paginate } from './BaseModel.js';
import type {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierStatus,
  PaginationOptions,
  PaginatedResult,
  WhereCondition
} from '../types.js';

function rowToSupplier(row: any): Supplier {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    name: row.name,
    code: row.code,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    country: row.country,
    status: row.status,
    paymentTerms: row.payment_terms,
    notes: row.notes,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const supplierColumns: ColumnMapping[] = [
  { key: 'supplierId', column: 'supplier_id' },
  { key: 'name', column: 'name' },
  { key: 'code', column: 'code' },
  { key: 'contactName', column: 'contact_name' },
  { key: 'contactEmail', column: 'contact_email' },
  { key: 'contactPhone', column: 'contact_phone' },
  { key: 'address', column: 'address' },
  { key: 'city', column: 'city' },
  { key: 'state', column: 'state' },
  { key: 'zipCode', column: 'zip_code' },
  { key: 'country', column: 'country' },
  { key: 'status', column: 'status' },
  { key: 'paymentTerms', column: 'payment_terms' },
  { key: 'notes', column: 'notes' },
  { key: 'metadata', column: 'metadata', isJson: true },
];

export class SupplierModel extends BaseModel<Supplier, CreateSupplierInput, UpdateSupplierInput> {
  protected config: ModelConfig<Supplier> = {
    tableName: 'public.suppliers',
    primaryKey: 'id',
    columns: supplierColumns,
    rowMapper: rowToSupplier,
  };

  /**
   * Create a new supplier
   */
  async create(input: CreateSupplierInput): Promise<Supplier> {
    const supplierId = input.supplierId || await generateSupplierId(input.code);

    const result = await query(
      `INSERT INTO public.suppliers (
        supplier_id, name, code, contact_name, contact_email, contact_phone,
        address, city, state, zip_code, country, status, payment_terms, notes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        supplierId,
        input.name,
        input.code.toUpperCase(),
        input.contactName,
        input.contactEmail,
        input.contactPhone,
        input.address,
        input.city,
        input.state,
        input.zipCode,
        input.country || 'USA',
        input.status || 'active',
        input.paymentTerms,
        input.notes,
        JSON.stringify(input.metadata || {}),
      ]
    );

    return rowToSupplier(result.rows[0]);
  }

  /**
   * Get supplier by supplier ID
   */
  async getBySupplierId(supplierId: string): Promise<Supplier | null> {
    const result = await query(
      'SELECT * FROM public.suppliers WHERE supplier_id = $1',
      [supplierId]
    );
    return result.rows[0] ? rowToSupplier(result.rows[0]) : null;
  }

  /**
   * Get supplier by code (e.g., "TL", "BBY")
   */
  async getByCode(code: string): Promise<Supplier | null> {
    const result = await query(
      'SELECT * FROM public.suppliers WHERE code = $1',
      [code.toUpperCase()]
    );
    return result.rows[0] ? rowToSupplier(result.rows[0]) : null;
  }

  /**
   * Get all active suppliers
   */
  async getActive(): Promise<Supplier[]> {
    const result = await query(
      "SELECT * FROM public.suppliers WHERE status = 'active' ORDER BY name ASC"
    );
    return result.rows.map(rowToSupplier);
  }

  /**
   * Get suppliers by status
   */
  async getByStatus(status: SupplierStatus): Promise<Supplier[]> {
    const result = await query(
      'SELECT * FROM public.suppliers WHERE status = $1 ORDER BY name ASC',
      [status]
    );
    return result.rows.map(rowToSupplier);
  }

  /**
   * Update supplier status
   */
  async updateStatus(supplierId: string, status: SupplierStatus): Promise<Supplier | null> {
    const result = await query(
      `UPDATE public.suppliers
       SET status = $1, updated_at = NOW()
       WHERE supplier_id = $2
       RETURNING *`,
      [status, supplierId]
    );
    return result.rows[0] ? rowToSupplier(result.rows[0]) : null;
  }

  /**
   * Search suppliers by name or code
   */
  async search(searchTerm: string, limit = 50): Promise<Supplier[]> {
    const result = await query(
      `SELECT * FROM public.suppliers
       WHERE name ILIKE $1 OR code ILIKE $1 OR contact_name ILIKE $1
       ORDER BY name ASC
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows.map(rowToSupplier);
  }

  /**
   * Count suppliers by status
   */
  async countByStatus(): Promise<Record<SupplierStatus, number>> {
    const result = await query(
      `SELECT status, COUNT(*) as count
       FROM public.suppliers
       GROUP BY status`
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts as Record<SupplierStatus, number>;
  }

  /**
   * Get supplier with order statistics
   */
  async getWithStats(supplierId: string): Promise<Supplier & { orderCount: number; totalSpend: number } | null> {
    const result = await query(
      `SELECT s.*,
              COALESCE(COUNT(o.id), 0) as order_count,
              COALESCE(SUM(o.total_cost), 0) as total_spend
       FROM public.suppliers s
       LEFT JOIN public.orders o ON s.supplier_id = o.supplier_id
       WHERE s.supplier_id = $1
       GROUP BY s.id`,
      [supplierId]
    );

    if (!result.rows[0]) return null;

    const supplier = rowToSupplier(result.rows[0]);
    return {
      ...supplier,
      orderCount: parseInt(result.rows[0].order_count, 10),
      totalSpend: parseFloat(result.rows[0].total_spend) || 0,
    };
  }
}

// Export types
export type { Supplier, CreateSupplierInput, UpdateSupplierInput, SupplierStatus };
