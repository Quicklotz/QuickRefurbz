import Redis from 'ioredis';

/**
 * Idempotency record stored in Redis
 */
export interface IdempotencyRecord {
  key: string;
  operation: string;
  status: 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Configuration for idempotency handler
 */
export interface IdempotencyConfig {
  /** Redis client instance */
  redis: Redis;

  /** Key prefix */
  keyPrefix?: string;

  /** Default TTL in seconds */
  defaultTtlSeconds?: number;

  /** Polling interval when waiting for processing to complete (ms) */
  pollIntervalMs?: number;

  /** Maximum wait time when waiting for processing (ms) */
  maxWaitMs?: number;
}

/**
 * Error thrown when waiting for a processing operation times out
 */
export class IdempotencyWaitTimeoutError extends Error {
  public readonly key: string;

  constructor(key: string) {
    super(`Timeout waiting for idempotent operation: ${key}`);
    this.name = 'IdempotencyWaitTimeoutError';
    this.key = key;
  }
}

/**
 * Idempotency Handler using Redis
 *
 * Ensures operations are executed exactly once by:
 * 1. Checking if operation was already executed
 * 2. Marking operation as 'processing' before execution
 * 3. Storing result on completion
 * 4. Returning cached result on subsequent calls
 */
export class IdempotencyHandler {
  private redis: Redis;
  private keyPrefix: string;
  private defaultTtlSeconds: number;
  private pollIntervalMs: number;
  private maxWaitMs: number;

  constructor(config: IdempotencyConfig) {
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix ?? 'idempotency:';
    this.defaultTtlSeconds = config.defaultTtlSeconds ?? 86400; // 24 hours
    this.pollIntervalMs = config.pollIntervalMs ?? 100;
    this.maxWaitMs = config.maxWaitMs ?? 30000;
  }

  /**
   * Get the full Redis key
   */
  private getRedisKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Execute an operation idempotently
   */
  async executeIdempotent<T>(
    key: string,
    operation: string,
    fn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const redisKey = this.getRedisKey(key);
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;

    // Try to get existing record
    const existing = await this.getRecord(redisKey);

    if (existing) {
      if (existing.status === 'processing') {
        // Wait for existing operation to complete
        return this.waitForCompletion<T>(redisKey);
      }

      if (existing.status === 'completed') {
        return existing.result as T;
      }

      if (existing.status === 'failed') {
        throw new Error(existing.error ?? 'Previous execution failed');
      }
    }

    // Try to acquire the lock (set if not exists)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const record: IdempotencyRecord = {
      key,
      operation,
      status: 'processing',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // NX = only set if not exists, EX = set expiry
    const acquired = await this.redis.set(
      redisKey,
      JSON.stringify(record),
      'EX',
      ttl,
      'NX'
    );

    if (!acquired) {
      // Another process acquired the lock, wait for completion
      return this.waitForCompletion<T>(redisKey);
    }

    try {
      // Execute the operation
      const result = await fn();

      // Store successful result
      const successRecord: IdempotencyRecord = {
        ...record,
        status: 'completed',
        result,
      };

      await this.redis.set(
        redisKey,
        JSON.stringify(successRecord),
        'EX',
        ttl
      );

      return result;
    } catch (error) {
      // Store failed result
      const failedRecord: IdempotencyRecord = {
        ...record,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };

      await this.redis.set(
        redisKey,
        JSON.stringify(failedRecord),
        'EX',
        ttl
      );

      throw error;
    }
  }

  /**
   * Wait for a processing operation to complete
   */
  private async waitForCompletion<T>(redisKey: string): Promise<T> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.maxWaitMs) {
      const record = await this.getRecord(redisKey);

      if (!record) {
        throw new Error('Idempotency record disappeared while waiting');
      }

      if (record.status === 'completed') {
        return record.result as T;
      }

      if (record.status === 'failed') {
        throw new Error(record.error ?? 'Previous execution failed');
      }

      // Still processing, wait and poll again
      await this.delay(this.pollIntervalMs);
    }

    throw new IdempotencyWaitTimeoutError(redisKey);
  }

  /**
   * Get an idempotency record
   */
  private async getRecord(redisKey: string): Promise<IdempotencyRecord | null> {
    const data = await this.redis.get(redisKey);
    if (!data) return null;

    try {
      return JSON.parse(data) as IdempotencyRecord;
    } catch {
      return null;
    }
  }

  /**
   * Check if an operation was already executed
   */
  async isExecuted(key: string): Promise<boolean> {
    const redisKey = this.getRedisKey(key);
    const record = await this.getRecord(redisKey);
    return record?.status === 'completed';
  }

  /**
   * Get the result of a previous execution
   */
  async getResult<T>(key: string): Promise<T | null> {
    const redisKey = this.getRedisKey(key);
    const record = await this.getRecord(redisKey);

    if (record?.status === 'completed') {
      return record.result as T;
    }

    return null;
  }

  /**
   * Clear an idempotency record (for testing or manual reset)
   */
  async clear(key: string): Promise<void> {
    const redisKey = this.getRedisKey(key);
    await this.redis.del(redisKey);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Generate an idempotency key for saga operations
 */
export function generateIdempotencyKey(context: {
  sagaId: string;
  step: string;
  entityId?: string;
}): string {
  const parts = [context.sagaId, context.step];
  if (context.entityId) {
    parts.push(context.entityId);
  }
  return parts.join(':');
}

export default IdempotencyHandler;
