/**
 * PostgreSQL Connection Pool Management
 * Supports DATABASE_URL or individual PG_* environment variables
 */

import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

// Load environment variables
dotenv.config();

export type { PoolClient, QueryResult } from 'pg';

/**
 * Parse DATABASE_URL into connection config
 */
function parseDatabaseUrl(url: string): pg.PoolConfig {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.slice(1), // Remove leading /
    user: parsed.username,
    password: parsed.password,
    ssl: parsed.searchParams.get('sslmode') === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
  };
}

/**
 * Get connection configuration from environment
 */
function getConfig(): pg.PoolConfig {
  // Prefer DATABASE_URL if provided
  if (process.env.DATABASE_URL) {
    const urlConfig = parseDatabaseUrl(process.env.DATABASE_URL);
    return {
      ...urlConfig,
      max: parseInt(process.env.PG_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '10000', 10),
      allowExitOnIdle: false,
    };
  }

  // Fall back to individual PG_* variables
  return {
    host: process.env.PGHOST || process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PGPORT || process.env.PG_PORT || '5432', 10),
    database: process.env.PGDATABASE || process.env.PG_DATABASE || 'quickwms',
    user: process.env.PGUSER || process.env.PG_USER || 'quickwms',
    password: process.env.PGPASSWORD || process.env.PG_PASSWORD || '',
    max: parseInt(process.env.PG_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '10000', 10),
    allowExitOnIdle: false,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

// Singleton pool instance
let pool: pg.Pool | null = null;

/**
 * Get or create the connection pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const config = getConfig();
    pool = new Pool(config);

    // Error handling
    pool.on('error', (err) => {
      console.error('[Database] Unexpected pool error:', err);
    });

    if (process.env.DEBUG_SQL === 'true') {
      pool.on('connect', () => {
        console.log('[Database] New client connected to pool');
      });
    }
  }
  return pool;
}

/**
 * Execute a query using the pool
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;

  if (process.env.DEBUG_SQL === 'true') {
    console.log('[SQL]', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount });
  }

  return result;
}

/**
 * Execute a function within a transaction
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries within a single transaction
 */
export async function transactionQueries<T extends pg.QueryResultRow = any>(
  queries: Array<{ text: string; params?: any[] }>
): Promise<pg.QueryResult<T>[]> {
  return transaction(async (client) => {
    const results: pg.QueryResult<T>[] = [];
    for (const q of queries) {
      const result = await client.query<T>(q.text, q.params);
      results.push(result);
    }
    return results;
  });
}

/**
 * Get a client from the pool for manual transaction management
 */
export async function getClient(): Promise<pg.PoolClient> {
  return getPool().connect();
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[Database] Pool closed');
  }
}

/**
 * Check database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as healthy');
    return result.rows[0]?.healthy === 1;
  } catch {
    return false;
  }
}

/**
 * Get pool statistics
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  const p = getPool();
  return {
    totalCount: p.totalCount,
    idleCount: p.idleCount,
    waitingCount: p.waitingCount,
  };
}

// Export pool type for external use
export type { Pool } from 'pg';
