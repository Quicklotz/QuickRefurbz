/**
 * Data Feed Service
 * Real-time data feeds for integration with Shopify, eBay, and other systems
 * Supports webhooks (push) and polling (pull) for product updates
 */

import { getPool, generateUUID } from '../database.js';
import crypto from 'crypto';

// ==================== TYPES ====================

export type FeedFormat = 'json' | 'shopify' | 'ebay' | 'csv' | 'xml';
export type WebhookEvent =
  | 'item.created'
  | 'item.updated'
  | 'item.completed'
  | 'item.graded'
  | 'item.certified'
  | 'pallet.created'
  | 'pallet.completed'
  | 'inventory.low';

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  format: FeedFormat;
  isActive: boolean;
  headers?: Record<string, string>;
  retryCount: number;
  lastTriggeredAt?: string;
  lastStatus?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: WebhookEvent;
  payload: any;
  status: 'pending' | 'delivered' | 'failed';
  statusCode?: number;
  response?: string;
  attempts: number;
  nextRetryAt?: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface FeedItem {
  id: string;
  qlid: string;
  qsku: string;
  title: string;
  description: string;
  manufacturer: string;
  model: string;
  category: string;
  condition: string;
  grade: string;
  price: number | null;
  msrp: number | null;
  costBasis: number | null;
  quantity: number;
  upc: string | null;
  serialNumber: string | null;
  images: string[];
  specifications: Record<string, string>;
  certificationId: string | null;
  warrantyEligible: boolean;
  dataWiped: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface FeedFilters {
  since?: string;          // ISO date - items updated after this time
  until?: string;          // ISO date - items updated before this time
  status?: string;         // Filter by status (completed, etc.)
  grade?: string;          // Filter by grade (A, B, C, etc.)
  category?: string;       // Filter by category
  palletId?: string;       // Filter by pallet
  limit?: number;          // Max items to return
  offset?: number;         // Pagination offset
  includeImages?: boolean; // Include image URLs
}

// ==================== CONSTANTS ====================

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAYS = [60, 300, 900, 3600, 14400]; // 1min, 5min, 15min, 1hr, 4hr
const WEBHOOK_TIMEOUT = 30000; // 30 seconds

// Condition mapping for e-commerce platforms
const GRADE_TO_CONDITION: Record<string, { shopify: string; ebay: string; description: string }> = {
  'A': { shopify: 'new', ebay: '1000', description: 'Like New - No visible wear' },
  'B': { shopify: 'refurbished', ebay: '2500', description: 'Excellent - Minor cosmetic wear' },
  'C': { shopify: 'refurbished', ebay: '3000', description: 'Good - Light scratches or wear' },
  'D': { shopify: 'used', ebay: '4000', description: 'Fair - Visible wear, fully functional' },
  'F': { shopify: 'used', ebay: '7000', description: 'Parts Only - For parts or repair' },
};

// ==================== WEBHOOK MANAGEMENT ====================

/**
 * Create a new webhook subscription
 */
export async function createWebhook(data: {
  name: string;
  url: string;
  events: WebhookEvent[];
  format?: FeedFormat;
  headers?: Record<string, string>;
}): Promise<WebhookSubscription> {
  const db = getPool();
  const id = generateUUID();
  const secret = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();

  await db.query(`
    INSERT INTO webhook_subscriptions (
      id, name, url, secret, events, format, headers, is_active, retry_count, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0, $8, $8)
  `, [
    id,
    data.name,
    data.url,
    secret,
    JSON.stringify(data.events),
    data.format || 'json',
    data.headers ? JSON.stringify(data.headers) : null,
    now
  ]);

  return {
    id,
    name: data.name,
    url: data.url,
    secret,
    events: data.events,
    format: data.format || 'json',
    isActive: true,
    headers: data.headers,
    retryCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Get webhook by ID
 */
export async function getWebhook(id: string): Promise<WebhookSubscription | null> {
  const db = getPool();
  const result = await db.query(`SELECT * FROM webhook_subscriptions WHERE id = $1`, [id]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return mapWebhookRow(row);
}

/**
 * List all webhooks
 */
export async function listWebhooks(activeOnly = false): Promise<WebhookSubscription[]> {
  const db = getPool();
  const query = activeOnly
    ? `SELECT * FROM webhook_subscriptions WHERE is_active = true ORDER BY created_at DESC`
    : `SELECT * FROM webhook_subscriptions ORDER BY created_at DESC`;

  const result = await db.query(query);
  return result.rows.map(mapWebhookRow);
}

/**
 * Update webhook subscription
 */
export async function updateWebhook(id: string, data: Partial<{
  name: string;
  url: string;
  events: WebhookEvent[];
  format: FeedFormat;
  headers: Record<string, string>;
  isActive: boolean;
}>): Promise<WebhookSubscription | null> {
  const db = getPool();
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }
  if (data.url !== undefined) {
    updates.push(`url = $${paramIndex++}`);
    params.push(data.url);
  }
  if (data.events !== undefined) {
    updates.push(`events = $${paramIndex++}`);
    params.push(JSON.stringify(data.events));
  }
  if (data.format !== undefined) {
    updates.push(`format = $${paramIndex++}`);
    params.push(data.format);
  }
  if (data.headers !== undefined) {
    updates.push(`headers = $${paramIndex++}`);
    params.push(JSON.stringify(data.headers));
  }
  if (data.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    params.push(data.isActive);
  }

  if (updates.length === 0) return getWebhook(id);

  updates.push(`updated_at = $${paramIndex++}`);
  params.push(new Date().toISOString());
  params.push(id);

  await db.query(
    `UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    params
  );

  return getWebhook(id);
}

/**
 * Delete webhook subscription
 */
export async function deleteWebhook(id: string): Promise<boolean> {
  const db = getPool();
  const result = await db.query(`DELETE FROM webhook_subscriptions WHERE id = $1`, [id]);
  return (result.rowCount || 0) > 0;
}

/**
 * Regenerate webhook secret
 */
export async function regenerateWebhookSecret(id: string): Promise<string | null> {
  const db = getPool();
  const newSecret = crypto.randomBytes(32).toString('hex');

  const result = await db.query(
    `UPDATE webhook_subscriptions SET secret = $1, updated_at = $2 WHERE id = $3`,
    [newSecret, new Date().toISOString(), id]
  );

  return (result.rowCount || 0) > 0 ? newSecret : null;
}

// ==================== WEBHOOK DELIVERY ====================

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(event: WebhookEvent, payload: any): Promise<void> {
  const db = getPool();

  // Find all active subscriptions for this event
  const result = await db.query(`
    SELECT * FROM webhook_subscriptions
    WHERE is_active = true AND events::text LIKE $1
  `, [`%"${event}"%`]);

  for (const row of result.rows) {
    const subscription = mapWebhookRow(row);
    await queueWebhookDelivery(subscription, event, payload);
  }
}

/**
 * Queue a webhook delivery
 */
async function queueWebhookDelivery(
  subscription: WebhookSubscription,
  event: WebhookEvent,
  payload: any
): Promise<void> {
  const db = getPool();
  const id = generateUUID();
  const formattedPayload = formatPayload(payload, subscription.format, event);

  await db.query(`
    INSERT INTO webhook_deliveries (
      id, subscription_id, event, payload, status, attempts, created_at
    ) VALUES ($1, $2, $3, $4, 'pending', 0, $5)
  `, [id, subscription.id, event, JSON.stringify(formattedPayload), new Date().toISOString()]);

  // Attempt immediate delivery
  await deliverWebhook(id);
}

/**
 * Deliver a webhook
 */
export async function deliverWebhook(deliveryId: string): Promise<boolean> {
  const db = getPool();

  // Get delivery and subscription
  const deliveryResult = await db.query<{
    id: string;
    subscription_id: string;
    event: string;
    payload: string;
    status: string;
    attempts: number;
  }>(`SELECT * FROM webhook_deliveries WHERE id = $1`, [deliveryId]);
  if (deliveryResult.rows.length === 0) return false;

  const delivery = deliveryResult.rows[0];
  const subResult = await db.query(`SELECT * FROM webhook_subscriptions WHERE id = $1`, [delivery.subscription_id]);
  if (subResult.rows.length === 0) return false;

  const subscription = mapWebhookRow(subResult.rows[0]);
  const payload = typeof delivery.payload === 'string' ? JSON.parse(delivery.payload) : delivery.payload;

  // Generate signature
  const signature = generateSignature(JSON.stringify(payload), subscription.secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-QuickRefurbz-Signature': signature,
      'X-QuickRefurbz-Event': delivery.event,
      'X-QuickRefurbz-Delivery': deliveryId,
      ...(subscription.headers || {})
    };

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const responseText = await response.text().catch(() => '');
    const now = new Date().toISOString();

    if (response.ok) {
      // Success
      await db.query(`
        UPDATE webhook_deliveries
        SET status = 'delivered', status_code = $1, response = $2, delivered_at = $3, attempts = attempts + 1
        WHERE id = $4
      `, [response.status, responseText.slice(0, 1000), now, deliveryId]);

      await db.query(`
        UPDATE webhook_subscriptions
        SET last_triggered_at = $1, last_status = $2, retry_count = 0, updated_at = $1
        WHERE id = $3
      `, [now, response.status, subscription.id]);

      return true;
    } else {
      // Failed - schedule retry
      await handleDeliveryFailure(deliveryId, subscription.id, response.status, responseText);
      return false;
    }
  } catch (error: any) {
    await handleDeliveryFailure(deliveryId, subscription.id, 0, error.message);
    return false;
  }
}

/**
 * Handle webhook delivery failure
 */
async function handleDeliveryFailure(
  deliveryId: string,
  subscriptionId: string,
  statusCode: number,
  errorMessage: string
): Promise<void> {
  const db = getPool();
  const now = new Date().toISOString();

  // Get current attempt count
  const result = await db.query<{ attempts: number }>(`SELECT attempts FROM webhook_deliveries WHERE id = $1`, [deliveryId]);
  const attempts = (result.rows[0]?.attempts || 0) + 1;

  if (attempts >= MAX_RETRY_ATTEMPTS) {
    // Max retries reached
    await db.query(`
      UPDATE webhook_deliveries
      SET status = 'failed', status_code = $1, response = $2, attempts = $3
      WHERE id = $4
    `, [statusCode, errorMessage.slice(0, 1000), attempts, deliveryId]);

    // Increment subscription retry count
    await db.query(`
      UPDATE webhook_subscriptions
      SET retry_count = retry_count + 1, last_status = $1, updated_at = $2
      WHERE id = $3
    `, [statusCode, now, subscriptionId]);
  } else {
    // Schedule retry
    const retryDelay = RETRY_DELAYS[attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    const nextRetry = new Date(Date.now() + retryDelay * 1000).toISOString();

    await db.query(`
      UPDATE webhook_deliveries
      SET status = 'pending', status_code = $1, response = $2, attempts = $3, next_retry_at = $4
      WHERE id = $5
    `, [statusCode, errorMessage.slice(0, 1000), attempts, nextRetry, deliveryId]);
  }
}

/**
 * Process pending webhook retries
 */
export async function processWebhookRetries(): Promise<number> {
  const db = getPool();
  const now = new Date().toISOString();

  const result = await db.query<{ id: string }>(`
    SELECT id FROM webhook_deliveries
    WHERE status = 'pending' AND next_retry_at IS NOT NULL AND next_retry_at <= $1
    LIMIT 100
  `, [now]);

  let delivered = 0;
  for (const row of result.rows) {
    if (await deliverWebhook(row.id)) {
      delivered++;
    }
  }

  return delivered;
}

// ==================== DATA FEED ====================

/**
 * Get feed items with filtering
 */
export async function getFeedItems(filters: FeedFilters = {}): Promise<FeedItem[]> {
  const db = getPool();
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Build WHERE conditions
  if (filters.since) {
    conditions.push(`ri.updated_at >= $${paramIndex++}`);
    params.push(filters.since);
  }
  if (filters.until) {
    conditions.push(`ri.updated_at <= $${paramIndex++}`);
    params.push(filters.until);
  }
  if (filters.status) {
    conditions.push(`ri.current_stage = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.grade) {
    conditions.push(`ri.final_grade = $${paramIndex++}`);
    params.push(filters.grade);
  }
  if (filters.category) {
    conditions.push(`ri.category = $${paramIndex++}`);
    params.push(filters.category);
  }
  if (filters.palletId) {
    conditions.push(`ri.pallet_id = $${paramIndex++}`);
    params.push(filters.palletId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT
      ri.*,
      rc.total_cost,
      rc.estimated_value,
      ga.final_grade as assessed_grade,
      dwc.id as cert_id,
      dwc.verification_passed as data_wiped
    FROM refurb_items ri
    LEFT JOIN refurb_costs rc ON ri.qlid = rc.qlid
    LEFT JOIN grading_assessments ga ON ri.qlid = ga.qlid
    LEFT JOIN data_wipe_certificates dwc ON ri.qlid = dwc.qlid
    ${whereClause}
    ORDER BY ri.updated_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  params.push(limit, offset);
  const result = await db.query(query, params);

  const items: FeedItem[] = [];
  for (const row of result.rows) {
    const item = await mapToFeedItem(row, filters.includeImages !== false);
    items.push(item);
  }

  return items;
}

/**
 * Get a single feed item by QLID
 */
export async function getFeedItem(qlid: string): Promise<FeedItem | null> {
  const items = await getFeedItems({ limit: 1 });
  const db = getPool();

  const result = await db.query(`
    SELECT
      ri.*,
      rc.total_cost,
      rc.estimated_value,
      ga.final_grade as assessed_grade,
      dwc.id as cert_id,
      dwc.verification_passed as data_wiped
    FROM refurb_items ri
    LEFT JOIN refurb_costs rc ON ri.qlid = rc.qlid
    LEFT JOIN grading_assessments ga ON ri.qlid = ga.qlid
    LEFT JOIN data_wipe_certificates dwc ON ri.qlid = dwc.qlid
    WHERE ri.qlid = $1
  `, [qlid]);

  if (result.rows.length === 0) return null;
  return mapToFeedItem(result.rows[0], true);
}

/**
 * Get feed in specific format
 */
export async function getFormattedFeed(
  format: FeedFormat,
  filters: FeedFilters = {}
): Promise<{ data: any; contentType: string }> {
  const items = await getFeedItems(filters);

  switch (format) {
    case 'shopify':
      return {
        data: formatForShopify(items),
        contentType: 'application/json'
      };
    case 'ebay':
      return {
        data: formatForEbay(items),
        contentType: 'application/json'
      };
    case 'csv':
      return {
        data: formatAsCSV(items),
        contentType: 'text/csv'
      };
    case 'xml':
      return {
        data: formatAsXML(items),
        contentType: 'application/xml'
      };
    default:
      return {
        data: { items, count: items.length, generatedAt: new Date().toISOString() },
        contentType: 'application/json'
      };
  }
}

/**
 * Get feed statistics
 */
export async function getFeedStats(): Promise<{
  totalItems: number;
  completedItems: number;
  byGrade: Record<string, number>;
  byCategory: Record<string, number>;
  recentUpdates: number;
  webhookSubscriptions: number;
  pendingDeliveries: number;
}> {
  const db = getPool();

  type CountResult = { count: string };
  type GradeCountResult = { final_grade: string; count: string };
  type CategoryCountResult = { category: string; count: string };

  const [totalResult, completedResult, gradeResult, categoryResult, recentResult, webhookResult, deliveryResult] = await Promise.all([
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items`),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items WHERE current_stage = 'COMPLETE'`),
    db.query<GradeCountResult>(`SELECT final_grade, COUNT(*) as count FROM refurb_items WHERE final_grade IS NOT NULL GROUP BY final_grade`),
    db.query<CategoryCountResult>(`SELECT category, COUNT(*) as count FROM refurb_items GROUP BY category`),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM refurb_items WHERE updated_at >= $1`, [
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    ]),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM webhook_subscriptions WHERE is_active = true`),
    db.query<CountResult>(`SELECT COUNT(*) as count FROM webhook_deliveries WHERE status = 'pending'`)
  ]);

  const byGrade: Record<string, number> = {};
  for (const row of gradeResult.rows) {
    byGrade[row.final_grade] = parseInt(row.count);
  }

  const byCategory: Record<string, number> = {};
  for (const row of categoryResult.rows) {
    byCategory[row.category] = parseInt(row.count);
  }

  return {
    totalItems: parseInt(totalResult.rows[0].count),
    completedItems: parseInt(completedResult.rows[0].count),
    byGrade,
    byCategory,
    recentUpdates: parseInt(recentResult.rows[0].count),
    webhookSubscriptions: parseInt(webhookResult.rows[0].count),
    pendingDeliveries: parseInt(deliveryResult.rows[0].count)
  };
}

// ==================== HELPER FUNCTIONS ====================

function mapWebhookRow(row: any): WebhookSubscription {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
    format: row.format,
    isActive: row.is_active,
    headers: row.headers ? (typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers) : undefined,
    retryCount: row.retry_count,
    lastTriggeredAt: row.last_triggered_at,
    lastStatus: row.last_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function mapToFeedItem(row: any, includeImages: boolean): Promise<FeedItem> {
  const grade = row.final_grade || row.assessed_grade || 'C';
  const condition = GRADE_TO_CONDITION[grade] || GRADE_TO_CONDITION['C'];

  let images: string[] = [];
  if (includeImages) {
    const db = getPool();
    const photoResult = await db.query(
      `SELECT storage_path FROM item_photos WHERE qlid = $1 ORDER BY created_at`,
      [row.qlid]
    );
    images = photoResult.rows.map((r: any) => r.storage_path);
  }

  return {
    id: row.id,
    qlid: row.qlid,
    qsku: `RFB-${row.qlid}`,
    title: `${row.manufacturer} ${row.model} - Refurbished Grade ${grade}`,
    description: `${condition.description}. Professionally refurbished ${row.manufacturer} ${row.model}.`,
    manufacturer: row.manufacturer,
    model: row.model,
    category: row.category,
    condition: condition.description,
    grade,
    price: row.estimated_value ? parseFloat(row.estimated_value) : null,
    msrp: null, // Would come from UPC lookup cache
    costBasis: row.total_cost ? parseFloat(row.total_cost) : null,
    quantity: 1,
    upc: row.upc,
    serialNumber: row.serial_number,
    images,
    specifications: {},
    certificationId: row.cert_id,
    warrantyEligible: ['A', 'B', 'C'].includes(grade),
    dataWiped: row.data_wiped === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function generateSignature(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function formatPayload(payload: any, format: FeedFormat, event: WebhookEvent): any {
  const base = {
    event,
    timestamp: new Date().toISOString(),
    data: payload
  };

  switch (format) {
    case 'shopify':
      return {
        ...base,
        data: payload.qlid ? formatItemForShopify(payload) : payload
      };
    case 'ebay':
      return {
        ...base,
        data: payload.qlid ? formatItemForEbay(payload) : payload
      };
    default:
      return base;
  }
}

function formatItemForShopify(item: FeedItem | any): any {
  const grade = item.grade || item.final_grade || 'C';
  const condition = GRADE_TO_CONDITION[grade] || GRADE_TO_CONDITION['C'];

  return {
    title: item.title || `${item.manufacturer} ${item.model} - Refurbished`,
    body_html: `<p>${item.description || condition.description}</p>`,
    vendor: item.manufacturer,
    product_type: item.category,
    tags: [
      `grade-${grade}`,
      'refurbished',
      item.warrantyEligible ? 'warranty' : 'no-warranty',
      item.dataWiped ? 'data-wiped' : ''
    ].filter(Boolean).join(', '),
    variants: [{
      sku: item.qsku || `RFB-${item.qlid}`,
      price: item.price?.toString() || '0',
      inventory_quantity: item.quantity || 1,
      barcode: item.upc || '',
      requires_shipping: true,
      taxable: true
    }],
    images: (item.images || []).map((url: string) => ({ src: url })),
    metafields: [
      { namespace: 'quickrefurbz', key: 'qlid', value: item.qlid, type: 'single_line_text_field' },
      { namespace: 'quickrefurbz', key: 'grade', value: grade, type: 'single_line_text_field' },
      { namespace: 'quickrefurbz', key: 'serial_number', value: item.serialNumber || '', type: 'single_line_text_field' },
      { namespace: 'quickrefurbz', key: 'certification_id', value: item.certificationId || '', type: 'single_line_text_field' }
    ]
  };
}

function formatItemForEbay(item: FeedItem | any): any {
  const grade = item.grade || item.final_grade || 'C';
  const condition = GRADE_TO_CONDITION[grade] || GRADE_TO_CONDITION['C'];

  return {
    Title: (item.title || `${item.manufacturer} ${item.model} - Refurbished`).slice(0, 80),
    Description: item.description || condition.description,
    PrimaryCategory: { CategoryID: getCategoryMapping(item.category) },
    ConditionID: condition.ebay,
    ConditionDescription: condition.description,
    SKU: item.qsku || `RFB-${item.qlid}`,
    Quantity: item.quantity || 1,
    StartPrice: item.price || 0,
    ProductListingDetails: {
      UPC: item.upc || 'Does not apply',
      BrandMPN: {
        Brand: item.manufacturer,
        MPN: item.model
      }
    },
    PictureDetails: {
      PictureURL: item.images || []
    },
    ItemSpecifics: {
      NameValueList: [
        { Name: 'Brand', Value: item.manufacturer },
        { Name: 'Model', Value: item.model },
        { Name: 'Condition', Value: `Grade ${grade} - ${condition.description}` }
      ]
    }
  };
}

function formatForShopify(items: FeedItem[]): any {
  return {
    products: items.map(formatItemForShopify)
  };
}

function formatForEbay(items: FeedItem[]): any {
  return {
    items: items.map(formatItemForEbay)
  };
}

function formatAsCSV(items: FeedItem[]): string {
  const headers = [
    'QLID', 'QSKU', 'Title', 'Manufacturer', 'Model', 'Category', 'Grade',
    'Condition', 'Price', 'MSRP', 'Cost', 'Quantity', 'UPC', 'Serial Number',
    'Warranty Eligible', 'Data Wiped', 'Certification ID', 'Created At', 'Completed At'
  ];

  const rows = items.map(item => [
    item.qlid,
    item.qsku,
    `"${item.title.replace(/"/g, '""')}"`,
    item.manufacturer,
    item.model,
    item.category,
    item.grade,
    `"${item.condition}"`,
    item.price || '',
    item.msrp || '',
    item.costBasis || '',
    item.quantity,
    item.upc || '',
    item.serialNumber || '',
    item.warrantyEligible ? 'Yes' : 'No',
    item.dataWiped ? 'Yes' : 'No',
    item.certificationId || '',
    item.createdAt,
    item.completedAt || ''
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function formatAsXML(items: FeedItem[]): string {
  const itemsXml = items.map(item => `
    <item>
      <qlid>${item.qlid}</qlid>
      <qsku>${item.qsku}</qsku>
      <title><![CDATA[${item.title}]]></title>
      <manufacturer>${item.manufacturer}</manufacturer>
      <model>${item.model}</model>
      <category>${item.category}</category>
      <grade>${item.grade}</grade>
      <condition><![CDATA[${item.condition}]]></condition>
      <price>${item.price || 0}</price>
      <quantity>${item.quantity}</quantity>
      <upc>${item.upc || ''}</upc>
      <serial_number>${item.serialNumber || ''}</serial_number>
      <warranty_eligible>${item.warrantyEligible}</warranty_eligible>
      <data_wiped>${item.dataWiped}</data_wiped>
      <certification_id>${item.certificationId || ''}</certification_id>
      <images>${item.images.map(img => `<image>${img}</image>`).join('')}</images>
      <created_at>${item.createdAt}</created_at>
      <completed_at>${item.completedAt || ''}</completed_at>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed>
  <generated_at>${new Date().toISOString()}</generated_at>
  <count>${items.length}</count>
  <items>${itemsXml}</items>
</feed>`;
}

function getCategoryMapping(category: string): string {
  // eBay category mappings (simplified)
  const mappings: Record<string, string> = {
    'PHONE': '9355',
    'TABLET': '171485',
    'LAPTOP': '177',
    'DESKTOP': '179',
    'TV': '11071',
    'MONITOR': '80053',
    'AUDIO': '14969',
    'GAMING': '139971',
    'WEARABLE': '178893',
    'APPLIANCE': '20715',
    'OTHER': '175673'
  };
  return mappings[category] || mappings['OTHER'];
}

// ==================== EVENT TRIGGERS ====================

/**
 * Notify feed when an item is created
 */
export async function notifyItemCreated(item: any): Promise<void> {
  await triggerWebhooks('item.created', item);
}

/**
 * Notify feed when an item is updated
 */
export async function notifyItemUpdated(item: any): Promise<void> {
  await triggerWebhooks('item.updated', item);
}

/**
 * Notify feed when an item is completed
 */
export async function notifyItemCompleted(item: any): Promise<void> {
  const feedItem = await getFeedItem(item.qlid);
  if (feedItem) {
    await triggerWebhooks('item.completed', feedItem);
  }
}

/**
 * Notify feed when an item is graded
 */
export async function notifyItemGraded(qlid: string, grade: string): Promise<void> {
  const feedItem = await getFeedItem(qlid);
  if (feedItem) {
    await triggerWebhooks('item.graded', { ...feedItem, grade });
  }
}

/**
 * Notify feed when an item is certified (data wipe)
 */
export async function notifyItemCertified(qlid: string, certificationId: string): Promise<void> {
  const feedItem = await getFeedItem(qlid);
  if (feedItem) {
    await triggerWebhooks('item.certified', { ...feedItem, certificationId });
  }
}
