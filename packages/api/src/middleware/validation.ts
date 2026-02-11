import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ErrorCode } from '../types';
import { sendError } from '../utils/response';
import { formatZodErrors } from '../utils/validation';

/**
 * Validation target (where to look for data to validate)
 */
export type ValidationTarget = 'body' | 'query' | 'params' | 'headers';

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Strip unknown keys from the validated data */
  stripUnknown?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Custom error code */
  errorCode?: ErrorCode | string;
}

/**
 * Create a validation middleware for a specific target
 */
export function validate<T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  const { errorMessage, errorCode = ErrorCode.VALIDATION_ERROR } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[target];
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      sendError(
        res,
        errorCode,
        errorMessage || `Validation failed for ${target}`,
        422,
        { errors, target }
      );
      return;
    }

    // Replace the target data with the validated (and potentially transformed) data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[target] = result.data;
    next();
  };
}

/**
 * Validate request body
 */
export function validateBody<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'body', options);
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'query', options);
}

/**
 * Validate URL parameters
 */
export function validateParams<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'params', options);
}

/**
 * Validate headers
 */
export function validateHeaders<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate(schema, 'headers', options);
}

/**
 * Combined validation for multiple targets
 */
export interface MultiValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

export function validateRequest(
  schemas: MultiValidationSchema,
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, errorCode = ErrorCode.VALIDATION_ERROR } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: Record<string, Record<string, string[]>> = {};
    let hasErrors = false;

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const data = req[target as ValidationTarget];
      const result = schema.safeParse(data);

      if (!result.success) {
        hasErrors = true;
        allErrors[target] = formatZodErrors(result.error);
      } else if (stripUnknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any)[target] = result.data;
      }
    }

    if (hasErrors) {
      sendError(
        res,
        errorCode,
        'Validation failed',
        422,
        { errors: allErrors }
      );
      return;
    }

    next();
  };
}

/**
 * Async validation middleware (for schemas that need async validation)
 */
export function validateAsync<T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body',
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, errorMessage, errorCode = ErrorCode.VALIDATION_ERROR } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = req[target];

    try {
      const result = await schema.safeParseAsync(data);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        sendError(
          res,
          errorCode,
          errorMessage || `Validation failed for ${target}`,
          422,
          { errors, target }
        );
        return;
      }

      if (stripUnknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any)[target] = result.data;
      }
      next();
    } catch {
      sendError(
        res,
        ErrorCode.INTERNAL_ERROR,
        'Validation processing error'
      );
    }
  };
}

/**
 * Create a custom validator function
 */
export function createValidator<T>(schema: ZodSchema<T>) {
  return {
    validate: (data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } => {
      const result = schema.safeParse(data);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    },

    validateOrThrow: (data: unknown): T => {
      return schema.parse(data);
    },

    middleware: (target: ValidationTarget = 'body', options?: ValidationOptions) =>
      validate(schema, target, options),
  };
}

/**
 * Sanitization helpers
 */
export const sanitizers = {
  /** Trim whitespace from string */
  trim: z.string().transform((s) => s.trim()),

  /** Convert to lowercase */
  lowercase: z.string().transform((s) => s.toLowerCase()),

  /** Convert to uppercase */
  uppercase: z.string().transform((s) => s.toUpperCase()),

  /** Remove HTML tags */
  stripHtml: z.string().transform((s) => s.replace(/<[^>]*>/g, '')),

  /** Normalize whitespace (multiple spaces to single) */
  normalizeWhitespace: z.string().transform((s) => s.replace(/\s+/g, ' ').trim()),

  /** Convert empty string to undefined */
  emptyToUndefined: z.string().transform((s) => (s === '' ? undefined : s)),

  /** Convert string to number or undefined */
  toNumberOrUndefined: z.string().transform((s) => {
    const num = parseFloat(s);
    return isNaN(num) ? undefined : num;
  }),
};

/**
 * Common validation patterns as middleware
 */
export const commonValidators = {
  /** Validate UUID in params.id */
  uuidParam: validateParams(
    z.object({ id: z.string().uuid() })
  ),

  /** Validate numeric ID in params.id */
  numericIdParam: validateParams(
    z.object({ id: z.coerce.number().int().positive() })
  ),

  /** Validate pagination query params */
  pagination: validateQuery(
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
  ),

  /** Validate search query params */
  search: validateQuery(
    z.object({
      q: z.string().min(1).max(500).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
  ),
};
