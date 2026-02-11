import express, { Express, Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import {
  ServerConfig,
  CorsConfig,
  SwaggerConfig,
  HealthStatus,
  HealthCheckResult,
  HealthCheck,
} from './types';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { createRateLimit } from './middleware/rateLimit';
import { createRequestLogger, requestIdMiddleware, responseTimeMiddleware } from './middleware/logging';
import { configureJwt } from './middleware/auth';
import { sendSuccess } from './utils/response';

/**
 * Default server configuration
 */
const DEFAULT_CONFIG: Partial<ServerConfig> = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
};

const DEFAULT_CORS: CorsConfig = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
};

const DEFAULT_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 100,
};

const DEFAULT_LOGGING = {
  level: process.env.NODE_ENV === 'production' ? 'info' as const : 'debug' as const,
  prettyPrint: process.env.NODE_ENV !== 'production',
};

/**
 * Server instance interface
 */
export interface ServerInstance {
  app: Express;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addRouter: (path: string, router: Router) => void;
  addMiddleware: (middleware: (req: Request, res: Response, next: NextFunction) => void) => void;
  getHealthStatus: () => Promise<HealthStatus>;
}

/**
 * Create an Express server with standard middleware
 */
export function createServer(config: Partial<ServerConfig> = {}): ServerInstance {
  const port = config.port ?? DEFAULT_CONFIG.port ?? 3000;
  const host = config.host ?? DEFAULT_CONFIG.host ?? '0.0.0.0';
  const corsConfig = config.cors ?? DEFAULT_CORS;
  const rateLimitConfig = config.rateLimit ?? DEFAULT_RATE_LIMIT;
  const loggingConfig = config.logging ?? DEFAULT_LOGGING;

  const app = express();
  let server: ReturnType<typeof app.listen> | null = null;
  const startTime = Date.now();
  const healthChecks: HealthCheck[] = config.healthCheck?.checks || [];

  // Configure JWT if provided
  if (config.jwt) {
    configureJwt(config.jwt);
  }

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors(buildCorsOptions(corsConfig)));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID and response time
  app.use(requestIdMiddleware);
  app.use(responseTimeMiddleware);

  // Request logging
  if (loggingConfig) {
    app.use(createRequestLogger(loggingConfig));
  }

  // Rate limiting
  if (rateLimitConfig) {
    app.use(createRateLimit(rateLimitConfig));
  }

  // Health check endpoint
  const healthPath = config.healthCheck?.path || '/health';
  app.get(healthPath, async (_req: Request, res: Response) => {
    const status = await getHealthStatus();
    const statusCode = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;
    sendSuccess(res, status, statusCode);
  });

  // Liveness probe (always returns 200 if server is running)
  app.get('/health/live', (_req: Request, res: Response) => {
    sendSuccess(res, { status: 'alive', timestamp: new Date().toISOString() });
  });

  // Readiness probe (checks if server is ready to handle requests)
  app.get('/health/ready', async (_req: Request, res: Response) => {
    const status = await getHealthStatus();
    if (status.status === 'unhealthy') {
      res.status(503).json({ success: false, data: status });
    } else {
      sendSuccess(res, status);
    }
  });

  // Swagger documentation
  if (config.swagger) {
    setupSwagger(app, config.swagger);
  }

  /**
   * Get current health status
   */
  async function getHealthStatus(): Promise<HealthStatus> {
    const checks: Record<string, HealthCheckResult> = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Run all health checks
    for (const check of healthChecks) {
      const checkStartTime = Date.now();
      try {
        const result = await check.check();
        checks[check.name] = {
          ...result,
          latency: Date.now() - checkStartTime,
        };

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks[check.name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          latency: Date.now() - checkStartTime,
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version,
      checks,
    };
  }

  /**
   * Start the server
   */
  async function start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Add 404 handler for unmatched routes
        app.use(notFoundHandler);

        // Add error handler (must be last)
        app.use(createErrorHandler({
          includeStack: process.env.NODE_ENV !== 'production',
        }));

        server = app.listen(port, host, () => {
          console.log(`Server running on http://${host}:${port}`);
          console.log(`Health check available at http://${host}:${port}${healthPath}`);
          if (config.swagger) {
            console.log(`API docs available at http://${host}:${port}/api-docs`);
          }
          resolve();
        });

        server.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async function stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Add a router to the app
   */
  function addRouter(path: string, router: Router): void {
    app.use(path, router);
  }

  /**
   * Add middleware to the app
   */
  function addMiddleware(
    middleware: (req: Request, res: Response, next: NextFunction) => void
  ): void {
    app.use(middleware);
  }

  return {
    app,
    start,
    stop,
    addRouter,
    addMiddleware,
    getHealthStatus,
  };
}

/**
 * Build CORS options from config
 */
function buildCorsOptions(config: CorsConfig): cors.CorsOptions {
  return {
    origin: config.origin,
    credentials: config.credentials,
    methods: config.methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: config.allowedHeaders || ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: config.exposedHeaders || ['X-Request-Id', 'X-Response-Time', 'RateLimit-Remaining'],
    maxAge: config.maxAge || 86400, // 24 hours
  };
}

/**
 * Setup Swagger documentation
 */
function setupSwagger(app: Express, config: SwaggerConfig): void {
  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: config.title,
        version: config.version,
        description: config.description || '',
      },
      servers: config.servers || [
        {
          url: config.basePath || '/',
          description: 'API Server',
        },
      ],
      tags: config.tags || [],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {
          ApiResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  details: { type: 'object' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'number' },
                      limit: { type: 'number' },
                      total: { type: 'number' },
                      totalPages: { type: 'number' },
                      hasNext: { type: 'boolean' },
                      hasPrev: { type: 'boolean' },
                    },
                  },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
          Error: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    apis: ['./src/**/*.ts', './dist/**/*.js'], // Look for annotations in source files
  };

  const swaggerSpec = swaggerJsdoc(swaggerOptions);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: `${config.title} - API Documentation`,
  }));

  // Expose swagger spec as JSON
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.json(swaggerSpec);
  });
}

/**
 * Create a router with standard middleware
 */
export function createRouter(): Router {
  return Router();
}

/**
 * Health check factory helpers
 */
export const healthChecks = {
  /**
   * Create a database health check
   */
  database: (name: string, checkFn: () => Promise<boolean>): HealthCheck => ({
    name,
    check: async () => {
      const healthy = await checkFn();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'Database connection OK' : 'Database connection failed',
      };
    },
  }),

  /**
   * Create a Redis health check
   */
  redis: (name: string, checkFn: () => Promise<boolean>): HealthCheck => ({
    name,
    check: async () => {
      const healthy = await checkFn();
      return {
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'Redis connection OK' : 'Redis connection failed',
      };
    },
  }),

  /**
   * Create an external service health check
   */
  externalService: (name: string, url: string, timeoutMs: number = 5000): HealthCheck => ({
    name,
    check: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return {
          status: response.ok ? 'healthy' : 'degraded',
          message: response.ok ? 'Service reachable' : `Service returned ${response.status}`,
        };
      } catch (error) {
        clearTimeout(timeout);
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Service unreachable',
        };
      }
    },
  }),

  /**
   * Create a memory usage health check
   */
  memory: (thresholdMb: number = 500): HealthCheck => ({
    name: 'memory',
    check: async () => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      const status = used < thresholdMb ? 'healthy' : used < thresholdMb * 1.5 ? 'degraded' : 'unhealthy';
      return {
        status,
        message: `Memory usage: ${Math.round(used)}MB`,
        details: {
          heapUsed: Math.round(used),
          threshold: thresholdMb,
        },
      };
    },
  }),

  /**
   * Create a disk space health check
   */
  diskSpace: (path: string, thresholdPercent: number = 90): HealthCheck => ({
    name: 'disk',
    check: async () => {
      // This is a simplified check - in production you'd use a library like 'check-disk-space'
      return {
        status: 'healthy',
        message: `Disk check for ${path}`,
        details: { path, threshold: thresholdPercent },
      };
    },
  }),

  /**
   * Create a custom health check
   */
  custom: (name: string, checkFn: () => Promise<HealthCheckResult>): HealthCheck => ({
    name,
    check: checkFn,
  }),
};
