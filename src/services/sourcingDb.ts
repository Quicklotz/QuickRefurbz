/**
 * Sourcing Database Connection
 * Read-only pg.Pool singleton for the remote upscaled_cogs database on HetznerCO.
 * Used to look up pallet/order sourcing data and BestBuy product information.
 *
 * Environment variables:
 *   SOURCING_DB_HOST     (default: 5.161.239.237)
 *   SOURCING_DB_PORT     (default: 5432)
 *   SOURCING_DB_NAME     (default: upscaled_cogs)
 *   SOURCING_DB_USER     (default: '')
 *   SOURCING_DB_PASSWORD (default: '')
 */

import pg from 'pg';

const { Pool } = pg;

// ==================== CONFIGURATION ====================

function getSourcingConfig(): pg.PoolConfig {
  return {
    host: process.env.SOURCING_DB_HOST || '5.161.239.237',
    port: parseInt(process.env.SOURCING_DB_PORT || '5432', 10),
    database: process.env.SOURCING_DB_NAME || 'upscaled_cogs',
    user: process.env.SOURCING_DB_USER || '',
    password: process.env.SOURCING_DB_PASSWORD || '',
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: true,
  };
}

// ==================== SINGLETON POOL ====================

let pool: pg.Pool | null = null;

/**
 * Check whether all required sourcing DB env vars are present.
 * Returns true if at least host and user are configured.
 */
export function isSourcingConfigured(): boolean {
  const user = process.env.SOURCING_DB_USER;
  return !!(user && user.length > 0);
}

/**
 * Get or create the sourcing database pool (lazy initialization).
 * Throws if the sourcing DB is not configured.
 */
export function getSourcingPool(): pg.Pool {
  if (!pool) {
    if (!isSourcingConfigured()) {
      throw new Error(
        '[SourcingDB] Not configured. Set SOURCING_DB_USER and SOURCING_DB_PASSWORD environment variables.'
      );
    }

    const config = getSourcingConfig();
    pool = new Pool(config);

    pool.on('error', (err) => {
      console.error('[SourcingDB] Unexpected pool error:', err);
    });

    if (process.env.DEBUG_SQL === 'true') {
      pool.on('connect', () => {
        console.log('[SourcingDB] New client connected to pool');
      });
    }
  }
  return pool;
}

/**
 * Close the sourcing pool (for graceful shutdown).
 */
export async function closeSourcingPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[SourcingDB] Pool closed');
  }
}

/**
 * Test connectivity to the sourcing database.
 * Returns true on success, false on failure (logs error).
 */
export async function testSourcingConnection(): Promise<boolean> {
  if (!isSourcingConfigured()) {
    console.warn('[SourcingDB] Not configured - skipping connection test');
    return false;
  }

  try {
    const p = getSourcingPool();
    const result = await p.query('SELECT 1 AS healthy');
    return result.rows[0]?.healthy === 1;
  } catch (err) {
    console.error('[SourcingDB] Connection test failed:', err);
    return false;
  }
}
