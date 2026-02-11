import pino, { Logger, LoggerOptions } from 'pino';
import pinoHttp, { HttpLogger, Options as PinoHttpOptions } from 'pino-http';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LoggingConfig, AuthenticatedRequest } from '../types';

/**
 * Default logging configuration
 */
const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  prettyPrint: process.env.NODE_ENV !== 'production',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token'],
};

/**
 * Create a pino logger instance
 */
export function createLogger(config: LoggingConfig = {}): Logger {
  const finalConfig = { ...DEFAULT_LOGGING_CONFIG, ...config };

  const options: LoggerOptions = {
    level: finalConfig.level || 'info',
    redact: finalConfig.redact,
  };

  // Add pretty printing in development
  if (finalConfig.prettyPrint) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(options);
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Create request logging middleware
 */
export function createRequestLogger(
  config: LoggingConfig = {},
  customOptions: Partial<PinoHttpOptions> = {}
): HttpLogger {
  const loggerInstance = createLogger(config);

  const options: PinoHttpOptions = {
    logger: loggerInstance,
    genReqId: (req) => {
      // Use existing request ID or generate new one
      const existingId = req.headers['x-request-id'];
      if (existingId && typeof existingId === 'string') {
        return existingId;
      }
      return randomUUID();
    },
    customProps: (_req, _res) => {
      const authReq = _req as AuthenticatedRequest;
      return {
        userId: authReq.user?.userId,
        userEmail: authReq.user?.email,
      };
    },
    customLogLevel: (_req, res, error) => {
      if (res.statusCode >= 500 || error) {
        return 'error';
      }
      if (res.statusCode >= 400) {
        return 'warn';
      }
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, error) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${error.message}`;
    },
    // Serializers to customize logged data
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        // Don't log sensitive headers
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'x-request-id': req.headers['x-request-id'],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length'),
        },
      }),
    },
    ...customOptions,
  };

  return pinoHttp(options);
}

/**
 * Default request logger middleware
 */
export const requestLogger = createRequestLogger();

/**
 * Request ID middleware
 * Attaches a unique request ID to each request
 */
export function requestIdMiddleware(
  req: Request & { requestId?: string },
  res: Response,
  next: NextFunction
): void {
  // Use existing request ID from header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

/**
 * Response time middleware
 * Logs and adds response time header
 */
export function responseTimeMiddleware(
  req: Request & { startTime?: number },
  res: Response,
  next: NextFunction
): void {
  req.startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    res.setHeader('X-Response-Time', `${duration}ms`);

    // Log slow requests
    if (duration > 1000) {
      logger.warn({
        msg: 'Slow request detected',
        method: req.method,
        url: req.url,
        duration,
      });
    }
  });

  next();
}

/**
 * Create a child logger with context
 */
export function createChildLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}

/**
 * Structured logging helpers
 */
export const log = {
  /**
   * Log an info message
   */
  info: (message: string, data?: Record<string, unknown>) => {
    logger.info(data || {}, message);
  },

  /**
   * Log a debug message
   */
  debug: (message: string, data?: Record<string, unknown>) => {
    logger.debug(data || {}, message);
  },

  /**
   * Log a warning message
   */
  warn: (message: string, data?: Record<string, unknown>) => {
    logger.warn(data || {}, message);
  },

  /**
   * Log an error message
   */
  error: (message: string, error?: Error, data?: Record<string, unknown>) => {
    logger.error(
      {
        ...data,
        err: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      },
      message
    );
  },

  /**
   * Log a fatal message
   */
  fatal: (message: string, error?: Error, data?: Record<string, unknown>) => {
    logger.fatal(
      {
        ...data,
        err: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      },
      message
    );
  },

  /**
   * Log an HTTP request
   */
  request: (req: Request, data?: Record<string, unknown>) => {
    logger.info(
      {
        method: req.method,
        url: req.url,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        ...data,
      },
      'Incoming request'
    );
  },

  /**
   * Log an HTTP response
   */
  response: (req: Request, res: Response, duration: number, data?: Record<string, unknown>) => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        ...data,
      },
      'Request completed'
    );
  },

  /**
   * Log a database query
   */
  query: (query: string, duration: number, data?: Record<string, unknown>) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    logger[level](
      {
        query: query.substring(0, 500), // Truncate long queries
        duration,
        ...data,
      },
      'Database query'
    );
  },

  /**
   * Log an external API call
   */
  externalApi: (
    service: string,
    method: string,
    url: string,
    duration: number,
    statusCode?: number,
    data?: Record<string, unknown>
  ) => {
    const level = (statusCode && statusCode >= 400) || duration > 5000 ? 'warn' : 'info';
    logger[level](
      {
        service,
        method,
        url,
        duration,
        statusCode,
        ...data,
      },
      'External API call'
    );
  },
};

/**
 * Audit logging for security-sensitive operations
 */
export const audit = {
  /**
   * Log a login attempt
   */
  login: (userId: string, success: boolean, ip: string, userAgent?: string) => {
    logger.info(
      {
        event: 'login',
        userId,
        success,
        ip,
        userAgent,
      },
      success ? 'User logged in' : 'Login attempt failed'
    );
  },

  /**
   * Log a logout
   */
  logout: (userId: string, ip: string) => {
    logger.info(
      {
        event: 'logout',
        userId,
        ip,
      },
      'User logged out'
    );
  },

  /**
   * Log a permission change
   */
  permissionChange: (
    userId: string,
    targetUserId: string,
    action: string,
    permissions: string[]
  ) => {
    logger.info(
      {
        event: 'permission_change',
        userId,
        targetUserId,
        action,
        permissions,
      },
      'User permissions changed'
    );
  },

  /**
   * Log a data access
   */
  dataAccess: (userId: string, resource: string, action: string, resourceId?: string) => {
    logger.info(
      {
        event: 'data_access',
        userId,
        resource,
        action,
        resourceId,
      },
      'Data accessed'
    );
  },

  /**
   * Log a configuration change
   */
  configChange: (userId: string, setting: string, oldValue: unknown, newValue: unknown) => {
    logger.info(
      {
        event: 'config_change',
        userId,
        setting,
        oldValue,
        newValue,
      },
      'Configuration changed'
    );
  },
};
