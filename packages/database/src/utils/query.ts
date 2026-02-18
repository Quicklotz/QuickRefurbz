/**
 * Query Building Utilities
 */

import { query } from '../connection.js';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface WhereCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
}

/**
 * Build WHERE clause from conditions
 */
export function buildWhereClause(conditions: WhereCondition[]): {
  where: string;
  params: any[];
} {
  if (conditions.length === 0) {
    return { where: '', params: [] };
  }

  const clauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const condition of conditions) {
    if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
      clauses.push(`${condition.field} ${condition.operator}`);
    } else if (condition.operator === 'IN') {
      const placeholders = condition.value.map((_: any, i: number) => `$${paramIndex + i}`).join(', ');
      clauses.push(`${condition.field} IN (${placeholders})`);
      params.push(...condition.value);
      paramIndex += condition.value.length;
    } else {
      clauses.push(`${condition.field} ${condition.operator} $${paramIndex}`);
      params.push(condition.value);
      paramIndex++;
    }
  }

  return {
    where: `WHERE ${clauses.join(' AND ')}`,
    params,
  };
}

/**
 * Execute paginated query
 */
const DEFAULT_ALLOWED_ORDER_COLUMNS = [
  'created_at', 'updated_at', 'id', 'name', 'status', 'qlid', 'grade',
  'category', 'brand', 'model', 'serial_number', 'pallet_id', 'manifest_id',
  'price', 'msrp', 'quantity', 'weight', 'order_date', 'received_date',
  'completed_at', 'assigned_at', 'started_at', 'email', 'role',
];

export async function paginate<T>(
  baseQuery: string,
  params: any[],
  options: PaginationOptions,
  rowMapper: (row: any) => T,
  allowedColumns?: string[]
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(1000, Math.max(1, options.limit || 50));
  const offset = (page - 1) * limit;
  const orderBy = safeOrderColumn(options.orderBy || 'created_at', allowedColumns || DEFAULT_ALLOWED_ORDER_COLUMNS);
  const orderDir = options.orderDir || 'DESC';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as counted`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated data
  const dataQuery = `${baseQuery} ORDER BY ${orderBy} ${orderDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const dataResult = await query(dataQuery, [...params, limit, offset]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: dataResult.rows.map(rowMapper),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Execute batch insert
 */
export async function batchInsert<T extends Record<string, any>>(
  table: string,
  items: T[],
  columns: string[]
): Promise<number> {
  if (items.length === 0) return 0;

  const placeholders: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const item of items) {
    const rowPlaceholders: string[] = [];
    for (const column of columns) {
      rowPlaceholders.push(`$${paramIndex}`);
      values.push(item[column]);
      paramIndex++;
    }
    placeholders.push(`(${rowPlaceholders.join(', ')})`);
  }

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
  const result = await query(sql, values);

  return result.rowCount ?? 0;
}

/**
 * Safe column name for ORDER BY
 */
export function safeOrderColumn(column: string, allowedColumns: string[]): string {
  if (allowedColumns.includes(column)) {
    return column;
  }
  return allowedColumns[0] || 'created_at';
}

/**
 * Build search query for multiple fields
 */
export function buildSearchQuery(
  searchTerm: string,
  fields: string[]
): { clause: string; param: string } {
  const conditions = fields.map(field => `${field} ILIKE $1`);
  return {
    clause: `(${conditions.join(' OR ')})`,
    param: `%${searchTerm}%`,
  };
}
