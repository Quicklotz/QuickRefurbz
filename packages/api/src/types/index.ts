import { Request, Response, NextFunction } from 'express';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Response metadata for pagination, timing, etc.
 */
export interface ResponseMeta {
  pagination?: PaginationMeta;
  requestId?: string;
  timestamp?: string;
  duration?: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Pagination query parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Authenticated request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  requestId?: string;
}

/**
 * Express middleware type
 */
export type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Express error middleware type
 */
export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Server configuration options
 */
export interface ServerConfig {
  port: number;
  host?: string;
  cors?: CorsConfig;
  rateLimit?: RateLimitConfig;
  jwt?: JwtConfig;
  logging?: LoggingConfig;
  swagger?: SwaggerConfig;
  healthCheck?: HealthCheckConfig;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  origin: string | string[] | boolean | RegExp | RegExp[];
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * JWT configuration
 */
export interface JwtConfig {
  secret: string;
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  prettyPrint?: boolean;
  redact?: string[];
}

/**
 * Swagger/OpenAPI configuration
 */
export interface SwaggerConfig {
  title: string;
  version: string;
  description?: string;
  basePath?: string;
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  path?: string;
  checks?: HealthCheck[];
}

/**
 * Individual health check
 */
export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
}

/**
 * Overall health status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version?: string;
  checks: Record<string, HealthCheckResult>;
}

/**
 * API error codes
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',

  // Custom errors
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * HTTP status code mapping
 */
export const ErrorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.RESOURCE_LOCKED]: 423,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
};

/**
 * Route definition for OpenAPI documentation
 */
export interface RouteDefinition {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  summary?: string;
  description?: string;
  tags?: string[];
  security?: boolean;
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, unknown>;
  };
  responses?: Record<string, {
    description: string;
    content?: Record<string, unknown>;
  }>;
}
