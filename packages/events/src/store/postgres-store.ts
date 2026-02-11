import { Pool } from 'pg';
import { EventEnvelope } from '../types/envelope';

/**
 * Configuration for PostgreSQL Event Store
 */
export interface PostgresEventStoreConfig {
  /** PostgreSQL connection string or pool configuration */
  connectionString?: string;

  /** Existing pool to use (if not using connectionString) */
  pool?: Pool;

  /** Table name for events */
  tableName?: string;

  /** Schema name */
  schemaName?: string;
}

/**
 * Query options for event retrieval
 */
export interface EventQueryOptions {
  /** Start from this version/sequence number */
  fromSequence?: bigint;

  /** Limit number of results */
  limit?: number;

  /** Filter by event types */
  eventTypes?: string[];
}

/**
 * Time range query options
 */
export interface TimeRangeOptions {
  startTime: Date;
  endTime: Date;
  eventType?: string;
  limit?: number;
}

/**
 * PostgreSQL-based Event Store for QuickWMS
 *
 * Features:
 * - Durable event storage for audit trail
 * - Query by QLID for item lifecycle tracking
 * - Query by correlation ID for saga tracing
 * - Time-based queries for debugging/replay
 * - Transactional batch writes
 */
export class PostgresEventStore {
  private pool: Pool;
  private ownPool: boolean;
  private tableName: string;
  private schemaName: string;
  private initialized = false;

  constructor(config: PostgresEventStoreConfig) {
    if (config.pool) {
      this.pool = config.pool;
      this.ownPool = false;
    } else if (config.connectionString) {
      this.pool = new Pool({ connectionString: config.connectionString });
      this.ownPool = true;
    } else {
      throw new Error('Either connectionString or pool must be provided');
    }

    this.tableName = config.tableName ?? 'event_store';
    this.schemaName = config.schemaName ?? 'public';
  }

  /**
   * Get the full qualified table name
   */
  private get fullTableName(): string {
    return `"${this.schemaName}"."${this.tableName}"`;
  }

  /**
   * Initialize the event store table
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const query = `
      CREATE TABLE IF NOT EXISTS ${this.fullTableName} (
        sequence_number BIGSERIAL PRIMARY KEY,
        event_id UUID NOT NULL UNIQUE,
        event_type VARCHAR(255) NOT NULL,
        source VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        qlid VARCHAR(9),
        correlation_id UUID,
        causation_id UUID,
        user_id VARCHAR(255),
        warehouse_id VARCHAR(255),
        version INTEGER NOT NULL DEFAULT 1,
        data JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Indexes for common query patterns
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_event_type
        ON ${this.fullTableName}(event_type);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_qlid
        ON ${this.fullTableName}(qlid)
        WHERE qlid IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_correlation_id
        ON ${this.fullTableName}(correlation_id)
        WHERE correlation_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_subject
        ON ${this.fullTableName}(subject)
        WHERE subject IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at
        ON ${this.fullTableName}(created_at);

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_source
        ON ${this.fullTableName}(source);
    `;

    await this.pool.query(query);
    this.initialized = true;
  }

  /**
   * Append a single event to the store
   */
  async append(event: EventEnvelope): Promise<bigint> {
    const query = `
      INSERT INTO ${this.fullTableName} (
        event_id, event_type, source, subject, qlid,
        correlation_id, causation_id, user_id, warehouse_id,
        version, data, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING sequence_number
    `;

    const result = await this.pool.query(query, [
      event.id,
      event.type,
      event.source,
      event.subject ?? null,
      event.qlid ?? null,
      event.correlationId ?? null,
      event.causationId ?? null,
      event.userId ?? null,
      event.warehouseId ?? null,
      event.version,
      JSON.stringify(event.data),
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.time,
    ]);

    return BigInt(result.rows[0].sequence_number);
  }

  /**
   * Append multiple events in a transaction
   */
  async appendBatch(events: EventEnvelope[]): Promise<bigint[]> {
    if (events.length === 0) return [];

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const sequenceNumbers: bigint[] = [];

      for (const event of events) {
        const result = await client.query(
          `
          INSERT INTO ${this.fullTableName} (
            event_id, event_type, source, subject, qlid,
            correlation_id, causation_id, user_id, warehouse_id,
            version, data, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING sequence_number
        `,
          [
            event.id,
            event.type,
            event.source,
            event.subject ?? null,
            event.qlid ?? null,
            event.correlationId ?? null,
            event.causationId ?? null,
            event.userId ?? null,
            event.warehouseId ?? null,
            event.version,
            JSON.stringify(event.data),
            event.metadata ? JSON.stringify(event.metadata) : null,
            event.time,
          ]
        );

        sequenceNumbers.push(BigInt(result.rows[0].sequence_number));
      }

      await client.query('COMMIT');
      return sequenceNumbers;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get events by aggregate/subject
   */
  async getBySubject(
    subject: string,
    options: EventQueryOptions = {}
  ): Promise<EventEnvelope[]> {
    let query = `
      SELECT * FROM ${this.fullTableName}
      WHERE subject = $1
    `;
    const params: unknown[] = [subject];
    let paramIndex = 2;

    if (options.fromSequence !== undefined) {
      query += ` AND sequence_number > $${paramIndex}`;
      params.push(options.fromSequence.toString());
      paramIndex++;
    }

    if (options.eventTypes && options.eventTypes.length > 0) {
      query += ` AND event_type = ANY($${paramIndex})`;
      params.push(options.eventTypes);
      paramIndex++;
    }

    query += ' ORDER BY sequence_number ASC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.rowToEvent(row));
  }

  /**
   * Get events by QLID (item lifecycle tracking)
   */
  async getByQlid(
    qlid: string,
    options: EventQueryOptions = {}
  ): Promise<EventEnvelope[]> {
    let query = `
      SELECT * FROM ${this.fullTableName}
      WHERE qlid = $1
    `;
    const params: unknown[] = [qlid];
    let paramIndex = 2;

    if (options.fromSequence !== undefined) {
      query += ` AND sequence_number > $${paramIndex}`;
      params.push(options.fromSequence.toString());
      paramIndex++;
    }

    if (options.eventTypes && options.eventTypes.length > 0) {
      query += ` AND event_type = ANY($${paramIndex})`;
      params.push(options.eventTypes);
      paramIndex++;
    }

    query += ' ORDER BY sequence_number ASC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.rowToEvent(row));
  }

  /**
   * Get events by correlation ID (saga/distributed transaction tracking)
   */
  async getByCorrelationId(
    correlationId: string,
    options: EventQueryOptions = {}
  ): Promise<EventEnvelope[]> {
    let query = `
      SELECT * FROM ${this.fullTableName}
      WHERE correlation_id = $1
    `;
    const params: unknown[] = [correlationId];
    let paramIndex = 2;

    if (options.fromSequence !== undefined) {
      query += ` AND sequence_number > $${paramIndex}`;
      params.push(options.fromSequence.toString());
      paramIndex++;
    }

    query += ' ORDER BY sequence_number ASC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.rowToEvent(row));
  }

  /**
   * Get events by time range (for replay/debugging)
   */
  async getByTimeRange(options: TimeRangeOptions): Promise<EventEnvelope[]> {
    let query = `
      SELECT * FROM ${this.fullTableName}
      WHERE created_at BETWEEN $1 AND $2
    `;
    const params: unknown[] = [options.startTime, options.endTime];
    let paramIndex = 3;

    if (options.eventType) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(options.eventType);
      paramIndex++;
    }

    query += ' ORDER BY sequence_number ASC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.rowToEvent(row));
  }

  /**
   * Get events by source service
   */
  async getBySource(
    source: string,
    options: EventQueryOptions = {}
  ): Promise<EventEnvelope[]> {
    let query = `
      SELECT * FROM ${this.fullTableName}
      WHERE source = $1
    `;
    const params: unknown[] = [source];
    let paramIndex = 2;

    if (options.fromSequence !== undefined) {
      query += ` AND sequence_number > $${paramIndex}`;
      params.push(options.fromSequence.toString());
      paramIndex++;
    }

    if (options.eventTypes && options.eventTypes.length > 0) {
      query += ` AND event_type = ANY($${paramIndex})`;
      params.push(options.eventTypes);
      paramIndex++;
    }

    query += ' ORDER BY sequence_number ASC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.rowToEvent(row));
  }

  /**
   * Get a single event by ID
   */
  async getById(eventId: string): Promise<EventEnvelope | null> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.fullTableName} WHERE event_id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) return null;
    return this.rowToEvent(result.rows[0]);
  }

  /**
   * Get event count (for monitoring)
   */
  async getCount(eventType?: string): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.fullTableName}`;
    const params: unknown[] = [];

    if (eventType) {
      query += ' WHERE event_type = $1';
      params.push(eventType);
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get latest sequence number (for consumers tracking position)
   */
  async getLatestSequence(): Promise<bigint | null> {
    const result = await this.pool.query(
      `SELECT MAX(sequence_number) as max_seq FROM ${this.fullTableName}`
    );

    const maxSeq = result.rows[0]?.max_seq;
    return maxSeq ? BigInt(maxSeq) : null;
  }

  /**
   * Convert database row to EventEnvelope
   */
  private rowToEvent(row: Record<string, unknown>): EventEnvelope {
    return {
      id: row.event_id as string,
      type: row.event_type as string,
      source: row.source as string,
      specversion: '1.0',
      datacontenttype: 'application/json',
      time: (row.created_at as Date).toISOString(),
      subject: row.subject as string | undefined,
      qlid: row.qlid as string | undefined,
      correlationId: row.correlation_id as string | undefined,
      causationId: row.causation_id as string | undefined,
      userId: row.user_id as string | undefined,
      warehouseId: row.warehouse_id as string | undefined,
      version: row.version as number,
      data: row.data as Record<string, unknown>,
      metadata: row.metadata as EventEnvelope['metadata'],
    };
  }

  /**
   * Close the connection pool (only if we own it)
   */
  async close(): Promise<void> {
    if (this.ownPool) {
      await this.pool.end();
    }
  }
}

export default PostgresEventStore;
