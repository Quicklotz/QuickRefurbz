// Server
export { createServer, createRouter, healthChecks } from './server';
export type { ServerInstance } from './server';

// Types
export {
  ApiResponse,
  ApiError,
  ResponseMeta,
  PaginationMeta,
  PaginationParams,
  JwtPayload,
  AuthenticatedRequest,
  Middleware,
  ErrorMiddleware,
  ServerConfig,
  CorsConfig,
  RateLimitConfig,
  JwtConfig,
  LoggingConfig,
  SwaggerConfig,
  HealthCheckConfig,
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  ErrorCode,
  ErrorCodeToStatus,
  RouteDefinition,
} from './types';

// Auth middleware
export {
  authenticate,
  optionalAuth,
  requireRoles,
  requirePermissions,
  requireOwnership,
  configureJwt,
  generateToken,
  verifyToken,
  decodeToken,
  hashPassword,
  comparePassword,
  extractToken,
  configureRefreshToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateTokenPair,
} from './middleware/auth';
export type { RefreshTokenConfig, TokenPair } from './middleware/auth';

// Validation middleware
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validateRequest,
  validateAsync,
  createValidator,
  sanitizers,
  commonValidators,
} from './middleware/validation';
export type { ValidationTarget, ValidationOptions, MultiValidationSchema } from './middleware/validation';

// Error handling
export {
  ApiException,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalError,
  createErrorHandler,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  catchError,
  assert,
  assertExists,
} from './middleware/errorHandler';
export type { ErrorHandlerOptions } from './middleware/errorHandler';

// Rate limiting
export {
  createRateLimit,
  userBasedKeyGenerator,
  endpointKeyGenerator,
  rateLimiters,
  createSlidingWindowRateLimit,
  createEndpointRateLimit,
  createTieredRateLimit,
  createConditionalRateLimit,
} from './middleware/rateLimit';
export type { TierConfig } from './middleware/rateLimit';

// Logging
export {
  createLogger,
  logger,
  createRequestLogger,
  requestLogger,
  requestIdMiddleware,
  responseTimeMiddleware,
  createChildLogger,
  log,
  audit,
} from './middleware/logging';

// Response utilities
export {
  sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendNoContent,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
  sendRateLimited,
  sendInternalError,
  ResponseBuilder,
  response,
} from './utils/response';

// Pagination utilities
export {
  PAGINATION_DEFAULTS,
  parsePagination,
  createPaginationMeta,
  paginateArray,
  getSqlPagination,
  parseCursorPagination,
  createCursor,
  decodeCursor,
  createCursorPaginationMeta,
} from './utils/pagination';
export type { CursorPaginationParams, CursorPaginationMeta } from './utils/pagination';

// Validation schemas
export {
  idSchema,
  numericIdSchema,
  paginationSchema,
  cursorPaginationSchema,
  sortOrderSchema,
  sortSchema,
  dateRangeSchema,
  emailSchema,
  phoneSchema,
  passwordSchema,
  urlSchema,
  skuSchema,
  barcodeSchema,
  currencySchema,
  percentageSchema,
  quantitySchema,
  searchQuerySchema,
  addressSchema,
  coordinatesSchema,
  enumFilterSchema,
  enumArrayFilterSchema,
  partialSchema,
  updateSchema,
  formatZodErrors,
  timestampSchema,
  baseEntitySchema,
  softDeleteSchema,
  conditionSchema,
  inventoryStatusSchema,
  marketplaceSchema,
  weightSchema,
  dimensionsSchema,
} from './utils/validation';

// Re-export zod for convenience
export { z } from 'zod';

// External API clients
export { lookupRainforestProduct } from './clients/rainforest';
export type { RainforestClientConfig, RainforestLookupOptions, RainforestProductData } from './clients/rainforest';
