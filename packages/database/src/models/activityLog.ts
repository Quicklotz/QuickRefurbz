/**
 * Activity Log Model - Audit trail for all operations
 */

import { query } from '../connection.js';
import { paginate, type PaginationOptions, type PaginatedResult } from '../utils/query.js';

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface CreateActivityLogInput {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

function rowToActivityLog(row: any): ActivityLog {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    userId: row.user_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export class ActivityLogModel {
  /**
   * Log an activity
   */
  async log(input: CreateActivityLogInput): Promise<ActivityLog> {
    const result = await query(
      `INSERT INTO public.activity_log (
        entity_type, entity_id, action, old_value, new_value,
        user_id, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.entityType,
        input.entityId,
        input.action,
        input.oldValue ? JSON.stringify(input.oldValue) : null,
        input.newValue ? JSON.stringify(input.newValue) : null,
        input.userId,
        input.ipAddress,
        input.userAgent,
      ]
    );

    return rowToActivityLog(result.rows[0]);
  }

  /**
   * Get activity for an entity
   */
  async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    const result = await query(
      `SELECT * FROM public.activity_log
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
    return result.rows.map(rowToActivityLog);
  }

  /**
   * Get activity by user
   */
  async getByUser(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<ActivityLog>> {
    const baseQuery = 'SELECT * FROM public.activity_log WHERE user_id = $1';

    return paginate<ActivityLog>(
      baseQuery,
      [userId],
      options,
      (row) => rowToActivityLog(row)
    );
  }

  /**
   * Get recent activity
   */
  async getRecent(limit = 100): Promise<ActivityLog[]> {
    const result = await query(
      `SELECT * FROM public.activity_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(rowToActivityLog);
  }

  /**
   * Get activity by action type
   */
  async getByAction(action: string, options: PaginationOptions = {}): Promise<PaginatedResult<ActivityLog>> {
    const baseQuery = 'SELECT * FROM public.activity_log WHERE action = $1';

    return paginate<ActivityLog>(
      baseQuery,
      [action],
      options,
      (row) => rowToActivityLog(row)
    );
  }

  /**
   * Get activity within date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<ActivityLog[]> {
    const result = await query(
      `SELECT * FROM public.activity_log
       WHERE created_at >= $1 AND created_at <= $2
       ORDER BY created_at DESC`,
      [startDate, endDate]
    );
    return result.rows.map(rowToActivityLog);
  }

  /**
   * Log item creation
   */
  async logItemCreated(itemId: string, qlid: string, userId?: string): Promise<ActivityLog> {
    return this.log({
      entityType: 'item',
      entityId: qlid,
      action: 'created',
      newValue: { id: itemId, qlid },
      userId,
    });
  }

  /**
   * Log item status change
   */
  async logItemStatusChange(
    qlid: string,
    oldStatus: string,
    newStatus: string,
    userId?: string
  ): Promise<ActivityLog> {
    return this.log({
      entityType: 'item',
      entityId: qlid,
      action: 'status_changed',
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
      userId,
    });
  }

  /**
   * Log item graded
   */
  async logItemGraded(
    qlid: string,
    grade: string,
    condition: string,
    userId?: string
  ): Promise<ActivityLog> {
    return this.log({
      entityType: 'item',
      entityId: qlid,
      action: 'graded',
      newValue: { grade, condition },
      userId,
    });
  }

  /**
   * Log pallet created
   */
  async logPalletCreated(palletId: string, userId?: string): Promise<ActivityLog> {
    return this.log({
      entityType: 'pallet',
      entityId: palletId,
      action: 'created',
      newValue: { palletId },
      userId,
    });
  }

  /**
   * Log manifest received
   */
  async logManifestReceived(manifestId: string, itemCount: number, userId?: string): Promise<ActivityLog> {
    return this.log({
      entityType: 'manifest',
      entityId: manifestId,
      action: 'received',
      newValue: { manifestId, itemCount },
      userId,
    });
  }

  /**
   * Cleanup old logs (retention policy)
   */
  async cleanup(retentionDays = 365): Promise<number> {
    const result = await query(
      `DELETE FROM public.activity_log
       WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
      [retentionDays]
    );
    return result.rowCount ?? 0;
  }
}
