/**
 * UPC Lookup Service
 * Looks up product information from UPC barcodes using Rainforest API
 * with local caching for performance
 */

import { getPool, generateUUID } from '../database.js';

// ==================== TYPES ====================

export interface UPCLookupResult {
  upc: string;
  brand: string | null;
  model: string | null;
  title: string | null;
  category: string | null;
  msrp: number | null;
  imageUrl: string | null;
  provider: 'rainforest' | 'cache' | 'manual';
  cached: boolean;
}

export interface ManualUPCEntry {
  upc: string;
  brand?: string;
  model?: string;
  title?: string;
  category?: string;
  msrp?: number;
  imageUrl?: string;
}

// ==================== CONFIGURATION ====================

const RAINFOREST_API_KEY = process.env.RAINFOREST_API_KEY || '';
const UPC_CACHE_TTL_MS = parseInt(process.env.UPC_CACHE_TTL || '86400000'); // 24 hours default
const RAINFOREST_BASE_URL = 'https://api.rainforestapi.com/request';

// ==================== CACHE OPERATIONS ====================

/**
 * Get cached UPC data
 */
async function getCachedUPC(upc: string): Promise<UPCLookupResult | null> {
  const db = getPool();
  const result = await db.query<{
    upc: string;
    brand: string | null;
    model: string | null;
    title: string | null;
    category: string | null;
    msrp: number | null;
    image_url: string | null;
    provider: string;
    expires_at: string | null;
  }>(`
    SELECT * FROM upc_lookup_cache WHERE upc = $1
  `, [upc]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // Check if expired
  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at);
    if (expiresAt < new Date()) {
      // Expired, delete and return null
      await db.query(`DELETE FROM upc_lookup_cache WHERE upc = $1`, [upc]);
      return null;
    }
  }

  return {
    upc: row.upc,
    brand: row.brand,
    model: row.model,
    title: row.title,
    category: row.category,
    msrp: row.msrp,
    imageUrl: row.image_url,
    provider: row.provider as 'rainforest' | 'cache' | 'manual',
    cached: true
  };
}

/**
 * Cache UPC lookup result
 */
async function cacheUPCResult(data: UPCLookupResult, rawResponse?: string): Promise<void> {
  const db = getPool();
  const id = generateUUID();
  const expiresAt = new Date(Date.now() + UPC_CACHE_TTL_MS).toISOString();

  await db.query(`
    INSERT INTO upc_lookup_cache (id, upc, brand, model, title, category, msrp, image_url, provider, raw_response, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (upc) DO UPDATE SET
      brand = EXCLUDED.brand,
      model = EXCLUDED.model,
      title = EXCLUDED.title,
      category = EXCLUDED.category,
      msrp = EXCLUDED.msrp,
      image_url = EXCLUDED.image_url,
      provider = EXCLUDED.provider,
      raw_response = EXCLUDED.raw_response,
      expires_at = EXCLUDED.expires_at,
      cached_at = CURRENT_TIMESTAMP
  `, [
    id,
    data.upc,
    data.brand,
    data.model,
    data.title,
    data.category,
    data.msrp,
    data.imageUrl,
    data.provider,
    rawResponse || null,
    expiresAt
  ]);
}

// ==================== RAINFOREST API ====================

/**
 * Look up UPC using Rainforest API
 */
async function lookupRainforest(upc: string): Promise<UPCLookupResult | null> {
  if (!RAINFOREST_API_KEY) {
    console.warn('RAINFOREST_API_KEY not configured, skipping API lookup');
    return null;
  }

  try {
    const params = new URLSearchParams({
      api_key: RAINFOREST_API_KEY,
      type: 'product',
      amazon_domain: 'amazon.com',
      gtin: upc
    });

    const response = await fetch(`${RAINFOREST_BASE_URL}?${params}`);

    if (!response.ok) {
      console.error(`Rainforest API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.product) {
      return null;
    }

    const product = data.product;

    // Extract brand and model from title if not explicitly provided
    let brand = product.brand || null;
    let model = product.model_number || null;
    const title = product.title || null;

    // Try to extract brand from title if not provided
    if (!brand && title) {
      const commonBrands = ['Apple', 'Samsung', 'Sony', 'LG', 'Microsoft', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Google', 'Nintendo', 'Bose', 'JBL'];
      for (const b of commonBrands) {
        if (title.toLowerCase().includes(b.toLowerCase())) {
          brand = b;
          break;
        }
      }
    }

    // Determine category from Amazon category
    let category: string | null = null;
    if (product.categories && product.categories.length > 0) {
      const catName = product.categories[0].name?.toLowerCase() || '';
      if (catName.includes('phone') || catName.includes('cell')) category = 'PHONE';
      else if (catName.includes('tablet')) category = 'TABLET';
      else if (catName.includes('laptop') || catName.includes('notebook')) category = 'LAPTOP';
      else if (catName.includes('desktop') || catName.includes('computer')) category = 'DESKTOP';
      else if (catName.includes('tv') || catName.includes('television')) category = 'TV';
      else if (catName.includes('monitor')) category = 'MONITOR';
      else if (catName.includes('audio') || catName.includes('speaker') || catName.includes('headphone')) category = 'AUDIO';
      else if (catName.includes('game') || catName.includes('console')) category = 'GAMING';
      else if (catName.includes('watch') || catName.includes('wearable')) category = 'WEARABLE';
      else if (catName.includes('appliance')) category = 'APPLIANCE';
    }

    const result: UPCLookupResult = {
      upc,
      brand,
      model,
      title,
      category,
      msrp: product.buybox_winner?.price?.value || null,
      imageUrl: product.main_image?.link || null,
      provider: 'rainforest',
      cached: false
    };

    // Cache the result
    await cacheUPCResult(result, JSON.stringify(data));

    return result;
  } catch (error) {
    console.error('Rainforest API lookup error:', error);
    return null;
  }
}

// ==================== PUBLIC API ====================

/**
 * Look up product information by UPC
 * Checks cache first, then falls back to Rainforest API
 */
export async function lookupUPC(upc: string): Promise<UPCLookupResult | null> {
  // Normalize UPC (remove any spaces or dashes)
  const normalizedUPC = upc.replace(/[\s-]/g, '');

  // Check cache first
  const cached = await getCachedUPC(normalizedUPC);
  if (cached) {
    return cached;
  }

  // Try Rainforest API
  const apiResult = await lookupRainforest(normalizedUPC);
  if (apiResult) {
    return apiResult;
  }

  return null;
}

/**
 * Manually add UPC data to cache
 */
export async function addManualUPC(entry: ManualUPCEntry): Promise<UPCLookupResult> {
  const result: UPCLookupResult = {
    upc: entry.upc.replace(/[\s-]/g, ''),
    brand: entry.brand || null,
    model: entry.model || null,
    title: entry.title || null,
    category: entry.category || null,
    msrp: entry.msrp || null,
    imageUrl: entry.imageUrl || null,
    provider: 'manual',
    cached: false
  };

  await cacheUPCResult(result);

  return { ...result, cached: true };
}

/**
 * Search cached UPCs
 */
export async function searchCachedUPCs(query: string, limit = 20): Promise<UPCLookupResult[]> {
  const db = getPool();
  const searchTerm = `%${query}%`;

  const result = await db.query<{
    upc: string;
    brand: string | null;
    model: string | null;
    title: string | null;
    category: string | null;
    msrp: number | null;
    image_url: string | null;
    provider: string;
  }>(`
    SELECT * FROM upc_lookup_cache
    WHERE upc LIKE $1 OR brand LIKE $1 OR model LIKE $1 OR title LIKE $1
    ORDER BY cached_at DESC
    LIMIT $2
  `, [searchTerm, limit]);

  return result.rows.map(row => ({
    upc: row.upc,
    brand: row.brand,
    model: row.model,
    title: row.title,
    category: row.category,
    msrp: row.msrp,
    imageUrl: row.image_url,
    provider: row.provider as 'rainforest' | 'cache' | 'manual',
    cached: true
  }));
}

/**
 * Get UPC cache stats
 */
export async function getUPCCacheStats(): Promise<{
  total: number;
  byProvider: Record<string, number>;
}> {
  const db = getPool();

  const totalResult = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM upc_lookup_cache`);
  const providerResult = await db.query<{ provider: string; count: string }>(`
    SELECT provider, COUNT(*) as count FROM upc_lookup_cache GROUP BY provider
  `);

  const byProvider: Record<string, number> = {};
  for (const row of providerResult.rows) {
    byProvider[row.provider] = parseInt(row.count);
  }

  return {
    total: parseInt(totalResult.rows[0].count),
    byProvider
  };
}
