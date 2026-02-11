/**
 * Rainforest API client (Amazon product data)
 * Docs: https://www.rainforestapi.com
 */

export type RainforestSource = 'product' | 'search';

export interface RainforestClientConfig {
  apiKey?: string;
  baseUrl?: string;
  amazonDomain?: string;
  timeoutMs?: number;
}

export interface RainforestProductData {
  source: RainforestSource;
  asin?: string;
  gtin?: string;
  title?: string;
  brand?: string;
  model?: string;
  description?: string;
  featureBullets?: string[];
  images?: string[];
  mainImage?: string;
  msrp?: number;
  raw?: unknown;
}

export interface RainforestLookupOptions {
  asin?: string;
  gtin?: string;
  searchTerm?: string;
  manufacturer?: string;
  model?: string;
}

const DEFAULT_BASE_URL = 'https://api.rainforestapi.com/request';
const DEFAULT_AMAZON_DOMAIN = 'amazon.com';
const DEFAULT_TIMEOUT_MS = 8000;

function getConfig(config?: RainforestClientConfig): Required<RainforestClientConfig> {
  return {
    apiKey: config?.apiKey || process.env.RAINFOREST_API_KEY || '',
    baseUrl: config?.baseUrl || process.env.RAINFOREST_API_BASE_URL || DEFAULT_BASE_URL,
    amazonDomain: config?.amazonDomain || process.env.RAINFOREST_AMAZON_DOMAIN || DEFAULT_AMAZON_DOMAIN,
    timeoutMs: config?.timeoutMs || DEFAULT_TIMEOUT_MS,
  };
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function dedupeUrls(urls: Array<string | undefined | null>): string[] {
  const set = new Set<string>();
  for (const url of urls) {
    if (url && typeof url === 'string') set.add(url);
  }
  return [...set];
}

function extractImages(product: any): { mainImage?: string; images?: string[] } {
  const mainImage =
    product?.main_image?.link ||
    product?.main_image?.url ||
    product?.main_image ||
    product?.image ||
    undefined;

  const imageList = Array.isArray(product?.images)
    ? product.images
    : Array.isArray(product?.image_urls)
      ? product.image_urls
      : Array.isArray(product?.image_gallery)
        ? product.image_gallery
        : [];

  const images = dedupeUrls(
    imageList.map((img: any) => img?.link || img?.url || img)
  );

  return { mainImage, images: images.length > 0 ? images : undefined };
}

function normalizeProductResponse(payload: any, gtin?: string, asin?: string): RainforestProductData | null {
  const product = payload?.product || payload?.product_details || payload?.data?.product || payload?.data;
  if (!product) return null;

  const { mainImage, images } = extractImages(product);
  const featureBullets = Array.isArray(product?.feature_bullets)
    ? product.feature_bullets
    : Array.isArray(product?.feature_bullets_flat)
      ? product.feature_bullets_flat
      : undefined;

  return {
    source: 'product',
    asin: asin || product?.asin,
    gtin: gtin || product?.gtin || product?.upc || product?.ean,
    title: product?.title || product?.name,
    brand: product?.brand || product?.manufacturer,
    model: product?.model || product?.model_number || product?.model_name,
    description: product?.description || product?.overview || product?.product_description,
    featureBullets,
    images,
    mainImage,
    msrp: parseNumber(product?.msrp || product?.list_price || product?.price?.value),
    raw: payload,
  };
}

function normalizeSearchResponse(payload: any, searchTerm?: string): RainforestProductData | null {
  const results =
    payload?.search_results ||
    payload?.search_result ||
    payload?.results ||
    payload?.data?.search_results ||
    payload?.data?.results ||
    [];

  if (!Array.isArray(results) || results.length === 0) return null;

  const top = results[0];
  const { mainImage, images } = extractImages(top);
  const title = top?.title || top?.name;

  return {
    source: 'search',
    asin: top?.asin,
    gtin: top?.gtin || top?.upc || top?.ean,
    title: title || searchTerm,
    brand: top?.brand || top?.manufacturer,
    model: top?.model || top?.model_number,
    description: top?.description,
    featureBullets: Array.isArray(top?.feature_bullets) ? top.feature_bullets : undefined,
    images,
    mainImage,
    msrp: parseNumber(top?.msrp || top?.price?.value || top?.price),
    raw: payload,
  };
}

async function requestRainforest(
  params: Record<string, string | undefined>,
  config: Required<RainforestClientConfig>
): Promise<any | null> {
  if (!config.apiKey) return null;

  const url = new URL(config.baseUrl);
  const searchParams = new URLSearchParams();
  searchParams.set('api_key', config.apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  url.search = searchParams.toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupRainforestProduct(
  options: RainforestLookupOptions,
  config?: RainforestClientConfig
): Promise<RainforestProductData | null> {
  const resolved = getConfig(config);
  if (!resolved.apiKey) return null;

  if (options.asin) {
    const payload = await requestRainforest(
      {
        type: 'product',
        amazon_domain: resolved.amazonDomain,
        asin: options.asin,
      },
      resolved
    );
    const normalized = normalizeProductResponse(payload, undefined, options.asin);
    if (normalized) return normalized;
  }

  if (options.gtin) {
    const payload = await requestRainforest(
      {
        type: 'product',
        amazon_domain: resolved.amazonDomain,
        gtin: options.gtin,
      },
      resolved
    );
    const normalized = normalizeProductResponse(payload, options.gtin, undefined);
    if (normalized) return normalized;
  }

  const searchTerm =
    options.searchTerm ||
    [options.manufacturer, options.model].filter(Boolean).join(' ').trim();

  if (searchTerm) {
    const payload = await requestRainforest(
      {
        type: 'search',
        amazon_domain: resolved.amazonDomain,
        query: searchTerm,
      },
      resolved
    );
    const normalized = normalizeSearchResponse(payload, searchTerm);
    if (normalized) return normalized;
  }

  return null;
}
