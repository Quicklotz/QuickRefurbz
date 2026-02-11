/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Initial delay in milliseconds */
  baseDelayMs: number;

  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;

  /** Multiplier for exponential backoff */
  backoffMultiplier: number;

  /** Jitter factor (0-1) to add randomness */
  jitterFactor?: number;

  /** Error codes that should be retried */
  retryableErrors?: string[];

  /** Error codes that should NOT be retried */
  nonRetryableErrors?: string[];
}

/**
 * Default retry policies for different operation types
 */
export const defaultRetryPolicies: Record<string, RetryPolicy> = {
  payment: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.3,
    retryableErrors: ['TIMEOUT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE'],
    nonRetryableErrors: ['INVALID_CARD', 'DECLINED', 'FRAUD_DETECTED'],
  },
  inventory: {
    maxRetries: 5,
    baseDelayMs: 500,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
    retryableErrors: ['TIMEOUT', 'LOCK_CONFLICT', 'DATABASE_ERROR'],
    nonRetryableErrors: ['ITEM_NOT_FOUND', 'INVALID_STATE'],
  },
  externalApi: {
    maxRetries: 4,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.5,
    retryableErrors: ['TIMEOUT', 'RATE_LIMITED', 'CONNECTION_ERROR'],
    nonRetryableErrors: ['AUTH_FAILED', 'INVALID_REQUEST'],
  },
  default: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
  },
};

/**
 * Context for retry operations
 */
export interface RetryContext {
  operationName: string;
  sagaId?: string;
  correlationId?: string;
}

/**
 * Error thrown when retries are exhausted
 */
export class RetryExhaustedError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;
  public readonly context: RetryContext;

  constructor(message: string, lastError: Error, attempts: number, context: RetryContext) {
    super(message);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
    this.context = context;
  }
}

/**
 * Check if an error is retryable based on policy
 */
function isRetryable(error: Error & { code?: string }, policy: RetryPolicy): boolean {
  const code = error.code ?? 'UNKNOWN';

  // Check non-retryable first (these are definitive)
  if (policy.nonRetryableErrors?.includes(code)) {
    return false;
  }

  // If retryable errors are specified, only retry those
  if (policy.retryableErrors && policy.retryableErrors.length > 0) {
    return policy.retryableErrors.includes(code);
  }

  // Default to retryable
  return true;
}

/**
 * Calculate delay for a retry attempt
 */
function calculateDelay(attempt: number, policy: RetryPolicy): number {
  const baseDelay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, policy.maxDelayMs);

  // Add jitter
  const jitterFactor = policy.jitterFactor ?? 0;
  const jitter = cappedDelay * jitterFactor * Math.random();

  return Math.floor(cappedDelay + jitter);
}

/**
 * Utility delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
  context: RetryContext
): Promise<T> {
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryable(lastError as Error & { code?: string }, policy)) {
        throw lastError;
      }

      // Check if we have more retries
      if (attempt === policy.maxRetries) {
        break;
      }

      // Calculate and wait for delay
      const retryDelay = calculateDelay(attempt, policy);

      console.log(
        `Retry ${attempt + 1}/${policy.maxRetries} for ${context.operationName} in ${retryDelay}ms`
      );

      await delay(retryDelay);
    }
  }

  throw new RetryExhaustedError(
    `Operation ${context.operationName} failed after ${policy.maxRetries} retries`,
    lastError,
    policy.maxRetries,
    context
  );
}

/**
 * Create a retryable version of a function
 */
export function withRetry<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  policy: RetryPolicy,
  operationName: string
): (...args: T) => Promise<R> {
  return (...args: T) => executeWithRetry(() => fn(...args), policy, { operationName });
}

export default executeWithRetry;
