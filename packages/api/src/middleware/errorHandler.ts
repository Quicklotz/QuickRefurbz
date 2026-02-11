import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCode, ErrorCodeToStatus, ApiError } from '../types';
import { formatZodErrors } from '../utils/validation';

/**
 * Custom API Error class
 */
export class ApiException extends Error {
  public readonly code: ErrorCode | string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode | string,
    message: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.statusCode = statusCode ?? ErrorCodeToStatus[code as ErrorCode] ?? 500;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends ApiException {
  constructor(resource: string = 'Resource', id?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, 404);
  }
}

/**
 * Validation Error
 */
export class ValidationError extends ApiException {
  constructor(message: string = 'Validation failed', details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 422, details);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends ApiException {
  constructor(message: string = 'Authentication required') {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends ApiException {
  constructor(message: string = 'Access forbidden') {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

/**
 * Conflict Error
 */
export class ConflictError extends ApiException {
  constructor(message: string = 'Resource conflict') {
    super(ErrorCode.CONFLICT, message, 409);
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends ApiException {
  constructor(message: string = 'Too many requests') {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429);
  }
}

/**
 * Internal Server Error
 */
export class InternalError extends ApiException {
  constructor(message: string = 'Internal server error') {
    super(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Include stack trace in error response (only in development) */
  includeStack?: boolean;
  /** Custom error logger */
  logger?: {
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
  /** Custom error transformer */
  transformError?: (error: Error) => ApiException | null;
  /** Callback for unhandled errors */
  onUnhandledError?: (error: Error, req: Request) => void;
}

/**
 * Create error handler middleware
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    includeStack = process.env.NODE_ENV === 'development',
    logger = console,
    transformError,
    onUnhandledError,
  } = options;

  return (
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    // Try custom transformation first
    if (transformError) {
      const transformed = transformError(error);
      if (transformed) {
        error = transformed;
      }
    }

    let statusCode = 500;
    let apiError: ApiError;

    // Handle known error types
    if (error instanceof ApiException) {
      statusCode = error.statusCode;
      apiError = {
        code: error.code,
        message: error.message,
        details: error.details,
      };
    } else if (error instanceof ZodError) {
      statusCode = 422;
      apiError = {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: { errors: formatZodErrors(error) },
      };
    } else if (error.name === 'SyntaxError' && 'body' in error) {
      // JSON parsing error
      statusCode = 400;
      apiError = {
        code: ErrorCode.BAD_REQUEST,
        message: 'Invalid JSON in request body',
      };
    } else if (error.name === 'PayloadTooLargeError') {
      statusCode = 413;
      apiError = {
        code: ErrorCode.BAD_REQUEST,
        message: 'Request payload too large',
      };
    } else {
      // Unknown error - treat as internal error
      apiError = {
        code: ErrorCode.INTERNAL_ERROR,
        message:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message,
      };

      // Log unknown errors
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
      });

      if (onUnhandledError) {
        onUnhandledError(error, req);
      }
    }

    // Include stack trace in development
    if (includeStack && error.stack) {
      apiError.stack = error.stack;
    }

    // Send error response
    res.status(statusCode).json({
      success: false,
      error: apiError,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      },
    });
  };
}

/**
 * Default error handler middleware
 */
export const errorHandler = createErrorHandler();

/**
 * Not found handler (for unmatched routes)
 */
export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Async handler wrapper to catch async errors
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrap a function to catch errors and convert to ApiException
 */
export function catchError<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
  errorMessage?: string
): Promise<T> {
  return fn().catch((error) => {
    if (error instanceof ApiException) {
      throw error;
    }
    throw new ApiException(
      errorCode,
      errorMessage || error.message || 'An error occurred'
    );
  });
}

/**
 * Assert a condition, throw ApiException if false
 */
export function assert(
  condition: boolean,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    throw new ApiException(code, message, undefined, details);
  }
}

/**
 * Assert that a value is not null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string = 'Resource',
  id?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, id);
  }
}
