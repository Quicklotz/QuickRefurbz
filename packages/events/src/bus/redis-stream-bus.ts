import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { EventEnvelope } from '../types/envelope';
import { getStreamKeyForEvent } from '../domains';

/**
 * Configuration for Redis Stream Event Bus
 */
export interface RedisStreamEventBusConfig {
  /** Redis connection options */
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    tls?: boolean;
  };

  /** Name of this service (used for consumer group) */
  serviceName: string;

  /** Prefix for stream keys */
  streamPrefix?: string;

  /** Suffix for consumer groups */
  consumerGroupSuffix?: string;

  /** Block time in ms when reading from streams */
  blockTimeMs?: number;

  /** Maximum retries before sending to DLQ */
  maxRetries?: number;

  /** Delay between retries in ms */
  retryDelayMs?: number;

  /** Maximum stream length (for trimming) */
  maxStreamLength?: number;
}

/**
 * Event handler callback type
 */
export type EventHandler = (event: EventEnvelope) => Promise<void>;

/**
 * Subscription info
 */
interface Subscription {
  eventTypes: string[];
  handler: EventHandler;
  streamKeys: Set<string>;
}

/**
 * Redis Streams based Event Bus for QuickWMS
 *
 * Features:
 * - Consumer groups for load balancing across service instances
 * - Message acknowledgment for reliable delivery
 * - Dead letter queue for failed messages
 * - Automatic stream trimming
 */
export class RedisStreamEventBus extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private config: Required<Omit<RedisStreamEventBusConfig, 'redis'>> & { redis: RedisStreamEventBusConfig['redis'] };
  private isRunning = false;
  private subscriptions: Subscription[] = [];
  private activeConsumers: Map<string, AbortController> = new Map();

  constructor(config: RedisStreamEventBusConfig) {
    super();

    this.config = {
      streamPrefix: 'quickwms:events:',
      consumerGroupSuffix: '-group',
      blockTimeMs: 5000,
      maxRetries: 3,
      retryDelayMs: 1000,
      maxStreamLength: 100000,
      ...config,
    };

    // Create Redis connections
    const redisOptions = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      tls: this.config.redis.tls ? {} : undefined,
      lazyConnect: true,
    };

    this.redis = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    await Promise.all([
      this.redis.connect(),
      this.subscriber.connect(),
    ]);
    this.emit('connected');
  }

  /**
   * Get the stream key for an event type
   */
  private getStreamKey(eventType: string): string {
    return getStreamKeyForEvent(eventType, this.config.streamPrefix);
  }

  /**
   * Get the consumer group name for this service
   */
  private getGroupName(): string {
    return `${this.config.serviceName}${this.config.consumerGroupSuffix}`;
  }

  /**
   * Get the consumer name for this instance
   */
  private getConsumerName(): string {
    return `${this.config.serviceName}-${process.pid}-${Date.now()}`;
  }

  /**
   * Publish an event to Redis Streams
   */
  async publish<T extends Record<string, unknown>>(
    event: EventEnvelope<T>
  ): Promise<string> {
    const streamKey = this.getStreamKey(event.type);
    const serialized = JSON.stringify(event);

    // Add to stream with auto-generated ID and trim to max length
    const messageId = await this.redis.xadd(
      streamKey,
      'MAXLEN',
      '~',
      this.config.maxStreamLength.toString(),
      '*',
      'event', serialized,
      'type', event.type,
      'source', event.source,
      'time', event.time,
      'qlid', event.qlid ?? '',
      'correlationId', event.correlationId ?? ''
    );

    if (!messageId) {
      throw new Error(`Failed to publish event to stream ${streamKey}`);
    }

    this.emit('published', { streamKey, messageId, event });
    return messageId;
  }

  /**
   * Publish multiple events in a pipeline
   */
  async publishBatch<T extends Record<string, unknown>>(
    events: EventEnvelope<T>[]
  ): Promise<string[]> {
    const pipeline = this.redis.pipeline();

    for (const event of events) {
      const streamKey = this.getStreamKey(event.type);
      const serialized = JSON.stringify(event);

      pipeline.xadd(
        streamKey,
        'MAXLEN',
        '~',
        this.config.maxStreamLength.toString(),
        '*',
        'event', serialized,
        'type', event.type,
        'source', event.source,
        'time', event.time,
        'qlid', event.qlid ?? '',
        'correlationId', event.correlationId ?? ''
      );
    }

    const results = await pipeline.exec();
    if (!results) {
      throw new Error('Pipeline execution failed');
    }

    return results.map(([err, id]) => {
      if (err) throw err;
      return id as string;
    });
  }

  /**
   * Subscribe to specific event types
   */
  async subscribe(
    eventTypes: string[],
    handler: EventHandler
  ): Promise<void> {
    // Group events by stream key
    const streamKeys = new Set<string>();
    for (const eventType of eventTypes) {
      streamKeys.add(this.getStreamKey(eventType));
    }

    // Store subscription
    const subscription: Subscription = {
      eventTypes,
      handler,
      streamKeys,
    };
    this.subscriptions.push(subscription);

    // Ensure consumer groups exist and start consuming
    for (const streamKey of streamKeys) {
      await this.ensureConsumerGroup(streamKey);

      if (!this.activeConsumers.has(streamKey)) {
        this.startConsuming(streamKey);
      }
    }
  }

  /**
   * Start the event bus (begin consuming)
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start consuming from all subscribed streams
    const allStreamKeys = new Set<string>();
    for (const sub of this.subscriptions) {
      for (const key of sub.streamKeys) {
        allStreamKeys.add(key);
      }
    }

    for (const streamKey of allStreamKeys) {
      await this.ensureConsumerGroup(streamKey);
      this.startConsuming(streamKey);
    }

    this.emit('started');
  }

  /**
   * Ensure consumer group exists for a stream
   */
  private async ensureConsumerGroup(streamKey: string): Promise<void> {
    const groupName = this.getGroupName();

    try {
      // Try to create the group starting from the beginning
      await this.subscriber.xgroup('CREATE', streamKey, groupName, '0', 'MKSTREAM');
    } catch (error: unknown) {
      // Group already exists is fine
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  /**
   * Start consuming from a stream
   */
  private startConsuming(streamKey: string): void {
    if (this.activeConsumers.has(streamKey)) return;

    const controller = new AbortController();
    this.activeConsumers.set(streamKey, controller);

    // Start async consumer loop
    this.consumeLoop(streamKey, controller.signal).catch(error => {
      this.emit('error', { streamKey, error });
    });
  }

  /**
   * Main consume loop for a stream
   */
  private async consumeLoop(streamKey: string, signal: AbortSignal): Promise<void> {
    const groupName = this.getGroupName();
    const consumerName = this.getConsumerName();

    // First process any pending messages (unacknowledged)
    await this.processPending(streamKey, groupName, consumerName);

    // Then consume new messages
    while (this.isRunning && !signal.aborted) {
      try {
        const results = await this.subscriber.xreadgroup(
          'GROUP', groupName, consumerName,
          'COUNT', '10',
          'BLOCK', this.config.blockTimeMs.toString(),
          'STREAMS', streamKey, '>'
        ) as [string, [string, string[]][]][] | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
            await this.processMessage(streamKey, groupName, messageId, fields);
          }
        }
      } catch (error) {
        if (!signal.aborted) {
          this.emit('error', { streamKey, error });
          await this.delay(this.config.retryDelayMs);
        }
      }
    }
  }

  /**
   * Process pending (unacknowledged) messages
   */
  private async processPending(
    streamKey: string,
    groupName: string,
    consumerName: string
  ): Promise<void> {
    try {
      // Get pending messages for this consumer
      const pending = await this.subscriber.xpending(
        streamKey,
        groupName,
        '-',
        '+',
        '100',
        consumerName
      ) as [string, string, number, [string, string][]][];

      for (const entry of pending) {
        const messageId = entry[0];
        if (!messageId) continue;

        // Claim the message
        const claimed = await this.subscriber.xclaim(
          streamKey,
          groupName,
          consumerName,
          '60000', // Min idle time of 1 minute
          messageId
        ) as [string, string[]][];

        if (claimed.length > 0 && claimed[0]) {
          const [claimedId, fields] = claimed[0];
          if (claimedId && fields) {
            await this.processMessage(streamKey, groupName, claimedId, fields);
          }
        }
      }
    } catch (error) {
      // Pending processing errors are non-fatal
      this.emit('error', { streamKey, error, phase: 'pending' });
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    streamKey: string,
    groupName: string,
    messageId: string,
    fields: string[]
  ): Promise<void> {
    // Parse fields into object
    const data: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      if (key !== undefined && value !== undefined) {
        data[key] = value;
      }
    }

    const eventData = data['event'];
    const eventType = data['type'];

    if (!eventData || !eventType) {
      // Invalid message, ACK and skip
      await this.subscriber.xack(streamKey, groupName, messageId);
      return;
    }

    // Find matching handlers
    const matchingHandlers: EventHandler[] = [];
    for (const sub of this.subscriptions) {
      if (sub.eventTypes.includes(eventType) || sub.eventTypes.includes('*')) {
        matchingHandlers.push(sub.handler);
      }
    }

    if (matchingHandlers.length === 0) {
      // No handlers, ACK and skip
      await this.subscriber.xack(streamKey, groupName, messageId);
      return;
    }

    try {
      const event: EventEnvelope = JSON.parse(eventData);

      // Execute all matching handlers
      for (const handler of matchingHandlers) {
        await handler(event);
      }

      // ACK successful processing
      await this.subscriber.xack(streamKey, groupName, messageId);
      this.emit('processed', { streamKey, messageId, event });
    } catch (error) {
      this.emit('processingError', { streamKey, messageId, error });

      // Check retry count
      const retryCount = parseInt(data['retryCount'] ?? '0', 10);
      if (retryCount >= this.config.maxRetries) {
        // Move to dead letter queue
        await this.moveToDeadLetter(streamKey, messageId, data, error);
        await this.subscriber.xack(streamKey, groupName, messageId);
      }
      // If under max retries, message stays pending for retry
    }
  }

  /**
   * Move failed message to dead letter queue
   */
  private async moveToDeadLetter(
    streamKey: string,
    messageId: string,
    data: Record<string, string>,
    error: unknown
  ): Promise<void> {
    const dlqKey = `${streamKey}:dlq`;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await this.redis.xadd(
      dlqKey,
      '*',
      'originalStreamKey', streamKey,
      'originalMessageId', messageId,
      'event', data['event'] ?? '',
      'error', errorMessage,
      'failedAt', new Date().toISOString()
    );

    this.emit('deadLetter', { streamKey, messageId, error: errorMessage });
  }

  /**
   * Get stream info (for monitoring)
   */
  async getStreamInfo(streamKey: string): Promise<{
    length: number;
    firstEntry: string | null;
    lastEntry: string | null;
    groups: number;
  }> {
    const info = await this.redis.xinfo('STREAM', streamKey) as unknown[];

    // Parse XINFO STREAM response
    const result: Record<string, unknown> = {};
    for (let i = 0; i < info.length; i += 2) {
      const key = info[i] as string;
      result[key] = info[i + 1];
    }

    return {
      length: result['length'] as number ?? 0,
      firstEntry: result['first-entry'] ? (result['first-entry'] as string[])[0] ?? null : null,
      lastEntry: result['last-entry'] ? (result['last-entry'] as string[])[0] ?? null : null,
      groups: result['groups'] as number ?? 0,
    };
  }

  /**
   * Get consumer group info (for monitoring)
   */
  async getGroupInfo(streamKey: string): Promise<{
    name: string;
    consumers: number;
    pending: number;
    lastDeliveredId: string;
  }[]> {
    const groups = await this.redis.xinfo('GROUPS', streamKey) as unknown[][];

    return groups.map(group => {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < group.length; i += 2) {
        const key = group[i] as string;
        result[key] = group[i + 1];
      }
      return {
        name: result['name'] as string ?? '',
        consumers: result['consumers'] as number ?? 0,
        pending: result['pending'] as number ?? 0,
        lastDeliveredId: result['last-delivered-id'] as string ?? '',
      };
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isRunning = false;

    // Abort all active consumers
    for (const controller of this.activeConsumers.values()) {
      controller.abort();
    }
    this.activeConsumers.clear();

    // Close Redis connections
    await Promise.all([
      this.redis.quit(),
      this.subscriber.quit(),
    ]);

    this.emit('shutdown');
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RedisStreamEventBus;
