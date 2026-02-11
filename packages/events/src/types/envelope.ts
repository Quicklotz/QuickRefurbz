import { z } from 'zod';

/**
 * CloudEvents v1.0 inspired envelope for all QuickWMS events
 * https://cloudevents.io/
 */
export const EventEnvelopeSchema = z.object({
  // === CloudEvents Required Attributes ===
  /** Unique event identifier (UUID v4) */
  id: z.string().uuid(),

  /** Service that produced the event (e.g., 'quickinventoryz') */
  source: z.string().min(1),

  /** CloudEvents specification version */
  specversion: z.literal('1.0'),

  /** Event type identifier (e.g., 'item.graded') */
  type: z.string().min(1),

  // === CloudEvents Optional Attributes ===
  /** Content type of data attribute */
  datacontenttype: z.literal('application/json').default('application/json'),

  /** ISO 8601 timestamp when event was produced */
  time: z.string().datetime(),

  /** Primary entity identifier (e.g., item ID, order ID) */
  subject: z.string().optional(),

  // === QuickWMS Extensions ===
  /** 9-digit QuickLotz global ID for item tracking */
  qlid: z.string().regex(/^\d{9}$/, 'QLID must be exactly 9 digits').optional(),

  /** Correlation ID for distributed transaction tracing (saga tracking) */
  correlationId: z.string().uuid().optional(),

  /** ID of the event that caused this event (causation chain) */
  causationId: z.string().uuid().optional(),

  /** User who triggered the action */
  userId: z.string().optional(),

  /** Warehouse identifier for multi-warehouse support */
  warehouseId: z.string().optional(),

  /** Event schema version (for schema evolution) */
  version: z.number().int().positive().default(1),

  // === Payload ===
  /** Event-specific data payload */
  data: z.record(z.unknown()),

  // === Metadata ===
  /** Optional metadata for processing */
  metadata: z.object({
    /** Number of retry attempts for this event */
    retryCount: z.number().int().min(0).default(0),
    /** Original timestamp if event was retried */
    originalTimestamp: z.string().datetime().optional(),
    /** Environment identifier */
    environment: z.enum(['development', 'staging', 'production']),
    /** Processing deadline (ISO 8601) */
    deadline: z.string().datetime().optional(),
  }).optional(),
});

/**
 * Inferred TypeScript type from Zod schema
 */
export type EventEnvelope<T = Record<string, unknown>> = Omit<
  z.infer<typeof EventEnvelopeSchema>,
  'data'
> & {
  data: T;
};

/**
 * Event metadata type
 */
export type EventMetadata = NonNullable<z.infer<typeof EventEnvelopeSchema>['metadata']>;

/**
 * Minimal event info for logging/monitoring
 */
export interface EventSummary {
  id: string;
  type: string;
  source: string;
  time: string;
  qlid?: string;
  correlationId?: string;
}

/**
 * Extract summary from event envelope
 */
export function getEventSummary(event: EventEnvelope): EventSummary {
  return {
    id: event.id,
    type: event.type,
    source: event.source,
    time: event.time,
    qlid: event.qlid,
    correlationId: event.correlationId,
  };
}

/**
 * Validate event envelope against schema
 */
export function validateEventEnvelope(
  data: unknown
): { success: true; data: EventEnvelope } | { success: false; error: z.ZodError } {
  const result = EventEnvelopeSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as EventEnvelope };
  }
  return { success: false, error: result.error };
}
