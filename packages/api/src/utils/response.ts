import { Response } from 'express';
import {
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationMeta,
  ErrorCode,
  ErrorCodeToStatus,
} from '../types';

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ResponseMeta
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = {
      ...meta,
      timestamp: new Date().toISOString(),
    };
  }

  return res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  code: ErrorCode | string,
  message: string,
  statusCode?: number,
  details?: Record<string, unknown>
): Response {
  const error: ApiError = {
    code,
    message,
  };

  if (details) {
    error.details = details;
  }

  const response: ApiResponse = {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  const status = statusCode ?? ErrorCodeToStatus[code as ErrorCode] ?? 500;
  return res.status(status).json(response);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      pagination,
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(statusCode).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

/**
 * Send a no content response (204)
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send a bad request error (400)
 */
export function sendBadRequest(
  res: Response,
  message: string = 'Bad request',
  details?: Record<string, unknown>
): Response {
  return sendError(res, ErrorCode.BAD_REQUEST, message, 400, details);
}

/**
 * Send an unauthorized error (401)
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized'
): Response {
  return sendError(res, ErrorCode.UNAUTHORIZED, message, 401);
}

/**
 * Send a forbidden error (403)
 */
export function sendForbidden(
  res: Response,
  message: string = 'Forbidden'
): Response {
  return sendError(res, ErrorCode.FORBIDDEN, message, 403);
}

/**
 * Send a not found error (404)
 */
export function sendNotFound(
  res: Response,
  message: string = 'Resource not found'
): Response {
  return sendError(res, ErrorCode.NOT_FOUND, message, 404);
}

/**
 * Send a conflict error (409)
 */
export function sendConflict(
  res: Response,
  message: string = 'Resource conflict'
): Response {
  return sendError(res, ErrorCode.CONFLICT, message, 409);
}

/**
 * Send a validation error (422)
 */
export function sendValidationError(
  res: Response,
  message: string = 'Validation failed',
  details?: Record<string, unknown>
): Response {
  return sendError(res, ErrorCode.VALIDATION_ERROR, message, 422, details);
}

/**
 * Send a rate limit error (429)
 */
export function sendRateLimited(
  res: Response,
  message: string = 'Too many requests'
): Response {
  return sendError(res, ErrorCode.RATE_LIMIT_EXCEEDED, message, 429);
}

/**
 * Send an internal server error (500)
 */
export function sendInternalError(
  res: Response,
  message: string = 'Internal server error'
): Response {
  return sendError(res, ErrorCode.INTERNAL_ERROR, message, 500);
}

/**
 * Response builder class for fluent API
 */
export class ResponseBuilder<T = unknown> {
  private res: Response;
  private statusCode: number = 200;
  private responseData?: T;
  private responseError?: ApiError;
  private responseMeta?: ResponseMeta;

  constructor(res: Response) {
    this.res = res;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  data(data: T): this {
    this.responseData = data;
    return this;
  }

  error(code: ErrorCode | string, message: string, details?: Record<string, unknown>): this {
    this.responseError = { code, message, details };
    return this;
  }

  meta(meta: ResponseMeta): this {
    this.responseMeta = meta;
    return this;
  }

  pagination(pagination: PaginationMeta): this {
    this.responseMeta = { ...this.responseMeta, pagination };
    return this;
  }

  send(): Response {
    const response: ApiResponse<T> = {
      success: !this.responseError,
    };

    if (this.responseData !== undefined) {
      response.data = this.responseData;
    }

    if (this.responseError) {
      response.error = this.responseError;
    }

    if (this.responseMeta) {
      response.meta = {
        ...this.responseMeta,
        timestamp: new Date().toISOString(),
      };
    }

    return this.res.status(this.statusCode).json(response);
  }
}

/**
 * Create a response builder
 */
export function response<T = unknown>(res: Response): ResponseBuilder<T> {
  return new ResponseBuilder<T>(res);
}
