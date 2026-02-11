import { RedisStreamEventBus } from '../bus/redis-stream-bus';
import { createEvent, createCorrelatedEvent, CreateEventOptions } from '../factory';
import { EventEnvelope } from '../types/envelope';

/**
 * Interface for event store (optional)
 */
export interface EventStore {
  append(event: EventEnvelope): Promise<bigint>;
  appendBatch(events: EventEnvelope[]): Promise<bigint[]>;
}

/**
 * Configuration for EventPublisher
 */
export interface EventPublisherConfig {
  /** Name of the publishing service */
  serviceName: string;

  /** Redis Streams event bus instance */
  eventBus: RedisStreamEventBus;

  /** Optional event store for durability/audit */
  eventStore?: EventStore;

  /** Default warehouse ID (for multi-warehouse setups) */
  defaultWarehouseId?: string;

  /** Whether to store events before publishing (for durability) */
  storeBeforePublish?: boolean;
}

/**
 * High-level event publisher for QuickWMS services
 *
 * Features:
 * - Simple API for publishing events
 * - Automatic source service assignment
 * - Optional event store integration
 * - Correlation support for distributed transactions
 */
export class EventPublisher {
  private bus: RedisStreamEventBus;
  private store?: EventStore;
  private serviceName: string;
  private defaultWarehouseId?: string;
  private storeBeforePublish: boolean;

  constructor(config: EventPublisherConfig) {
    this.bus = config.eventBus;
    this.store = config.eventStore;
    this.serviceName = config.serviceName;
    this.defaultWarehouseId = config.defaultWarehouseId;
    this.storeBeforePublish = config.storeBeforePublish ?? true;
  }

  /**
   * Publish a single event
   */
  async publish<T extends Record<string, unknown>>(
    options: Omit<CreateEventOptions<T>, 'source'> & { source?: string }
  ): Promise<EventEnvelope<T>> {
    const event = createEvent({
      ...options,
      source: options.source ?? this.serviceName,
      warehouseId: options.warehouseId ?? this.defaultWarehouseId,
    });

    // Store first for durability (if enabled)
    if (this.store && this.storeBeforePublish) {
      await this.store.append(event);
    }

    // Then publish to bus
    await this.bus.publish(event);

    return event;
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch<T extends Record<string, unknown>>(
    events: Array<Omit<CreateEventOptions<T>, 'source'> & { source?: string }>
  ): Promise<EventEnvelope<T>[]> {
    const createdEvents = events.map(options =>
      createEvent({
        ...options,
        source: options.source ?? this.serviceName,
        warehouseId: options.warehouseId ?? this.defaultWarehouseId,
      })
    );

    // Store all first (if enabled)
    if (this.store && this.storeBeforePublish) {
      await this.store.appendBatch(createdEvents);
    }

    // Then publish all
    await this.bus.publishBatch(createdEvents);

    return createdEvents;
  }

  /**
   * Publish a correlated event (child event in a saga/transaction)
   */
  async publishCorrelated<T extends Record<string, unknown>>(
    options: Omit<CreateEventOptions<T>, 'source' | 'correlationId' | 'causationId'>,
    parentEvent: EventEnvelope
  ): Promise<EventEnvelope<T>> {
    const event = createCorrelatedEvent(
      {
        ...options,
        source: this.serviceName,
        warehouseId: options.warehouseId ?? this.defaultWarehouseId,
      },
      parentEvent
    );

    // Store first for durability (if enabled)
    if (this.store && this.storeBeforePublish) {
      await this.store.append(event);
    }

    // Then publish to bus
    await this.bus.publish(event);

    return event;
  }

  /**
   * Convenience method for common item events
   */
  async publishItemEvent<T extends Record<string, unknown>>(
    type: string,
    qlid: string,
    itemId: string,
    data: T,
    options?: Partial<Omit<CreateEventOptions<T>, 'type' | 'data' | 'qlid' | 'subject'>>
  ): Promise<EventEnvelope<T>> {
    return this.publish({
      type,
      qlid,
      subject: itemId,
      data,
      ...options,
    });
  }

  /**
   * Convenience method for order events
   */
  async publishOrderEvent<T extends Record<string, unknown>>(
    type: string,
    orderId: string,
    data: T,
    options?: Partial<Omit<CreateEventOptions<T>, 'type' | 'data' | 'subject'>>
  ): Promise<EventEnvelope<T>> {
    return this.publish({
      type,
      subject: orderId,
      data,
      ...options,
    });
  }

  /**
   * Get the underlying event bus
   */
  getEventBus(): RedisStreamEventBus {
    return this.bus;
  }

  /**
   * Get the service name
   */
  getServiceName(): string {
    return this.serviceName;
  }
}

export default EventPublisher;
