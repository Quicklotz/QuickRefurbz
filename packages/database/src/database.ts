/**
 * Main Database Class
 * Provides a unified interface for all database operations
 */

import { getPool, query, transaction, closePool, healthCheck } from './connection.js';
import { ItemModel } from './models/item.js';
import { ManifestModel } from './models/manifest.js';
import { PalletModel } from './models/pallet.js';
import { ActivityLogModel } from './models/activityLog.js';
import { generateQLID } from './utils/qlid.js';
import type pg from 'pg';

export class Database {
  private static instance: Database | null = null;
  private initialized = false;

  // Model instances
  public readonly items: ItemModel;
  public readonly manifests: ManifestModel;
  public readonly pallets: PalletModel;
  public readonly activityLog: ActivityLogModel;

  private constructor() {
    this.items = new ItemModel();
    this.manifests = new ManifestModel();
    this.pallets = new PalletModel();
    this.activityLog = new ActivityLogModel();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Initialize database connection and verify schema
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection
      const healthy = await healthCheck();
      if (!healthy) {
        throw new Error('Database health check failed');
      }

      // Verify required tables exist
      await this.verifySchema();

      this.initialized = true;
      console.log('[Database] Initialized successfully');
    } catch (error) {
      console.error('[Database] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Verify database schema exists
   */
  private async verifySchema(): Promise<void> {
    const requiredTables = ['items', 'manifests', 'pallets', 'activity_log'];

    for (const table of requiredTables) {
      const result = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )`,
        [table]
      );

      if (!result.rows[0].exists) {
        console.warn(`[Database] Table '${table}' not found. Running migrations...`);
        await this.runMigrations();
        break;
      }
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    await transaction(async (client) => {
      // Create items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          qlid VARCHAR(20) UNIQUE NOT NULL,
          upc VARCHAR(20),
          sku VARCHAR(50),
          title VARCHAR(500),
          description TEXT,
          category VARCHAR(100),
          brand VARCHAR(100),
          model VARCHAR(100),
          condition VARCHAR(50),
          grade VARCHAR(10),
          cost DECIMAL(10,2),
          msrp DECIMAL(10,2),
          listed_price DECIMAL(10,2),
          sold_price DECIMAL(10,2),
          status VARCHAR(50) DEFAULT 'intake',
          location VARCHAR(50),
          warehouse VARCHAR(20),
          pallet_id VARCHAR(50),
          manifest_id VARCHAR(50),
          supplier_id VARCHAR(50),
          images JSONB DEFAULT '[]'::JSONB,
          metadata JSONB DEFAULT '{}'::JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by VARCHAR(100),
          updated_by VARCHAR(100)
        )
      `);

      // Create manifests table
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.manifests (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          manifest_id VARCHAR(50) UNIQUE NOT NULL,
          supplier_id VARCHAR(50),
          supplier_name VARCHAR(200),
          source VARCHAR(100),
          total_items INTEGER DEFAULT 0,
          total_cost DECIMAL(12,2),
          received_date DATE,
          status VARCHAR(50) DEFAULT 'pending',
          metadata JSONB DEFAULT '{}'::JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create pallets table
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.pallets (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          pallet_id VARCHAR(50) UNIQUE NOT NULL,
          type VARCHAR(50),
          status VARCHAR(50) DEFAULT 'open',
          location VARCHAR(50),
          warehouse VARCHAR(20),
          item_count INTEGER DEFAULT 0,
          total_cost DECIMAL(12,2),
          total_msrp DECIMAL(12,2),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create activity log table
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.activity_log (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          entity_type VARCHAR(50),
          entity_id VARCHAR(100),
          action VARCHAR(50),
          old_value JSONB,
          new_value JSONB,
          user_id VARCHAR(100),
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create sequences
      await client.query(`
        CREATE SEQUENCE IF NOT EXISTS public.qlid_sequence START 1
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_items_qlid ON public.items(qlid);
        CREATE INDEX IF NOT EXISTS idx_items_upc ON public.items(upc);
        CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);
        CREATE INDEX IF NOT EXISTS idx_items_pallet ON public.items(pallet_id);
        CREATE INDEX IF NOT EXISTS idx_items_manifest ON public.items(manifest_id);
        CREATE INDEX IF NOT EXISTS idx_manifests_status ON public.manifests(status);
        CREATE INDEX IF NOT EXISTS idx_pallets_status ON public.pallets(status);
        CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activity_log(entity_type, entity_id);
      `);
    });

    console.log('[Database] Migrations completed');
  }

  /**
   * Generate a new QLID
   */
  async generateQLID(): Promise<string> {
    return generateQLID();
  }

  /**
   * Execute raw query
   */
  async query<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    return query<T>(text, params);
  }

  /**
   * Execute function within transaction
   */
  async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    return transaction(fn);
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    return healthCheck();
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await closePool();
    this.initialized = false;
    Database.instance = null;
  }
}

// Export singleton instance
export const db = Database.getInstance();
