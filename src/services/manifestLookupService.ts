// Cascading lookup order:
// 1. Sourcing DB: tl_line_items (manifest data from Tech Liquidators)
// 2. Sourcing DB: bestbuy_products (Best Buy product catalog)
// 3. Local: upc_lookup_cache (if exists in local quickwms DB)
// 4. Return partial/null if nothing found

import { getSourcingPool, isSourcingConfigured } from './sourcingDb.js';
import * as sourcingLookup from './sourcingLookup.js';
import { getPool } from '../database.js';

export interface ProductLookupResult {
  found: boolean;
  source: 'manifest' | 'bestbuy' | 'upc_cache' | 'none';
  brand?: string;
  model?: string;
  category?: string;
  msrp?: number;
  unitCogs?: number;
  upc?: string;
  title?: string;
  condition?: string;
  confidence: number; // 0-100
}

export async function lookupByBarcode(barcode: string): Promise<ProductLookupResult> {
  // Try sourcing DB first (if configured)
  if (isSourcingConfigured()) {
    // 1. Try bestbuy_products by UPC
    try {
      const product = await sourcingLookup.lookupProductByUpc(barcode);
      if (product) {
        return {
          found: true,
          source: 'bestbuy',
          brand: product.brand ?? undefined,
          model: (product.modelNumber || product.name) ?? undefined,
          category: deriveCategoryFromPath(product.categoryPath ?? undefined),
          msrp: product.regularPrice ?? undefined,
          upc: product.upc ?? undefined,
          title: product.name ?? undefined,
          confidence: 95,
        };
      }
    } catch { /* continue to next source */ }
  }

  // 2. Try local UPC cache
  try {
    const db = getPool();
    const result = await db.query(
      'SELECT * FROM upc_lookup_cache WHERE upc = $1 LIMIT 1',
      [barcode]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0] as Record<string, any>;
      return {
        found: true,
        source: 'upc_cache',
        brand: row.brand as string | undefined,
        model: row.model as string | undefined,
        category: row.category as string | undefined,
        msrp: row.msrp ? parseFloat(String(row.msrp)) : undefined,
        upc: barcode,
        title: (row.title || row.name) as string | undefined,
        confidence: 80,
      };
    }
  } catch { /* table might not exist, continue */ }

  return { found: false, source: 'none', confidence: 0 };
}

export async function searchProducts(query: string): Promise<ProductLookupResult[]> {
  const results: ProductLookupResult[] = [];

  if (isSourcingConfigured()) {
    try {
      const products = await sourcingLookup.lookupProductBySearch(query);
      for (const p of products) {
        results.push({
          found: true,
          source: 'bestbuy',
          brand: p.brand ?? undefined,
          model: (p.modelNumber || p.name) ?? undefined,
          category: deriveCategoryFromPath(p.categoryPath ?? undefined),
          msrp: p.regularPrice ?? undefined,
          upc: p.upc ?? undefined,
          title: p.name ?? undefined,
          confidence: 85,
        });
      }
    } catch { /* continue */ }
  }

  return results;
}

// Helper to map Best Buy category paths to our ProductCategory enum
function deriveCategoryFromPath(categoryPath?: string): string {
  if (!categoryPath) return 'OTHER';
  const path = categoryPath.toLowerCase();
  if (path.includes('phone') || path.includes('cell')) return 'PHONE';
  if (path.includes('tablet') || path.includes('ipad')) return 'TABLET';
  if (path.includes('laptop') || path.includes('notebook') || path.includes('chromebook')) return 'LAPTOP';
  if (path.includes('desktop') || path.includes('all-in-one')) return 'DESKTOP';
  if (path.includes('tv') || path.includes('television')) return 'TV';
  if (path.includes('monitor')) return 'MONITOR';
  if (path.includes('audio') || path.includes('speaker') || path.includes('headphone')) return 'AUDIO';
  if (path.includes('gaming') || path.includes('console') || path.includes('playstation') || path.includes('xbox')) return 'GAMING';
  if (path.includes('vacuum') || path.includes('roomba')) return 'VACUUM';
  if (path.includes('wearable') || path.includes('watch') || path.includes('fitness')) return 'WEARABLE';
  if (path.includes('appliance')) {
    if (path.includes('large') || path.includes('refrigerator') || path.includes('washer') || path.includes('dryer')) return 'APPLIANCE_LARGE';
    return 'APPLIANCE_SMALL';
  }
  return 'OTHER';
}
