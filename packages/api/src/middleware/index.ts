/**
 * Middleware Exports
 */

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
} from './auth.js';
export type { RefreshTokenConfig, TokenPair } from './auth.js';

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
} from './errorHandler.js';
export type { ErrorHandlerOptions } from './errorHandler.js';

export {
  requestLogger,
  createLogger,
  logger,
  createRequestLogger,
  requestIdMiddleware,
  responseTimeMiddleware,
  createChildLogger,
  log,
  audit,
} from './logging.js';

export {
  createRateLimit,
  userBasedKeyGenerator,
  endpointKeyGenerator,
  rateLimiters,
  createSlidingWindowRateLimit,
  createEndpointRateLimit,
  createTieredRateLimit,
  createConditionalRateLimit,
} from './rateLimit.js';
export type { TierConfig } from './rateLimit.js';

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
} from './validation.js';
export type { ValidationTarget, ValidationOptions, MultiValidationSchema } from './validation.js';
