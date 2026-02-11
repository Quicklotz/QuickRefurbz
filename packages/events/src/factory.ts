import { v4 as uuidv4 } from 'uuid';
import { EventEnvelope, EventMetadata } from './types/envelope';

/**
 * Options for creating a new event
 */
export interface CreateEventOptions<T extends Record<string, unknown>> {
  /** Event type (e.g., 'item.graded') */
  type: string;

  /** Source service name (e.g., 'quickinventoryz') */
  source: string;

  /** Event-specific payload */
  data: T;

  /** Primary entity ID */
  subject?: string;

  /** 9-digit QuickLotz ID */
  qlid?: string;

  /** Correlation ID for saga/distributed transaction tracking */
  correlationId?: string;

  /** ID of event that caused this event */
  causationId?: string;

  /** User who triggered the action */
  userId?: string;

  /** Warehouse identifier */
  warehouseId?: string;

  /** Event schema version */
  version?: number;

  /** Custom metadata */
  metadata?: Partial<EventMetadata>;
}

/**
 * Create a new event envelope with auto-generated ID and timestamp
 */
export function createEvent<T extends Record<string, unknown>>(
  options: CreateEventOptions<T>
): EventEnvelope<T> {
  const now = new Date().toISOString();
  const environment = getEnvironment();

  return {
    id: uuidv4(),
    specversion: '1.0',
    type: options.type,
    source: options.source,
    datacontenttype: 'application/json',
    time: now,
    subject: options.subject,
    qlid: options.qlid,
    correlationId: options.correlationId,
    causationId: options.causationId,
    userId: options.userId,
    warehouseId: options.warehouseId,
    version: options.version ?? 1,
    data: options.data,
    metadata: {
      retryCount: 0,
      environment,
      ...options.metadata,
    },
  };
}

/**
 * Create a correlated event (child event in a saga)
 */
export function createCorrelatedEvent<T extends Record<string, unknown>>(
  options: Omit<CreateEventOptions<T>, 'correlationId' | 'causationId'>,
  parentEvent: EventEnvelope
): EventEnvelope<T> {
  return createEvent({
    ...options,
    correlationId: parentEvent.correlationId ?? parentEvent.id,
    causationId: parentEvent.id,
  });
}

/**
 * Create a retry copy of an event
 */
export function createRetryEvent<T extends Record<string, unknown>>(
  originalEvent: EventEnvelope<T>
): EventEnvelope<T> {
  const retryCount = (originalEvent.metadata?.retryCount ?? 0) + 1;

  return {
    ...originalEvent,
    id: uuidv4(),
    time: new Date().toISOString(),
    metadata: {
      ...originalEvent.metadata,
      retryCount,
      originalTimestamp: originalEvent.metadata?.originalTimestamp ?? originalEvent.time,
      environment: originalEvent.metadata?.environment ?? getEnvironment(),
    },
  };
}

/**
 * Get environment from NODE_ENV
 */
function getEnvironment(): 'development' | 'staging' | 'production' {
  const env = process.env['NODE_ENV'];
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

/**
 * Generate a new correlation ID for a new saga/transaction
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Check if event is a retry
 */
export function isRetryEvent(event: EventEnvelope): boolean {
  return (event.metadata?.retryCount ?? 0) > 0;
}

/**
 * Get retry count from event
 */
export function getRetryCount(event: EventEnvelope): number {
  return event.metadata?.retryCount ?? 0;
}
