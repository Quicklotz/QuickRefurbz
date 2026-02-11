import { Request } from 'express';
import { PaginationParams, PaginationMeta } from '../types';

/**
 * Default pagination settings
 */
export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
} as const;

/**
 * Parse pagination parameters from request query
 */
export function parsePagination(
  req: Request,
  defaults: Partial<typeof PAGINATION_DEFAULTS> = {}
): PaginationParams {
  const config = { ...PAGINATION_DEFAULTS, ...defaults };

  let page = parseInt(req.query.page as string, 10);
  let limit = parseInt(req.query.limit as string, 10);

  // Validate and apply defaults
  if (isNaN(page) || page < 1) {
    page = config.page;
  }

  if (isNaN(limit) || limit < 1) {
    limit = config.limit;
  }

  // Enforce maximum limit
  if (limit > config.maxLimit) {
    limit = config.maxLimit;
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Create pagination metadata from results
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Apply pagination to an array (for in-memory pagination)
 */
export function paginateArray<T>(
  items: T[],
  params: PaginationParams
): { data: T[]; meta: PaginationMeta } {
  const { page, limit, offset } = params;
  const total = items.length;
  const data = items.slice(offset, offset + limit);
  const meta = createPaginationMeta(page, limit, total);

  return { data, meta };
}

/**
 * Generate SQL LIMIT and OFFSET clause
 */
export function getSqlPagination(params: PaginationParams): {
  limit: number;
  offset: number;
  sql: string;
} {
  return {
    limit: params.limit,
    offset: params.offset,
    sql: `LIMIT ${params.limit} OFFSET ${params.offset}`,
  };
}

/**
 * Generate cursor-based pagination info
 */
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction: 'next' | 'prev';
}

export interface CursorPaginationMeta {
  nextCursor?: string;
  prevCursor?: string;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

/**
 * Parse cursor-based pagination from request
 */
export function parseCursorPagination(
  req: Request,
  defaultLimit: number = 20,
  maxLimit: number = 100
): CursorPaginationParams {
  let limit = parseInt(req.query.limit as string, 10);

  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }

  if (limit > maxLimit) {
    limit = maxLimit;
  }

  return {
    cursor: req.query.cursor as string | undefined,
    limit,
    direction: (req.query.direction as 'next' | 'prev') || 'next',
  };
}

/**
 * Create cursor from an item (typically using ID or timestamp)
 */
export function createCursor(value: string | number | Date): string {
  const stringValue = value instanceof Date ? value.toISOString() : String(value);
  return Buffer.from(stringValue).toString('base64');
}

/**
 * Decode cursor to get the original value
 */
export function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Build cursor pagination metadata from results
 */
export function createCursorPaginationMeta<T>(
  items: T[],
  limit: number,
  getCursorValue: (item: T) => string | number | Date,
  hasMore: boolean
): CursorPaginationMeta {
  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  return {
    nextCursor: hasMore && lastItem ? createCursor(getCursorValue(lastItem)) : undefined,
    prevCursor: firstItem ? createCursor(getCursorValue(firstItem)) : undefined,
    hasNext: hasMore,
    hasPrev: !!firstItem,
    limit,
  };
}
