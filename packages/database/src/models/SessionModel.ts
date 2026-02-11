/**
 * Session Model - Receiving sessions for intake processing
 */

import { query, transaction } from '../connection.js';
import { generateSessionId } from '../sequences.js';
import { BaseModel, type ModelConfig, type ColumnMapping, buildWhereClause, paginate } from './BaseModel.js';
import type {
  ReceivingSession,
  CreateSessionInput,
  UpdateSessionInput,
  SessionStatus,
  PaginationOptions,
  PaginatedResult,
  WhereCondition
} from '../types.js';

function rowToSession(row: any): ReceivingSession {
  return {
    id: row.id,
    sessionId: row.session_id,
    manifestId: row.manifest_id,
    palletId: row.pallet_id,
    supplierId: row.supplier_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    userId: row.user_id,
    userName: row.user_name,
    warehouse: row.warehouse,
    totalItems: parseInt(row.total_items || '0', 10),
    receivedItems: parseInt(row.received_items || '0', 10),
    lastItemQlid: row.last_item_qlid,
    notes: row.notes,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const sessionColumns: ColumnMapping[] = [
  { key: 'sessionId', column: 'session_id' },
  { key: 'manifestId', column: 'manifest_id' },
  { key: 'palletId', column: 'pallet_id' },
  { key: 'supplierId', column: 'supplier_id' },
  { key: 'status', column: 'status' },
  { key: 'startedAt', column: 'started_at' },
  { key: 'completedAt', column: 'completed_at' },
  { key: 'userId', column: 'user_id' },
  { key: 'userName', column: 'user_name' },
  { key: 'warehouse', column: 'warehouse' },
  { key: 'totalItems', column: 'total_items' },
  { key: 'receivedItems', column: 'received_items' },
  { key: 'lastItemQlid', column: 'last_item_qlid' },
  { key: 'notes', column: 'notes' },
  { key: 'metadata', column: 'metadata', isJson: true },
];

export class SessionModel extends BaseModel<ReceivingSession, CreateSessionInput, UpdateSessionInput> {
  protected config: ModelConfig<ReceivingSession> = {
    tableName: 'public.receiving_sessions',
    primaryKey: 'id',
    columns: sessionColumns,
    rowMapper: rowToSession,
  };

  /**
   * Start a new receiving session
   */
  async create(input: CreateSessionInput): Promise<ReceivingSession> {
    const sessionId = input.sessionId || generateSessionId();

    const result = await query(
      `INSERT INTO public.receiving_sessions (
        session_id, manifest_id, pallet_id, supplier_id, status,
        started_at, user_id, user_name, warehouse, notes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        sessionId,
        input.manifestId,
        input.palletId,
        input.supplierId,
        'active',
        new Date(),
        input.userId,
        input.userName,
        input.warehouse,
        input.notes,
        JSON.stringify(input.metadata || {}),
      ]
    );

    return rowToSession(result.rows[0]);
  }

  /**
   * Get session by session ID
   */
  async getBySessionId(sessionId: string): Promise<ReceivingSession | null> {
    const result = await query(
      'SELECT * FROM public.receiving_sessions WHERE session_id = $1',
      [sessionId]
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  /**
   * Get active sessions
   */
  async getActive(): Promise<ReceivingSession[]> {
    const result = await query(
      "SELECT * FROM public.receiving_sessions WHERE status = 'active' ORDER BY started_at DESC"
    );
    return result.rows.map(rowToSession);
  }

  /**
   * Get active session for user
   */
  async getActiveForUser(userId: string): Promise<ReceivingSession | null> {
    const result = await query(
      "SELECT * FROM public.receiving_sessions WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [userId]
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  /**
   * Get sessions for manifest
   */
  async getByManifest(manifestId: string): Promise<ReceivingSession[]> {
    const result = await query(
      'SELECT * FROM public.receiving_sessions WHERE manifest_id = $1 ORDER BY started_at DESC',
      [manifestId]
    );
    return result.rows.map(rowToSession);
  }

  /**
   * Get sessions by status
   */
  async getByStatus(status: SessionStatus): Promise<ReceivingSession[]> {
    const result = await query(
      'SELECT * FROM public.receiving_sessions WHERE status = $1 ORDER BY started_at DESC',
      [status]
    );
    return result.rows.map(rowToSession);
  }

  /**
   * Update session status
   */
  async updateStatus(sessionId: string, status: SessionStatus): Promise<ReceivingSession | null> {
    const updates: any = { status };

    if (status === 'completed' || status === 'cancelled') {
      updates.completedAt = new Date();
    }

    const sets = ['status = $1', 'updated_at = NOW()'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (updates.completedAt) {
      sets.push(`completed_at = $${paramIndex}`);
      values.push(updates.completedAt);
      paramIndex++;
    }

    values.push(sessionId);

    const result = await query(
      `UPDATE public.receiving_sessions SET ${sets.join(', ')} WHERE session_id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  /**
   * Pause a session
   */
  async pause(sessionId: string): Promise<ReceivingSession | null> {
    return this.updateStatus(sessionId, 'paused');
  }

  /**
   * Resume a paused session
   */
  async resume(sessionId: string): Promise<ReceivingSession | null> {
    return this.updateStatus(sessionId, 'active');
  }

  /**
   * Complete a session
   */
  async complete(sessionId: string): Promise<ReceivingSession | null> {
    return this.updateStatus(sessionId, 'completed');
  }

  /**
   * Cancel a session
   */
  async cancel(sessionId: string): Promise<ReceivingSession | null> {
    return this.updateStatus(sessionId, 'cancelled');
  }

  /**
   * Increment received item count
   */
  async incrementReceived(sessionId: string, lastQlid?: string): Promise<ReceivingSession | null> {
    let sql = `UPDATE public.receiving_sessions
               SET received_items = received_items + 1, updated_at = NOW()`;
    const values: any[] = [];
    let paramIndex = 1;

    if (lastQlid) {
      sql += `, last_item_qlid = $${paramIndex}`;
      values.push(lastQlid);
      paramIndex++;
    }

    sql += ` WHERE session_id = $${paramIndex} RETURNING *`;
    values.push(sessionId);

    const result = await query(sql, values);
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  /**
   * Set total expected items
   */
  async setTotalItems(sessionId: string, totalItems: number): Promise<ReceivingSession | null> {
    const result = await query(
      `UPDATE public.receiving_sessions
       SET total_items = $1, updated_at = NOW()
       WHERE session_id = $2
       RETURNING *`,
      [totalItems, sessionId]
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  /**
   * Update pallet for session
   */
  async updatePallet(sessionId: string, palletId: string): Promise<ReceivingSession | null> {
    const result = await query(
      `UPDATE public.receiving_sessions
       SET pallet_id = $1, updated_at = NOW()
       WHERE session_id = $2
       RETURNING *`,
      [palletId, sessionId]
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  /**
   * Get recent sessions
   */
  async getRecent(limit = 50): Promise<ReceivingSession[]> {
    const result = await query(
      `SELECT * FROM public.receiving_sessions
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(rowToSession);
  }

  /**
   * Get sessions by user
   */
  async getByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<ReceivingSession>> {
    const { where, params } = buildWhereClause([
      { field: 'user_id', operator: '=', value: userId }
    ]);
    const baseQuery = `SELECT * FROM public.receiving_sessions ${where}`;

    return paginate<ReceivingSession>(baseQuery, params, options, rowToSession);
  }

  /**
   * Get session statistics for date range
   */
  async getStats(startDate: Date, endDate: Date): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalItemsReceived: number;
    avgItemsPerSession: number;
    byUser: Array<{ userId: string; userName: string; sessionCount: number; itemCount: number }>;
  }> {
    const result = await query(
      `SELECT
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
        COALESCE(SUM(received_items), 0) as total_items_received
       FROM public.receiving_sessions
       WHERE started_at >= $1 AND started_at <= $2`,
      [startDate, endDate]
    );

    const userResult = await query(
      `SELECT user_id, user_name,
              COUNT(*) as session_count,
              COALESCE(SUM(received_items), 0) as item_count
       FROM public.receiving_sessions
       WHERE started_at >= $1 AND started_at <= $2
       GROUP BY user_id, user_name
       ORDER BY item_count DESC`,
      [startDate, endDate]
    );

    const totalSessions = parseInt(result.rows[0].total_sessions, 10);
    const totalItemsReceived = parseInt(result.rows[0].total_items_received, 10);

    return {
      totalSessions,
      completedSessions: parseInt(result.rows[0].completed_sessions, 10),
      totalItemsReceived,
      avgItemsPerSession: totalSessions > 0 ? Math.round(totalItemsReceived / totalSessions) : 0,
      byUser: userResult.rows.map((row: any) => ({
        userId: row.user_id,
        userName: row.user_name,
        sessionCount: parseInt(row.session_count, 10),
        itemCount: parseInt(row.item_count, 10),
      })),
    };
  }

  /**
   * Count sessions by status
   */
  async countByStatus(): Promise<Record<SessionStatus, number>> {
    const result = await query(
      `SELECT status, COUNT(*) as count
       FROM public.receiving_sessions
       GROUP BY status`
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts as Record<SessionStatus, number>;
  }
}

// Export types
export type { ReceivingSession, CreateSessionInput, UpdateSessionInput, SessionStatus };
