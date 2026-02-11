import { RedisStreamEventBus, EventHandler } from '../bus/redis-stream-bus';
import { EventEnvelope, validateEventEnvelope } from '../types/envelope';
import { ZodSchema } from 'zod';

/**
 * Handler context provided to event handlers
 */
export interface HandlerContext {
  /** Correlation ID from the event (for saga tracking) */
  correlationId?: string;

  /** Causation ID from the event */
  causationId?: string;

  /** Event metadata */
  metadata?: EventEnvelope['metadata'];

  /** QLID if present */
  qlid?: string;
}

/**
 * Typed event handler with context
 */
export type TypedEventHandler<T = Record<string, unknown>> = (
  event: EventEnvelope<T>,
  context: HandlerContext
) => Promise<void>;

/**
 * Subscription options
 */
export interface SubscriptionOptions<T = Record<string, unknown>> {
  /** Zod schema for payload validation */
  schema?: ZodSchema<T>;

  /** Error handler for validation/processing errors */
  onError?: (error: Error, event: EventEnvelope) => void;

  /** Whether to continue processing on validation error */
  skipOnValidationError?: boolean;
}

/**
 * Subscription definition
 */
interface SubscriptionDef {
  eventTypes: string[];
  handler: TypedEventHandler;
  options: SubscriptionOptions;
}

/**
 * High-level event subscriber for QuickWMS services
 *
 * Features:
 * - Type-safe event handlers
 * - Optional payload validation with Zod
 * - Handler context with correlation tracking
 * - Error handling and recovery
 */
export class EventSubscriber {
  private bus: RedisStreamEventBus;
  private subscriptions: SubscriptionDef[] = [];
  private started = false;

  constructor(bus: RedisStreamEventBus) {
    this.bus = bus;
  }

  /**
   * Subscribe to a single event type
   */
  on<T extends Record<string, unknown>>(
    eventType: string,
    handler: TypedEventHandler<T>,
    options: SubscriptionOptions<T> = {}
  ): this {
    return this.onMultiple([eventType], handler, options);
  }

  /**
   * Subscribe to multiple event types with the same handler
   */
  onMultiple<T extends Record<string, unknown>>(
    eventTypes: string[],
    handler: TypedEventHandler<T>,
    options: SubscriptionOptions<T> = {}
  ): this {
    this.subscriptions.push({
      eventTypes,
      handler: handler as TypedEventHandler,
      options: options as SubscriptionOptions,
    });
    return this;
  }

  /**
   * Subscribe to all events in a domain (e.g., 'item.*')
   */
  onDomain(
    domain: string,
    handler: TypedEventHandler,
    options: SubscriptionOptions = {}
  ): this {
    // This subscribes to all events matching the domain prefix
    // The actual filtering happens in the handler wrapper
    this.subscriptions.push({
      eventTypes: [domain],
      handler,
      options,
    });
    return this;
  }

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Group all subscribed event types
    const allEventTypes = new Set<string>();
    for (const sub of this.subscriptions) {
      for (const type of sub.eventTypes) {
        allEventTypes.add(type);
      }
    }

    // Create the wrapped handler that routes to appropriate subscribers
    const handler: EventHandler = async (rawEvent: EventEnvelope) => {
      // Validate basic envelope structure
      const validation = validateEventEnvelope(rawEvent);
      if (!validation.success) {
        this.bus.emit('validationError', { event: rawEvent, error: validation.error });
        return;
      }

      const event = validation.data;
      const context: HandlerContext = {
        correlationId: event.correlationId,
        causationId: event.causationId,
        metadata: event.metadata,
        qlid: event.qlid,
      };

      // Find and execute matching handlers
      for (const sub of this.subscriptions) {
        // Check if this subscription matches the event type
        const matches = sub.eventTypes.some(subType => {
          if (subType.endsWith('.*')) {
            // Domain wildcard match
            const prefix = subType.slice(0, -2);
            return event.type.startsWith(prefix + '.');
          }
          if (subType === '*') {
            return true;
          }
          return subType === event.type;
        });

        if (!matches) continue;

        try {
          // Validate payload schema if provided
          if (sub.options.schema) {
            const payloadValidation = sub.options.schema.safeParse(event.data);
            if (!payloadValidation.success) {
              const error = new Error(`Payload validation failed: ${payloadValidation.error.message}`);
              if (sub.options.onError) {
                sub.options.onError(error, event);
              }
              if (sub.options.skipOnValidationError) {
                continue;
              }
              throw error;
            }
          }

          // Execute handler
          await sub.handler(event, context);
        } catch (error) {
          if (sub.options.onError && error instanceof Error) {
            sub.options.onError(error, event);
          }
          // Re-throw to let the bus handle retry logic
          throw error;
        }
      }
    };

    // Subscribe to the event bus
    await this.bus.subscribe(Array.from(allEventTypes), handler);
    await this.bus.start();
  }

  /**
   * Stop processing events
   */
  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    await this.bus.shutdown();
  }

  /**
   * Check if subscriber is running
   */
  isRunning(): boolean {
    return this.started;
  }

  /**
   * Get the underlying event bus
   */
  getEventBus(): RedisStreamEventBus {
    return this.bus;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.length;
  }
}

/**
 * Create a type-safe handler with payload validation
 */
export function createHandler<T extends Record<string, unknown>>(
  schema: ZodSchema<T>,
  handler: (data: T, event: EventEnvelope<T>, context: HandlerContext) => Promise<void>
): TypedEventHandler<T> {
  return async (event: EventEnvelope<T>, context: HandlerContext) => {
    const validated = schema.parse(event.data);
    await handler(validated, event, context);
  };
}

export default EventSubscriber;
