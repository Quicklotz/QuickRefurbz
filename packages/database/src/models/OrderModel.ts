/**
 * Order Model - Purchase orders, sales orders, and transfers
 */

import { query, transaction } from '../connection.js';
import { generateOrderId } from '../sequences.js';
import { BaseModel, type ModelConfig, type ColumnMapping, buildWhereClause, paginate } from './BaseModel.js';
import type {
  Order,
  CreateOrderInput,
  UpdateOrderInput,
  OrderStatus,
  OrderType,
  PaginationOptions,
  PaginatedResult,
  WhereCondition
} from '../types.js';

function rowToOrder(row: any): Order {
  return {
    id: row.id,
    orderId: row.order_id,
    type: row.type,
    status: row.status,
    supplierId: row.supplier_id,
    customerId: row.customer_id,
    manifestId: row.manifest_id,
    totalItems: parseInt(row.total_items || '0', 10),
    totalCost: row.total_cost ? parseFloat(row.total_cost) : undefined,
    totalPrice: row.total_price ? parseFloat(row.total_price) : undefined,
    shippingCost: row.shipping_cost ? parseFloat(row.shipping_cost) : undefined,
    trackingNumber: row.tracking_number,
    carrier: row.carrier,
    notes: row.notes,
    metadata: row.metadata || {},
    orderedAt: row.ordered_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const orderColumns: ColumnMapping[] = [
  { key: 'orderId', column: 'order_id' },
  { key: 'type', column: 'type' },
  { key: 'status', column: 'status' },
  { key: 'supplierId', column: 'supplier_id' },
  { key: 'customerId', column: 'customer_id' },
  { key: 'manifestId', column: 'manifest_id' },
  { key: 'totalItems', column: 'total_items' },
  { key: 'totalCost', column: 'total_cost' },
  { key: 'totalPrice', column: 'total_price' },
  { key: 'shippingCost', column: 'shipping_cost' },
  { key: 'trackingNumber', column: 'tracking_number' },
  { key: 'carrier', column: 'carrier' },
  { key: 'notes', column: 'notes' },
  { key: 'metadata', column: 'metadata', isJson: true },
  { key: 'orderedAt', column: 'ordered_at' },
  { key: 'shippedAt', column: 'shipped_at' },
  { key: 'deliveredAt', column: 'delivered_at' },
];

export class OrderModel extends BaseModel<Order, CreateOrderInput, UpdateOrderInput> {
  protected config: ModelConfig<Order> = {
    tableName: 'public.orders',
    primaryKey: 'id',
    columns: orderColumns,
    rowMapper: rowToOrder,
  };

  /**
   * Create a new order
   */
  async create(input: CreateOrderInput): Promise<Order> {
    const orderId = input.orderId || await generateOrderId(input.type);

    const result = await query(
      `INSERT INTO public.orders (
        order_id, type, status, supplier_id, customer_id, manifest_id,
        total_items, total_cost, total_price, shipping_cost,
        tracking_number, carrier, notes, metadata, ordered_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        orderId,
        input.type,
        input.status || 'pending',
        input.supplierId,
        input.customerId,
        input.manifestId,
        input.totalItems || 0,
        input.totalCost,
        input.totalPrice,
        input.shippingCost,
        input.trackingNumber,
        input.carrier,
        input.notes,
        JSON.stringify(input.metadata || {}),
        input.orderedAt || new Date(),
      ]
    );

    return rowToOrder(result.rows[0]);
  }

  /**
   * Get order by order ID
   */
  async getByOrderId(orderId: string): Promise<Order | null> {
    const result = await query(
      'SELECT * FROM public.orders WHERE order_id = $1',
      [orderId]
    );
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }

  /**
   * Get orders by supplier
   */
  async getBySupplier(supplierId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Order>> {
    const { where, params } = buildWhereClause([
      { field: 'supplier_id', operator: '=', value: supplierId }
    ]);
    const baseQuery = `SELECT * FROM public.orders ${where}`;

    return paginate<Order>(baseQuery, params, options, rowToOrder);
  }

  /**
   * Get orders by type
   */
  async getByType(type: OrderType, options: PaginationOptions = {}): Promise<PaginatedResult<Order>> {
    const { where, params } = buildWhereClause([
      { field: 'type', operator: '=', value: type }
    ]);
    const baseQuery = `SELECT * FROM public.orders ${where}`;

    return paginate<Order>(baseQuery, params, options, rowToOrder);
  }

  /**
   * Get orders by status
   */
  async getByStatus(status: OrderStatus): Promise<Order[]> {
    const result = await query(
      'SELECT * FROM public.orders WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
    return result.rows.map(rowToOrder);
  }

  /**
   * Update order status
   */
  async updateStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
    const updates: Record<string, any> = { status };

    // Auto-set timestamps based on status
    if (status === 'shipped') {
      updates.shippedAt = new Date();
    } else if (status === 'delivered') {
      updates.deliveredAt = new Date();
    }

    const sets: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (updates.shippedAt) {
      sets.push(`shipped_at = $${paramIndex}`);
      values.push(updates.shippedAt);
      paramIndex++;
    }
    if (updates.deliveredAt) {
      sets.push(`delivered_at = $${paramIndex}`);
      values.push(updates.deliveredAt);
      paramIndex++;
    }

    values.push(orderId);

    const result = await query(
      `UPDATE public.orders SET ${sets.join(', ')} WHERE order_id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }

  /**
   * Add tracking information
   */
  async addTracking(orderId: string, trackingNumber: string, carrier?: string): Promise<Order | null> {
    const result = await query(
      `UPDATE public.orders
       SET tracking_number = $1, carrier = $2, updated_at = NOW()
       WHERE order_id = $3
       RETURNING *`,
      [trackingNumber, carrier, orderId]
    );
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }

  /**
   * Get recent orders
   */
  async getRecent(limit = 50, type?: OrderType): Promise<Order[]> {
    let sql = 'SELECT * FROM public.orders';
    const params: any[] = [];

    if (type) {
      sql += ' WHERE type = $1';
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows.map(rowToOrder);
  }

  /**
   * Get pending orders (need action)
   */
  async getPending(): Promise<Order[]> {
    const result = await query(
      `SELECT * FROM public.orders
       WHERE status IN ('pending', 'confirmed', 'processing')
       ORDER BY ordered_at ASC`
    );
    return result.rows.map(rowToOrder);
  }

  /**
   * Count orders by status
   */
  async countByStatus(): Promise<Record<OrderStatus, number>> {
    const result = await query(
      `SELECT status, COUNT(*) as count
       FROM public.orders
       GROUP BY status`
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }
    return counts as Record<OrderStatus, number>;
  }

  /**
   * Count orders by type
   */
  async countByType(): Promise<Record<OrderType, number>> {
    const result = await query(
      `SELECT type, COUNT(*) as count
       FROM public.orders
       GROUP BY type`
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.type] = parseInt(row.count, 10);
    }
    return counts as Record<OrderType, number>;
  }

  /**
   * Get order statistics for date range
   */
  async getStats(startDate: Date, endDate: Date): Promise<{
    totalOrders: number;
    totalCost: number;
    totalRevenue: number;
    byType: Record<OrderType, number>;
    byStatus: Record<OrderStatus, number>;
  }> {
    const result = await query(
      `SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(total_price), 0) as total_revenue
       FROM public.orders
       WHERE created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );

    const typeResult = await query(
      `SELECT type, COUNT(*) as count
       FROM public.orders
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY type`,
      [startDate, endDate]
    );

    const statusResult = await query(
      `SELECT status, COUNT(*) as count
       FROM public.orders
       WHERE created_at >= $1 AND created_at <= $2
       GROUP BY status`,
      [startDate, endDate]
    );

    const byType: Record<string, number> = {};
    for (const row of typeResult.rows) {
      byType[row.type] = parseInt(row.count, 10);
    }

    const byStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    return {
      totalOrders: parseInt(result.rows[0].total_orders, 10),
      totalCost: parseFloat(result.rows[0].total_cost) || 0,
      totalRevenue: parseFloat(result.rows[0].total_revenue) || 0,
      byType: byType as Record<OrderType, number>,
      byStatus: byStatus as Record<OrderStatus, number>,
    };
  }

  /**
   * Link order to manifest
   */
  async linkManifest(orderId: string, manifestId: string): Promise<Order | null> {
    const result = await query(
      `UPDATE public.orders
       SET manifest_id = $1, updated_at = NOW()
       WHERE order_id = $2
       RETURNING *`,
      [manifestId, orderId]
    );
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }
}

// Export types
export type { Order, CreateOrderInput, UpdateOrderInput, OrderStatus, OrderType };
