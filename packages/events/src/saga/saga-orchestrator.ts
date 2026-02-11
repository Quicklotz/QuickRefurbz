import { v4 as uuidv4 } from 'uuid';
import { EventPublisher } from '../publisher/event-publisher';

/**
 * Saga status enum
 */
export enum SagaStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
  FAILED = 'failed',
}

/**
 * Base saga context that all sagas extend
 */
export interface BaseSagaContext {
  /** Unique saga instance ID */
  sagaId: string;

  /** Saga type name */
  sagaType: string;

  /** Current saga status */
  status: SagaStatus;

  /** Current step being executed */
  currentStep: number;

  /** Name of current step */
  currentStepName: string;

  /** When the saga started */
  startedAt: string;

  /** When the saga completed (if applicable) */
  completedAt?: string;

  /** Correlation ID for event tracking */
  correlationId: string;

  /** User who initiated the saga */
  userId?: string;

  /** Errors encountered */
  errors: SagaError[];

  /** Compensation log for rollback */
  compensationLog: CompensationEntry[];
}

/**
 * Saga error record
 */
export interface SagaError {
  step: string;
  error: string;
  code?: string;
  timestamp: string;
  retryable: boolean;
}

/**
 * Compensation log entry
 */
export interface CompensationEntry {
  stepName: string;
  stepIndex: number;
  forwardAction: {
    actionId: string;
    executedAt: string;
    result?: unknown;
  };
  compensatingAction?: {
    actionId: string;
    executedAt: string;
    result?: unknown;
  };
  status: 'forward_complete' | 'compensation_required' | 'compensated' | 'compensation_failed';
}

/**
 * Result of a saga step execution
 */
export interface StepResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  actionId: string;
}

/**
 * Saga step definition
 */
export interface SagaStep<TContext extends BaseSagaContext> {
  /** Step name (for logging and state tracking) */
  name: string;

  /** Execute the forward action */
  execute: (context: TContext) => Promise<StepResult>;

  /** Execute the compensating action (rollback) */
  compensate: (context: TContext) => Promise<StepResult>;

  /** Optional timeout for this step (ms) */
  timeout?: number;

  /** Whether this step can be retried on failure */
  retryable?: boolean;

  /** Max retry attempts for this step */
  maxRetries?: number;
}

/**
 * Saga orchestrator configuration
 */
export interface SagaOrchestratorConfig {
  /** Event publisher for saga events */
  publisher: EventPublisher;

  /** Default step timeout (ms) */
  defaultTimeout?: number;

  /** Default max retries per step */
  defaultMaxRetries?: number;

  /** Callback when saga completes */
  onComplete?: (context: BaseSagaContext) => Promise<void>;

  /** Callback when saga fails */
  onFailed?: (context: BaseSagaContext, error: Error) => Promise<void>;

  /** Callback when compensation completes */
  onCompensated?: (context: BaseSagaContext) => Promise<void>;
}

/**
 * Abstract Saga Orchestrator base class
 *
 * Implement this class for each saga type (e.g., OrderFulfillmentSaga)
 *
 * Features:
 * - Step-by-step execution with compensation
 * - Automatic rollback on failure
 * - Retry support with configurable policies
 * - Event publishing for saga lifecycle
 * - Timeout handling
 */
export abstract class SagaOrchestrator<TContext extends BaseSagaContext> {
  protected publisher: EventPublisher;
  protected config: Required<Omit<SagaOrchestratorConfig, 'publisher' | 'onComplete' | 'onFailed' | 'onCompensated'>> &
    Pick<SagaOrchestratorConfig, 'publisher' | 'onComplete' | 'onFailed' | 'onCompensated'>;

  constructor(config: SagaOrchestratorConfig) {
    this.publisher = config.publisher;
    this.config = {
      defaultTimeout: 30000,
      defaultMaxRetries: 3,
      ...config,
    };
  }

  /**
   * Get the saga type name
   */
  abstract get sagaType(): string;

  /**
   * Get the ordered list of saga steps
   */
  abstract getSteps(): SagaStep<TContext>[];

  /**
   * Initialize the context with input data
   */
  abstract initializeContext(input: unknown, sagaId: string, correlationId: string): TContext;

  /**
   * Start a new saga instance
   */
  async start(input: unknown, userId?: string): Promise<TContext> {
    const sagaId = uuidv4();
    const correlationId = uuidv4();

    const context = this.initializeContext(input, sagaId, correlationId);
    context.sagaId = sagaId;
    context.sagaType = this.sagaType;
    context.status = SagaStatus.RUNNING;
    context.currentStep = 0;
    context.startedAt = new Date().toISOString();
    context.correlationId = correlationId;
    context.userId = userId;
    context.errors = [];
    context.compensationLog = [];

    const steps = this.getSteps();
    if (steps.length > 0 && steps[0]) {
      context.currentStepName = steps[0].name;
    }

    // Publish saga started event
    await this.publisher.publish({
      type: `saga.${this.sagaType}.started`,
      subject: sagaId,
      correlationId,
      userId,
      data: {
        sagaId,
        sagaType: this.sagaType,
        input,
      },
    });

    // Execute the saga
    try {
      await this.executeSteps(context);
    } catch (error) {
      // Error already handled in executeSteps
    }

    return context;
  }

  /**
   * Execute all saga steps
   */
  private async executeSteps(context: TContext): Promise<void> {
    const steps = this.getSteps();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      context.currentStep = i;
      context.currentStepName = step.name;

      try {
        const result = await this.executeStepWithRetry(context, step);

        if (result.success) {
          // Record successful step for potential compensation
          context.compensationLog.push({
            stepName: step.name,
            stepIndex: i,
            forwardAction: {
              actionId: result.actionId,
              executedAt: new Date().toISOString(),
              result: result.data,
            },
            status: 'forward_complete',
          });

          // Publish step completed event
          await this.publisher.publish({
            type: `saga.${this.sagaType}.step_completed`,
            subject: context.sagaId,
            correlationId: context.correlationId,
            data: {
              sagaId: context.sagaId,
              step: step.name,
              stepIndex: i,
            },
          });
        } else {
          throw result.error ?? new Error(`Step ${step.name} failed`);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Record error
        context.errors.push({
          step: step.name,
          error: err.message,
          timestamp: new Date().toISOString(),
          retryable: step.retryable ?? true,
        });

        // Publish step failed event
        await this.publisher.publish({
          type: `saga.${this.sagaType}.step_failed`,
          subject: context.sagaId,
          correlationId: context.correlationId,
          data: {
            sagaId: context.sagaId,
            step: step.name,
            stepIndex: i,
            error: err.message,
          },
        });

        // Start compensation from previous step
        await this.compensate(context, i - 1);

        // Check if compensation was successful
        const wasCompensated = context.status === SagaStatus.COMPENSATED;

        // Set final status
        if (!wasCompensated) {
          context.status = SagaStatus.FAILED;
        }
        context.completedAt = new Date().toISOString();

        // Publish saga failed event
        await this.publisher.publish({
          type: `saga.${this.sagaType}.failed`,
          subject: context.sagaId,
          correlationId: context.correlationId,
          data: {
            sagaId: context.sagaId,
            failedStep: step.name,
            error: err.message,
            compensated: wasCompensated,
          },
        });

        if (this.config.onFailed) {
          await this.config.onFailed(context, err);
        }

        throw error;
      }
    }

    // Saga completed successfully
    context.status = SagaStatus.COMPLETED;
    context.completedAt = new Date().toISOString();

    // Publish saga completed event
    await this.publisher.publish({
      type: `saga.${this.sagaType}.completed`,
      subject: context.sagaId,
      correlationId: context.correlationId,
      data: {
        sagaId: context.sagaId,
        duration: Date.now() - new Date(context.startedAt).getTime(),
      },
    });

    if (this.config.onComplete) {
      await this.config.onComplete(context);
    }
  }

  /**
   * Execute a step with retry logic
   */
  private async executeStepWithRetry(
    context: TContext,
    step: SagaStep<TContext>
  ): Promise<StepResult> {
    const maxRetries = step.maxRetries ?? this.config.defaultMaxRetries;
    const timeout = step.timeout ?? this.config.defaultTimeout;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          step.execute(context),
          timeout
        );

        if (result.success) {
          return result;
        }

        lastError = result.error ?? new Error('Step returned unsuccessful result');

        // Check if step is retryable
        if (!(step.retryable ?? true)) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if step is retryable
        if (!(step.retryable ?? true)) {
          break;
        }
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await this.delay(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      actionId: uuidv4(),
    };
  }

  /**
   * Execute compensation for completed steps
   */
  private async compensate(context: TContext, fromStepIndex: number): Promise<void> {
    context.status = SagaStatus.COMPENSATING;

    const steps = this.getSteps();

    // Compensate in reverse order
    for (let i = fromStepIndex; i >= 0; i--) {
      const step = steps[i];
      if (!step) continue;

      const logEntry = context.compensationLog.find(e => e.stepIndex === i);
      if (!logEntry || logEntry.status !== 'forward_complete') continue;

      logEntry.status = 'compensation_required';

      try {
        const result = await this.executeWithTimeout(
          step.compensate(context),
          step.timeout ?? this.config.defaultTimeout
        );

        logEntry.compensatingAction = {
          actionId: result.actionId,
          executedAt: new Date().toISOString(),
          result: result.data,
        };
        logEntry.status = 'compensated';

        // Publish compensation completed event
        await this.publisher.publish({
          type: `saga.${this.sagaType}.compensation_completed`,
          subject: context.sagaId,
          correlationId: context.correlationId,
          data: {
            sagaId: context.sagaId,
            step: step.name,
            stepIndex: i,
          },
        });
      } catch (error) {
        logEntry.status = 'compensation_failed';

        context.errors.push({
          step: `${step.name}_compensation`,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          retryable: false,
        });

        // Publish compensation failed event
        await this.publisher.publish({
          type: `saga.${this.sagaType}.compensation_failed`,
          subject: context.sagaId,
          correlationId: context.correlationId,
          data: {
            sagaId: context.sagaId,
            step: step.name,
            stepIndex: i,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        // Continue with other compensations even if one fails
      }
    }

    // Check if all compensations succeeded
    const allCompensated = context.compensationLog
      .filter(e => e.status === 'compensation_required' || e.status === 'compensated')
      .every(e => e.status === 'compensated');

    if (allCompensated) {
      context.status = SagaStatus.COMPENSATED;

      if (this.config.onCompensated) {
        await this.config.onCompensated(context);
      }
    }
  }

  /**
   * Execute a promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Step timeout exceeded')), timeout)
      ),
    ]);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a simple step result
 */
export function createStepResult<T>(
  success: boolean,
  data?: T,
  error?: Error
): StepResult<T> {
  return {
    success,
    data,
    error,
    actionId: uuidv4(),
  };
}

/**
 * Create a successful step result
 */
export function successResult<T>(data?: T): StepResult<T> {
  return createStepResult(true, data);
}

/**
 * Create a failed step result
 */
export function failureResult(error: Error): StepResult {
  return createStepResult(false, undefined, error);
}

export default SagaOrchestrator;
