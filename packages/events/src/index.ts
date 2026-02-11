/**
 * @quickwms/events
 *
 * Event-Driven Architecture framework for QuickWMS
 *
 * Features:
 * - Redis Streams event bus for high-throughput messaging
 * - CloudEvents-compatible event envelope
 * - PostgreSQL event store for audit trail
 * - Saga orchestrator for distributed transactions
 * - Retry policies and idempotency handling
 *
 * @example Basic Publishing
 * ```typescript
 * import { RedisStreamEventBus, EventPublisher, InboundEvents } from '@quickwms/events';
 *
 * const bus = new RedisStreamEventBus({
 *   redis: { host: 'localhost', port: 6379 },
 *   serviceName: 'quickinventoryz',
 * });
 *
 * const publisher = new EventPublisher({
 *   serviceName: 'quickinventoryz',
 *   eventBus: bus,
 * });
 *
 * await publisher.publish({
 *   type: InboundEvents.ITEM_RECEIVED,
 *   qlid: '123456789',
 *   subject: 'item-uuid',
 *   data: { itemId: 'item-uuid', manifestId: 'manifest-uuid' },
 * });
 * ```
 *
 * @example Subscribing to Events
 * ```typescript
 * import { RedisStreamEventBus, EventSubscriber, ProcessingEvents } from '@quickwms/events';
 *
 * const bus = new RedisStreamEventBus({
 *   redis: { host: 'localhost', port: 6379 },
 *   serviceName: 'quickgradez',
 * });
 *
 * const subscriber = new EventSubscriber(bus);
 *
 * subscriber.on(ProcessingEvents.ITEM_RECEIVED, async (event, context) => {
 *   console.log('Item received:', event.data);
 * });
 *
 * await subscriber.start();
 * ```
 */

// Types
export * from './types';

// Factory
export * from './factory';

// Domain Events
export * from './domains';

// Event Bus
export * from './bus';

// Publisher
export * from './publisher';

// Subscriber
export * from './subscriber';

// Event Store
export * from './store';

// Saga
export * from './saga';

// Utilities
export * from './utils';
