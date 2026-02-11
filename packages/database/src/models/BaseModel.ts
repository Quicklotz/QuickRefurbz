/**
 * BaseModel - Generic CRUD operations for database models
 * Provides reusable methods for all entity models
 */

import { query, transaction, getClient } from '../connection.js';
import type { PoolClient, QueryResult } from 'pg';
import type { PaginationOptions, PaginatedResult, WhereCondition } from '../types.js';

export interface ColumnMapping {
  key: string;
  column: string;
  isJson?: boolean;
}

export interface ModelConfig<T> {
  tableName: string;
  primaryKey: string;
  columns: ColumnMapping[];
  rowMapper: (row: any) => T;
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
      if (!Array.isArray(condition.value) || condition.value.length === 0) {
        continue;
      }
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

  if (clauses.length === 0) {
    return { where: '', params: [] };
  }

  return {
    where: `WHERE ${clauses.join(' AND ')}`,
    params,
  };
}

/**
 * Execute paginated query
 */
export async function paginate<T>(
  baseQuery: string,
  params: any[],
  options: PaginationOptions,
  rowMapper: (row: any) => T
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(1000, Math.max(1, options.limit || 50));
  const offset = (page - 1) * limit;
  const orderBy = options.orderBy || 'created_at';
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
 * Base Model class with generic CRUD operations
 */
export abstract class BaseModel<T, CreateInput, UpdateInput> {
  protected abstract config: ModelConfig<T>;

  /**
   * Get the table name
   */
  get tableName(): string {
    return this.config.tableName;
  }

  /**
   * Get by primary key (UUID id)
   */
  async getById(id: string): Promise<T | null> {
    const result = await query(
      `SELECT * FROM ${this.config.tableName} WHERE ${this.config.primaryKey} = $1`,
      [id]
    );
    return result.rows[0] ? this.config.rowMapper(result.rows[0]) : null;
  }

  /**
   * Get all records (with optional limit)
   */
  async getAll(limit = 1000): Promise<T[]> {
    const result = await query(
      `SELECT * FROM ${this.config.tableName} ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(this.config.rowMapper);
  }

  /**
   * Find records with conditions and pagination
   */
  async find(
    conditions: WhereCondition[] = [],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const { where, params } = buildWhereClause(conditions);
    const baseQuery = `SELECT * FROM ${this.config.tableName} ${where}`;

    return paginate<T>(baseQuery, params, options, this.config.rowMapper);
  }

  /**
   * Find one record matching conditions
   */
  async findOne(conditions: WhereCondition[]): Promise<T | null> {
    const { where, params } = buildWhereClause(conditions);
    const result = await query(
      `SELECT * FROM ${this.config.tableName} ${where} LIMIT 1`,
      params
    );
    return result.rows[0] ? this.config.rowMapper(result.rows[0]) : null;
  }

  /**
   * Count records matching conditions
   */
  async count(conditions: WhereCondition[] = []): Promise<number> {
    const { where, params } = buildWhereClause(conditions);
    const result = await query(
      `SELECT COUNT(*) as count FROM ${this.config.tableName} ${where}`,
      params
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if record exists
   */
  async exists(conditions: WhereCondition[]): Promise<boolean> {
    const count = await this.count(conditions);
    return count > 0;
  }

  /**
   * Build INSERT statement from input and columns
   */
  protected buildInsert(input: Record<string, any>): {
    columns: string[];
    placeholders: string[];
    values: any[];
  } {
    const columns: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const mapping of this.config.columns) {
      if (input[mapping.key] !== undefined) {
        columns.push(mapping.column);
        placeholders.push(`$${paramIndex}`);
        values.push(
          mapping.isJson ? JSON.stringify(input[mapping.key]) : input[mapping.key]
        );
        paramIndex++;
      }
    }

    return { columns, placeholders, values };
  }

  /**
   * Build UPDATE statement from input and columns
   */
  protected buildUpdate(input: Record<string, any>): {
    sets: string[];
    values: any[];
    paramIndex: number;
  } {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const mapping of this.config.columns) {
      if (input[mapping.key] !== undefined) {
        sets.push(`${mapping.column} = $${paramIndex}`);
        values.push(
          mapping.isJson ? JSON.stringify(input[mapping.key]) : input[mapping.key]
        );
        paramIndex++;
      }
    }

    return { sets, values, paramIndex };
  }

  /**
   * Update a record by ID
   */
  async update(id: string, input: UpdateInput): Promise<T | null> {
    const { sets, values, paramIndex } = this.buildUpdate(input as Record<string, any>);

    if (sets.length === 0) {
      return this.getById(id);
    }

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE ${this.config.tableName} SET ${sets.join(', ')} WHERE ${this.config.primaryKey} = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ? this.config.rowMapper(result.rows[0]) : null;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM ${this.config.tableName} WHERE ${this.config.primaryKey} = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete records matching conditions
   */
  async deleteWhere(conditions: WhereCondition[]): Promise<number> {
    const { where, params } = buildWhereClause(conditions);
    const result = await query(
      `DELETE FROM ${this.config.tableName} ${where}`,
      params
    );
    return result.rowCount ?? 0;
  }

  /**
   * Execute operation within a transaction
   */
  async withTransaction<R>(
    fn: (client: PoolClient, model: this) => Promise<R>
  ): Promise<R> {
    return transaction(async (client) => {
      return fn(client, this);
    });
  }

  /**
   * Execute raw query and map results
   */
  async rawQuery(text: string, params?: any[]): Promise<T[]> {
    const result = await query(text, params);
    return result.rows.map(this.config.rowMapper);
  }

  /**
   * Execute raw query without mapping
   */
  async rawQueryRaw<R extends Record<string, any> = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
    return query<R>(text, params);
  }

  /**
   * Batch insert multiple records
   */
  async createBatch(inputs: CreateInput[], client?: PoolClient): Promise<T[]> {
    if (inputs.length === 0) return [];

    const executeQuery = client
      ? (text: string, params: any[]) => client.query(text, params)
      : (text: string, params: any[]) => query(text, params);

    const results: T[] = [];

    for (const input of inputs) {
      const { columns, placeholders, values } = this.buildInsert(input as Record<string, any>);

      if (columns.length === 0) continue;

      const result = await executeQuery(
        `INSERT INTO ${this.config.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );

      if (result.rows[0]) {
        results.push(this.config.rowMapper(result.rows[0]));
      }
    }

    return results;
  }

  /**
   * Upsert (insert or update on conflict)
   */
  async upsert(
    input: CreateInput,
    conflictColumns: string[],
    updateColumns: string[]
  ): Promise<T | null> {
    const { columns, placeholders, values } = this.buildInsert(input as Record<string, any>);

    if (columns.length === 0) return null;

    const conflictClause = conflictColumns.join(', ');
    const updateClause = updateColumns
      .map((col) => `${col} = EXCLUDED.${col}`)
      .join(', ');

    const result = await query(
      `INSERT INTO ${this.config.tableName} (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (${conflictClause})
       DO UPDATE SET ${updateClause}, updated_at = NOW()
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.config.rowMapper(result.rows[0]) : null;
  }
}

/**
 * Search query builder
 */
export function buildSearchQuery(
  searchTerm: string,
  fields: string[]
): { clause: string; param: string } {
  const conditions = fields.map((field) => `${field} ILIKE $1`);
  return {
    clause: `(${conditions.join(' OR ')})`,
    param: `%${searchTerm}%`,
  };
}

/**
 * Safe column name for ORDER BY (prevents SQL injection)
 */
export function safeOrderColumn(column: string, allowedColumns: string[]): string {
  if (allowedColumns.includes(column)) {
    return column;
  }
  return allowedColumns[0] || 'created_at';
}
