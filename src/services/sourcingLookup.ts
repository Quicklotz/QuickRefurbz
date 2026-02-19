/**
 * Sourcing Lookup Service
 * Query functions for looking up pallets, orders, line items, and products
 * from the remote upscaled_cogs sourcing database.
 *
 * All queries are read-only. The sourcing pool is obtained from sourcingDb.ts.
 */

import { getSourcingPool } from './sourcingDb.js';

// ==================== TYPES ====================

export interface SourcingPallet {
  id: number;
  palletId: string;
  orderId: string;
  estimatedItems: number | null;
  estimatedCogs: number | null;
  updBbyId: string | null;
  createdAt: string;
  /** Joined from tl_orders */
  manifestUrl: string | null;
  /** Joined from tl_orders */
  orderDate: string | null;
}

export interface SourcingOrder {
  id: number;
  orderId: string;
  manifestUrl: string | null;
  orderDate: string | null;
  totalCost: number | null;
  status: string | null;
  createdAt: string;
}

export interface SourcingLineItem {
  id: number;
  orderId: string;
  palletId: string;
  title: string | null;
  brand: string | null;
  condition: string | null;
  quantity: number | null;
  unitPrice: number | null;
}

export interface BestBuyProduct {
  sku: string;
  upc: string | null;
  name: string | null;
  brand: string | null;
  modelNumber: string | null;
  regularPrice: number | null;
  categoryPath: string | null;
}

export type Retailer = 'BESTBUY' | 'OTHER';

// ==================== PALLET LOOKUPS ====================

/**
 * Look up a single pallet by its pallet_id (e.g. PTRF88569).
 * Case-insensitive match. Joins with tl_orders for manifest_url and order_date.
 * Returns null if not found.
 */
export async function lookupPalletById(palletId: string): Promise<SourcingPallet | null> {
  const pool = getSourcingPool();

  const result = await pool.query<{
    id: number;
    pallet_id: string;
    order_id: string;
    estimated_items: number | null;
    estimated_cogs: number | null;
    upd_bby_id: string | null;
    created_at: string;
    manifest_url: string | null;
    order_date: string | null;
  }>(
    `SELECT p.id, p.pallet_id, p.order_id, p.estimated_items, p.estimated_cogs,
            p.upd_bby_id, p.created_at,
            o.manifest_url, o.order_date
     FROM tl_pallets p
     LEFT JOIN tl_orders o ON o.order_id = p.order_id
     WHERE UPPER(p.pallet_id) = UPPER($1)
     LIMIT 1`,
    [palletId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return mapPalletRow(row);
}

/**
 * Look up all pallets belonging to an order_id (e.g. ZTGKEW3QCH).
 * Returns an array (may be empty).
 */
export async function lookupPalletsByOrderId(orderId: string): Promise<SourcingPallet[]> {
  const pool = getSourcingPool();

  const result = await pool.query<{
    id: number;
    pallet_id: string;
    order_id: string;
    estimated_items: number | null;
    estimated_cogs: number | null;
    upd_bby_id: string | null;
    created_at: string;
    manifest_url: string | null;
    order_date: string | null;
  }>(
    `SELECT p.id, p.pallet_id, p.order_id, p.estimated_items, p.estimated_cogs,
            p.upd_bby_id, p.created_at,
            o.manifest_url, o.order_date
     FROM tl_pallets p
     LEFT JOIN tl_orders o ON o.order_id = p.order_id
     WHERE UPPER(p.order_id) = UPPER($1)
     ORDER BY p.created_at`,
    [orderId]
  );

  return result.rows.map(mapPalletRow);
}

// ==================== LINE ITEM LOOKUPS ====================

/**
 * Get all line items for a given pallet_id.
 * Returns an array (may be empty).
 */
export async function lookupLineItems(palletId: string): Promise<SourcingLineItem[]> {
  const pool = getSourcingPool();

  // tl_line_items doesn't have pallet_id directly — join via tl_pallets
  const result = await pool.query<{
    id: number;
    order_id: string;
    pallet_id: string;
    title: string | null;
    brands: string | null;
    condition: string | null;
    item_count: number | null;
    lot_price: number | null;
  }>(
    `SELECT li.id, li.order_id, p.pallet_id,
            li.title, li.brands, li.condition, li.item_count, li.lot_price
     FROM tl_line_items li
     JOIN tl_pallets p ON p.line_item_id = li.id
     WHERE UPPER(p.pallet_id) = UPPER($1)
     ORDER BY li.id`,
    [palletId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    palletId: row.pallet_id,
    title: row.title,
    brand: row.brands,
    condition: row.condition,
    quantity: row.item_count,
    unitPrice: row.lot_price,
  }));
}

// ==================== PRODUCT LOOKUPS ====================

/**
 * Look up a BestBuy product by UPC barcode.
 * Returns null if not found.
 */
export async function lookupProductByUpc(upc: string): Promise<BestBuyProduct | null> {
  const pool = getSourcingPool();

  const result = await pool.query<{
    sku: string;
    upc: string | null;
    name: string | null;
    brand: string | null;
    model_number: string | null;
    regular_price: number | null;
    category_path: string | null;
  }>(
    `SELECT sku, upc, name, brand, model_number, regular_price, category_path
     FROM bestbuy_products
     WHERE upc = $1
     LIMIT 1`,
    [upc]
  );

  if (result.rows.length === 0) return null;

  return mapProductRow(result.rows[0]);
}

/**
 * Full-text search against bestbuy_products by name and brand.
 * Returns top 10 matches ordered by relevance.
 * Falls back to ILIKE if the query contains no tsquery-valid tokens.
 */
export async function lookupProductBySearch(query: string): Promise<BestBuyProduct[]> {
  const pool = getSourcingPool();

  // Sanitize and prepare search terms for ts_query
  const sanitized = query.replace(/[^\w\s-]/g, '').trim();
  if (!sanitized) return [];

  const tsTerms = sanitized.split(/\s+/).filter(Boolean).map((t) => `${t}:*`).join(' & ');

  try {
    // Try full-text search first (requires a tsvector or will use to_tsvector on the fly)
    const result = await pool.query<{
      sku: string;
      upc: string | null;
      name: string | null;
      brand: string | null;
      model_number: string | null;
      regular_price: number | null;
      category_path: string | null;
    }>(
      `SELECT sku, upc, name, brand, model_number, regular_price, category_path
       FROM bestbuy_products
       WHERE to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(brand, ''))
             @@ to_tsquery('english', $1)
       ORDER BY ts_rank(
         to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(brand, '')),
         to_tsquery('english', $1)
       ) DESC
       LIMIT 10`,
      [tsTerms]
    );

    if (result.rows.length > 0) {
      return result.rows.map(mapProductRow);
    }
  } catch {
    // ts_query can fail on certain input; fall through to ILIKE
  }

  // Fallback: ILIKE search
  const likePattern = `%${sanitized}%`;
  const fallback = await pool.query<{
    sku: string;
    upc: string | null;
    name: string | null;
    brand: string | null;
    model_number: string | null;
    regular_price: number | null;
    category_path: string | null;
  }>(
    `SELECT sku, upc, name, brand, model_number, regular_price, category_path
     FROM bestbuy_products
     WHERE name ILIKE $1 OR brand ILIKE $1
     ORDER BY regular_price DESC NULLS LAST
     LIMIT 10`,
    [likePattern]
  );

  return fallback.rows.map(mapProductRow);
}

// ==================== RETAILER DERIVATION ====================

/**
 * Derive the retailer from a pallet record.
 * If the pallet has a upd_bby_id (BestBuy update ID), it came from BestBuy.
 * Otherwise we classify it as OTHER.
 */
export function deriveRetailer(pallet: Pick<SourcingPallet, 'updBbyId'> | { upd_bby_id?: string | null }): Retailer {
  // Support both camelCase (SourcingPallet) and snake_case (raw DB row) shapes
  const bbyId = 'updBbyId' in pallet ? pallet.updBbyId : (pallet as { upd_bby_id?: string | null }).upd_bby_id;
  return bbyId ? 'BESTBUY' : 'OTHER';
}

// ==================== INTERNAL HELPERS ====================

function mapPalletRow(row: {
  id: number;
  pallet_id: string;
  order_id: string;
  estimated_items: number | null;
  estimated_cogs: number | null;
  upd_bby_id: string | null;
  created_at: string;
  manifest_url: string | null;
  order_date: string | null;
}): SourcingPallet {
  return {
    id: row.id,
    palletId: row.pallet_id,
    orderId: row.order_id,
    estimatedItems: row.estimated_items,
    estimatedCogs: row.estimated_cogs,
    updBbyId: row.upd_bby_id,
    createdAt: row.created_at,
    manifestUrl: row.manifest_url,
    orderDate: row.order_date,
  };
}

function mapProductRow(row: {
  sku: string;
  upc: string | null;
  name: string | null;
  brand: string | null;
  model_number: string | null;
  regular_price: number | null;
  category_path: string | null;
}): BestBuyProduct {
  return {
    sku: row.sku,
    upc: row.upc,
    name: row.name,
    brand: row.brand,
    modelNumber: row.model_number,
    regularPrice: row.regular_price,
    categoryPath: row.category_path,
  };
}
