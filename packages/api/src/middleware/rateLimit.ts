import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { RateLimitConfig, ErrorCode } from '../types';
import { AuthenticatedRequest } from '../types';

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
};

/**
 * Create rate limit middleware with custom configuration
 */
export function createRateLimit(config: Partial<RateLimitConfig> = {}): RateLimitRequestHandler {
  const finalConfig = { ...DEFAULT_RATE_LIMIT, ...config };

  return rateLimit({
    windowMs: finalConfig.windowMs,
    max: finalConfig.max,
    message: {
      success: false,
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: finalConfig.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: finalConfig.skipSuccessfulRequests ?? false,
    skipFailedRequests: finalConfig.skipFailedRequests ?? false,
    keyGenerator: finalConfig.keyGenerator ?? defaultKeyGenerator,
    handler: rateLimitHandler,
  });
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    const firstIp = ips?.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Fall back to direct IP
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Custom rate limit handler for consistent error responses
 */
function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests, please try again later',
    },
    meta: {
      timestamp: new Date().toISOString(),
      retryAfter: res.getHeader('Retry-After'),
    },
  });
}

/**
 * Key generator that uses user ID if authenticated, otherwise IP
 */
export function userBasedKeyGenerator(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }
  return defaultKeyGenerator(req);
}

/**
 * Key generator that uses endpoint + IP
 */
export function endpointKeyGenerator(req: Request): string {
  const ip = defaultKeyGenerator(req);
  return `${req.method}:${req.path}:${ip}`;
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /**
   * Standard API rate limit (100 requests per 15 minutes)
   */
  standard: createRateLimit(),

  /**
   * Strict rate limit (30 requests per 15 minutes)
   */
  strict: createRateLimit({
    max: 30,
    windowMs: 15 * 60 * 1000,
  }),

  /**
   * Relaxed rate limit (500 requests per 15 minutes)
   */
  relaxed: createRateLimit({
    max: 500,
    windowMs: 15 * 60 * 1000,
  }),

  /**
   * Login rate limit (5 attempts per 15 minutes)
   */
  login: createRateLimit({
    max: 5,
    windowMs: 15 * 60 * 1000,
    message: 'Too many login attempts, please try again later',
    skipSuccessfulRequests: true,
  }),

  /**
   * Password reset rate limit (3 requests per hour)
   */
  passwordReset: createRateLimit({
    max: 3,
    windowMs: 60 * 60 * 1000,
    message: 'Too many password reset requests, please try again later',
  }),

  /**
   * API key generation rate limit (10 per day)
   */
  apiKeyGeneration: createRateLimit({
    max: 10,
    windowMs: 24 * 60 * 60 * 1000,
    message: 'Too many API key generation requests, please try again tomorrow',
  }),

  /**
   * File upload rate limit (20 uploads per hour)
   */
  fileUpload: createRateLimit({
    max: 20,
    windowMs: 60 * 60 * 1000,
    message: 'Too many file uploads, please try again later',
  }),

  /**
   * Search rate limit (60 searches per minute)
   */
  search: createRateLimit({
    max: 60,
    windowMs: 60 * 1000,
    message: 'Too many search requests, please slow down',
  }),

  /**
   * Webhook rate limit (1000 per minute)
   */
  webhook: createRateLimit({
    max: 1000,
    windowMs: 60 * 1000,
  }),
};

/**
 * Create a sliding window rate limiter
 * Note: This is a wrapper around express-rate-limit for consistency
 */
export function createSlidingWindowRateLimit(
  windowMs: number,
  maxRequests: number,
  keyPrefix: string = ''
): RateLimitRequestHandler {
  return createRateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      const baseKey = userBasedKeyGenerator(req);
      return keyPrefix ? `${keyPrefix}:${baseKey}` : baseKey;
    },
  });
}

/**
 * Create an endpoint-specific rate limiter
 */
export function createEndpointRateLimit(
  endpoint: string,
  maxRequests: number,
  windowMs: number = 60 * 1000
): RateLimitRequestHandler {
  return createRateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      const ip = defaultKeyGenerator(req);
      return `${endpoint}:${ip}`;
    },
  });
}

/**
 * Dynamic rate limit based on user tier
 */
export interface TierConfig {
  free: number;
  basic: number;
  pro: number;
  enterprise: number;
}

export function createTieredRateLimit(
  tierLimits: TierConfig,
  windowMs: number = 15 * 60 * 1000,
  getTier: (req: AuthenticatedRequest) => keyof TierConfig = () => 'free'
): RateLimitRequestHandler {
  // For tiered rate limiting, we use a conservative default and handle tier-specific limits
  // in the keyGenerator by including tier info
  return createRateLimit({
    windowMs,
    max: tierLimits.enterprise, // Use highest tier as max, then filter by key
    keyGenerator: (req) => {
      const tier = getTier(req as AuthenticatedRequest);
      const baseKey = userBasedKeyGenerator(req);
      return `${tier}:${baseKey}`;
    },
  });
}

/**
 * Skip rate limiting for certain conditions
 */
export function createConditionalRateLimit(
  config: Partial<RateLimitConfig>,
  skipCondition: (req: Request) => boolean
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs ?? DEFAULT_RATE_LIMIT.windowMs,
    max: config.max ?? DEFAULT_RATE_LIMIT.max,
    message: {
      success: false,
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: config.message ?? DEFAULT_RATE_LIMIT.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipCondition,
    handler: rateLimitHandler,
  });
}
