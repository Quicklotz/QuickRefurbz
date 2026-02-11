import { z } from 'zod';

/**
 * Common validation schemas
 */

// ID schemas
export const idSchema = z.string().uuid('Invalid ID format');
export const numericIdSchema = z.coerce.number().int().positive('ID must be a positive integer');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Cursor pagination schemas
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['next', 'prev']).default('next'),
});

// Sort schemas
export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema,
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  { message: 'Start date must be before end date' }
);

// Email schema
export const emailSchema = z.string().email('Invalid email address');

// Phone schema (basic international format)
export const phoneSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format'
);

// Password schema (minimum requirements)
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// URL schema
export const urlSchema = z.string().url('Invalid URL format');

// SKU schema (alphanumeric with dashes)
export const skuSchema = z.string().regex(
  /^[A-Za-z0-9-]+$/,
  'SKU must contain only letters, numbers, and dashes'
);

// UPC/EAN/GTIN schema
export const barcodeSchema = z.string().regex(
  /^\d{8,14}$/,
  'Barcode must be 8-14 digits'
);

// Currency amount schema (2 decimal places)
export const currencySchema = z.number()
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')
  .nonnegative('Amount cannot be negative');

// Percentage schema (0-100)
export const percentageSchema = z.number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must be at most 100');

// Quantity schema
export const quantitySchema = z.number()
  .int('Quantity must be a whole number')
  .nonnegative('Quantity cannot be negative');

// Search query schema
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500).optional(),
  ...paginationSchema.shape,
});

// Address schema
export const addressSchema = z.object({
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2, 'Country must be a 2-letter ISO code'),
});

// Coordinate schema (for geolocation)
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Create a schema for filtering by enum values
 */
export function enumFilterSchema<T extends string>(values: readonly T[]) {
  return z.enum(values as [T, ...T[]]).optional();
}

/**
 * Create a schema for array of enum values
 */
export function enumArrayFilterSchema<T extends string>(values: readonly T[]) {
  return z.array(z.enum(values as [T, ...T[]])).optional();
}

/**
 * Create a partial schema from an object schema (all fields optional)
 */
export function partialSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Create an update schema (id required, rest optional)
 */
export function updateSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial().extend({
    id: idSchema,
  });
}

/**
 * Validate data against a schema and return typed result
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const key = path || '_root';

    if (!formatted[key]) {
      formatted[key] = [];
    }

    formatted[key].push(issue.message);
  }

  return formatted;
}

/**
 * Common entity schemas
 */

// Timestamp fields for entities
export const timestampSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Base entity with ID and timestamps
export const baseEntitySchema = z.object({
  id: idSchema,
}).merge(timestampSchema);

// Soft delete fields
export const softDeleteSchema = z.object({
  deletedAt: z.coerce.date().nullable(),
  isDeleted: z.boolean().default(false),
});

/**
 * Inventory-specific schemas
 */

// Product condition
export const conditionSchema = z.enum([
  'new',
  'like_new',
  'good',
  'fair',
  'poor',
  'for_parts',
]);

// Inventory status
export const inventoryStatusSchema = z.enum([
  'received',
  'processing',
  'listed',
  'sold',
  'shipped',
  'returned',
  'scrapped',
]);

// Marketplace
export const marketplaceSchema = z.enum([
  'ebay',
  'amazon',
  'shopify',
  'facebook',
  'poshmark',
  'mercari',
  'offerup',
  'local',
]);

// Weight schema (in ounces or grams)
export const weightSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['oz', 'lb', 'g', 'kg']),
});

// Dimensions schema
export const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(['in', 'cm']),
});
