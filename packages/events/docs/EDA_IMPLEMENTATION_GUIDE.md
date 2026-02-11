# QuickWMS Event-Driven Architecture (EDA) Implementation Guide

**Version:** 1.0.0
**Date:** February 2026
**Package:** @quickwms/events

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Package Structure](#3-package-structure)
4. [Core Components](#4-core-components)
5. [Domain Events Catalog](#5-domain-events-catalog)
6. [Database Schema](#6-database-schema)
7. [Integration Guide](#7-integration-guide)
8. [Saga Patterns](#8-saga-patterns)
9. [Error Handling & Resilience](#9-error-handling--resilience)
10. [Monitoring & Observability](#10-monitoring--observability)
11. [Migration Strategy](#11-migration-strategy)
12. [Best Practices](#12-best-practices)
13. [API Reference](#13-api-reference)

---

## 1. Executive Summary

### What Changed

QuickWMS has been enhanced with a complete Event-Driven Architecture (EDA) framework. This enables:

- **Decoupled microservices** - Services communicate via events instead of direct REST calls
- **Audit trail** - Every domain event is stored for complete traceability
- **Distributed transactions** - Saga patterns for multi-service operations
- **Real-time updates** - Events flow immediately to all interested services
- **Resilience** - Retry policies, dead letter queues, and idempotency handling

### Before vs After

| Aspect | Before (REST-only) | After (EDA + REST) |
|--------|-------------------|-------------------|
| Communication | Synchronous HTTP | Async events + sync HTTP |
| Coupling | Tight (direct calls) | Loose (event-based) |
| Audit Trail | Manual logging | Automatic event store |
| Failure Handling | Per-request | Saga compensation |
| Scalability | Limited by sync calls | Event consumers scale independently |
| Real-time | Polling required | Push via Redis Streams |

### Technology Stack

- **Event Bus:** Redis Streams (leveraging existing Redis 7 deployment)
- **Event Store:** PostgreSQL (new tables in existing database)
- **Event Format:** CloudEvents v1.0 specification
- **Language:** TypeScript with Zod validation
- **Package:** `@quickwms/events` in monorepo

---

## 2. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QuickWMS Microservices                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ QuickIntakez │  │ QuickGradez  │  │ QuickListz   │  │QuickFulfill  │    │
│  │              │  │              │  │              │  │              │    │
│  │  Publisher   │  │  Publisher   │  │  Publisher   │  │  Publisher   │    │
│  │  Subscriber  │  │  Subscriber  │  │  Subscriber  │  │  Subscriber  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         │    publish()    │    publish()    │    publish()    │             │
│         │   subscribe()   │   subscribe()   │   subscribe()   │             │
│         ▼                 ▼                 ▼                 ▼             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Redis Streams Event Bus                          │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ item stream │ │grading strm │ │ sales stream│ │ order stream│    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  │                                                                      │   │
│  │  Consumer Groups for each service (load balancing)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  Store for audit                                                  │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL Event Store                            │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ event_store │ │ saga_state  │ │  event_dlq  │ │idempotency  │    │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Event Flow Example

```
1. Item received at warehouse
   │
   ▼
┌──────────────┐
│ QuickIntakez │ ──publish──► item.received
└──────────────┘                    │
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│QuickInventory│           │ QuickGradez  │           │ QuickInsightz│
│              │           │              │           │              │
│ Update stock │           │ Create task  │           │ Update stats │
└──────────────┘           └──────────────┘           └──────────────┘
                                    │
                                    ▼
                           item.graded ──────────────────────────────┐
                                    │                                │
                                    ▼                                ▼
                           ┌──────────────┐                 ┌──────────────┐
                           │  QuickListz  │                 │ QuickRefurbz │
                           │              │                 │ (if needed)  │
                           │ Create list  │                 │              │
                           └──────────────┘                 └──────────────┘
```

### Why Redis Streams?

| Feature | Redis Streams | Benefit |
|---------|--------------|---------|
| Already deployed | Redis 7 on port 6379 | Zero infrastructure cost |
| Consumer groups | Built-in | Load balancing across instances |
| Message acknowledgment | XACK command | Reliable at-least-once delivery |
| Stream trimming | MAXLEN/MINID | Automatic retention management |
| Low latency | Sub-millisecond | Real-time auction updates |
| Persistence | AOF + RDB | Survives restarts |

---

## 3. Package Structure

```
packages/events/
├── package.json                 # Package manifest
├── tsconfig.json               # TypeScript configuration
├── src/
│   ├── index.ts                # Main exports
│   │
│   ├── types/
│   │   ├── envelope.ts         # CloudEvents envelope schema
│   │   └── index.ts
│   │
│   ├── factory.ts              # Event creation utilities
│   │
│   ├── domains/
│   │   └── index.ts            # All domain event constants
│   │
│   ├── bus/
│   │   ├── redis-stream-bus.ts # Redis Streams implementation
│   │   └── index.ts
│   │
│   ├── publisher/
│   │   ├── event-publisher.ts  # High-level publisher API
│   │   └── index.ts
│   │
│   ├── subscriber/
│   │   ├── event-subscriber.ts # High-level subscriber API
│   │   └── index.ts
│   │
│   ├── store/
│   │   ├── postgres-store.ts   # Event store for audit
│   │   └── index.ts
│   │
│   ├── saga/
│   │   ├── saga-orchestrator.ts # Saga pattern base class
│   │   └── index.ts
│   │
│   └── utils/
│       ├── retry.ts            # Retry policies
│       ├── idempotency.ts      # Idempotency handling
│       └── index.ts
│
└── dist/                       # Compiled JavaScript output
```

---

## 4. Core Components

### 4.1 Event Envelope (CloudEvents v1.0)

Every event follows the CloudEvents specification with QuickWMS extensions:

```typescript
interface EventEnvelope<T> {
  // CloudEvents required fields
  id: string;              // UUID v4, auto-generated
  source: string;          // Service name (e.g., 'quickinventoryz')
  specversion: '1.0';      // CloudEvents version
  type: string;            // Event type (e.g., 'item.graded')

  // CloudEvents optional fields
  datacontenttype: 'application/json';
  time: string;            // ISO 8601 timestamp
  subject?: string;        // Primary entity ID

  // QuickWMS extensions
  qlid?: string;           // 9-digit QuickLotz global ID
  correlationId?: string;  // Saga/transaction tracking
  causationId?: string;    // Parent event ID
  userId?: string;         // User who triggered action
  warehouseId?: string;    // Multi-warehouse support
  version: number;         // Schema version

  // Payload
  data: T;                 // Event-specific data

  // Metadata
  metadata?: {
    retryCount: number;
    originalTimestamp?: string;
    environment: 'development' | 'staging' | 'production';
  };
}
```

### 4.2 Redis Stream Event Bus

The core message transport layer:

```typescript
import { RedisStreamEventBus } from '@quickwms/events';

const bus = new RedisStreamEventBus({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  serviceName: 'quickinventoryz',  // Used for consumer group
  streamPrefix: 'quickwms:events:',
  maxRetries: 3,
  retryDelayMs: 1000,
  maxStreamLength: 100000,  // Trim streams to this length
});

// Connect
await bus.connect();

// Publish an event
await bus.publish(event);

// Subscribe to events
await bus.subscribe(['item.received', 'item.graded'], async (event) => {
  console.log('Received:', event.type);
});

// Start consuming
await bus.start();

// Graceful shutdown
await bus.shutdown();
```

### 4.3 Event Publisher

High-level API for publishing events:

```typescript
import { EventPublisher, InboundEvents } from '@quickwms/events';

const publisher = new EventPublisher({
  serviceName: 'quickintakez',
  eventBus: bus,
  eventStore: store,  // Optional: for durability
  storeBeforePublish: true,
});

// Simple publish
await publisher.publish({
  type: InboundEvents.ITEM_RECEIVED,
  qlid: '123456789',
  subject: 'item-uuid-here',
  data: {
    itemId: 'item-uuid-here',
    manifestId: 'manifest-uuid',
    sku: 'ABC123',
    condition: 'new',
  },
  userId: 'user-uuid',
});

// Publish correlated event (for sagas)
await publisher.publishCorrelated({
  type: ProcessingEvents.GRADING_TASK_CREATED,
  data: { taskId: 'task-uuid' },
}, parentEvent);  // Links via correlationId/causationId

// Convenience method for item events
await publisher.publishItemEvent(
  InboundEvents.ITEM_RECEIVED,
  '123456789',  // qlid
  'item-uuid',  // itemId
  { manifestId: 'manifest-uuid' }
);
```

### 4.4 Event Subscriber

High-level API for consuming events:

```typescript
import { EventSubscriber, ProcessingEvents } from '@quickwms/events';
import { z } from 'zod';

const subscriber = new EventSubscriber(bus);

// Simple subscription
subscriber.on(ProcessingEvents.ITEM_GRADED, async (event, context) => {
  console.log('Item graded:', event.data);
  console.log('Correlation ID:', context.correlationId);
});

// Subscribe to multiple event types
subscriber.onMultiple(
  [InboundEvents.ITEM_RECEIVED, InboundEvents.MANIFEST_RECEIVED],
  async (event, context) => {
    console.log('Inbound event:', event.type);
  }
);

// Subscribe to entire domain (wildcard)
subscriber.onDomain('item.*', async (event, context) => {
  console.log('Any item event:', event.type);
});

// With Zod validation
const ItemGradedSchema = z.object({
  itemId: z.string().uuid(),
  qlid: z.string().regex(/^\d{9}$/),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
});

subscriber.on(
  ProcessingEvents.ITEM_GRADED,
  async (event, context) => {
    // event.data is validated
    console.log('Grade:', event.data.grade);
  },
  { schema: ItemGradedSchema }
);

// Start consuming
await subscriber.start();
```

### 4.5 PostgreSQL Event Store

Durable storage for audit and replay:

```typescript
import { PostgresEventStore } from '@quickwms/events';

const store = new PostgresEventStore({
  connectionString: process.env.DATABASE_URL,
  tableName: 'event_store',
  schemaName: 'public',
});

// Initialize tables (run once)
await store.initialize();

// Append event
const sequenceNumber = await store.append(event);

// Query by QLID (item lifecycle)
const itemHistory = await store.getByQlid('123456789');

// Query by correlation ID (saga trace)
const sagaEvents = await store.getByCorrelationId('correlation-uuid');

// Query by time range
const recentEvents = await store.getByTimeRange({
  startTime: new Date('2026-02-01'),
  endTime: new Date('2026-02-09'),
  eventType: 'item.sold',
  limit: 100,
});

// Get single event
const event = await store.getById('event-uuid');

// Monitoring
const count = await store.getCount('item.graded');
const latestSeq = await store.getLatestSequence();
```

---

## 5. Domain Events Catalog

### Organized by Business Domain

#### Inbound Domain (QuickIntakez, QuickPalletz)

| Event | Description | Key Data |
|-------|-------------|----------|
| `manifest.created` | New manifest registered | manifestId, source, expectedItems |
| `manifest.received` | Manifest physically received | manifestId, receivedBy, palletCount |
| `manifest.completed` | All items processed | manifestId, totalItems, duration |
| `pallet.created` | New pallet created | palletId, manifestId |
| `pallet.location_changed` | Pallet moved | palletId, fromLocation, toLocation |
| `item.received` | Item scanned in | itemId, qlid, manifestId, sku |
| `item.assigned_to_pallet` | Item placed on pallet | itemId, palletId |

#### Processing Domain (QuickGradez, QuickRefurbz)

| Event | Description | Key Data |
|-------|-------------|----------|
| `grading.task_created` | Grading task queued | taskId, itemId, priority |
| `grading.task_completed` | Grading finished | taskId, duration |
| `item.graded` | Item condition assessed | itemId, qlid, grade, condition |
| `refurb.job_created` | Refurbishment needed | jobId, itemId, issues |
| `refurb.job_completed` | Refurbishment done | jobId, laborMinutes, partsUsed |
| `item.refurbished` | Item ready after refurb | itemId, newCondition |
| `item.ready_for_listing` | Item ready to sell | itemId, qlid, recommendedPrice |

#### Sales Domain (QuickListz, QuickBidz, QuickAuctionz)

| Event | Description | Key Data |
|-------|-------------|----------|
| `listing.created` | Listing drafted | listingId, itemId, marketplace |
| `listing.published` | Listing live | listingId, listingUrl, price |
| `item.listed` | Item now for sale | itemId, channels[] |
| `auction.created` | Auction created | auctionId, itemIds, startTime |
| `auction.started` | Bidding opened | auctionId |
| `bid.placed` | New bid received | bidId, auctionId, amount, bidderId |
| `bid.won` | Auction winner | bidId, auctionId, winningAmount |
| `item.sold` | Sale completed | itemId, qlid, orderId, salePrice |

#### Outbound Domain (QuickFulfillment, QuickLoadz)

| Event | Description | Key Data |
|-------|-------------|----------|
| `order.created` | New order received | orderId, itemIds, buyerId |
| `order.payment_received` | Payment confirmed | orderId, paymentId, amount |
| `order.picking_started` | Pick list generated | orderId, pickListId |
| `order.shipped` | Package dispatched | orderId, trackingNumber, carrier |
| `order.delivered` | Delivery confirmed | orderId, deliveredAt |
| `shipment.dispatched` | Left warehouse | shipmentId, carrier |

#### Disposition Domain (QuickSalvage, QuickRecyclez, QuickDiscardz)

| Event | Description | Key Data |
|-------|-------------|----------|
| `item.marked_for_salvage` | Routed to salvage | itemId, reason |
| `item.parts_harvested` | Parts extracted | itemId, partsHarvested[] |
| `item.marked_for_recycling` | Routed to recycling | itemId, materialType |
| `recycling.certificate_received` | R2 certificate | batchId, certificateUrl |
| `item.disposed` | Item discarded | itemId, disposalMethod |
| `discard.writeoff_generated` | Financial writeoff | itemId, writeoffAmount |

#### Finance Domain (QuickFinancez)

| Event | Description | Key Data |
|-------|-------------|----------|
| `payment.received` | Payment processed | paymentId, orderId, amount |
| `invoice.generated` | Invoice created | invoiceId, amount, dueDate |
| `payout.processed` | Consignor paid | payoutId, consignorId, amount |

### Using Event Constants

```typescript
import {
  InboundEvents,
  ProcessingEvents,
  SalesEvents,
  OutboundEvents,
  DispositionEvents,
  FinanceEvents,
  InventoryEvents,
  PartsEvents,
  ThreePLEvents,
  ConsignmentEvents,
  SupplierEvents,
  SystemEvents,
  AllEvents,
  EventType,
} from '@quickwms/events';

// Use typed constants
const eventType = InboundEvents.ITEM_RECEIVED;  // 'item.received'

// Type-safe event types
function handleEvent(type: EventType) {
  // type is union of all valid event strings
}

// Get domain from event type
import { getEventDomain } from '@quickwms/events';
getEventDomain('item.graded');  // 'item'

// Get stream key
import { getStreamKeyForEvent } from '@quickwms/events';
getStreamKeyForEvent('item.graded');  // 'quickwms:events:item'
```

---

## 6. Database Schema

### Tables Created by Migration 006

#### event_store

Primary audit trail table:

```sql
CREATE TABLE event_store (
    sequence_number BIGSERIAL PRIMARY KEY,  -- Global ordering
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(255) NOT NULL,
    source VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    qlid VARCHAR(9),                        -- QuickLotz ID
    correlation_id UUID,                    -- Saga tracking
    causation_id UUID,                      -- Parent event
    user_id VARCHAR(255),
    warehouse_id VARCHAR(255),
    version INTEGER NOT NULL DEFAULT 1,
    data JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_event_store_event_type` - Query by event type
- `idx_event_store_qlid` - Item lifecycle queries
- `idx_event_store_correlation_id` - Saga tracing
- `idx_event_store_subject` - Entity queries
- `idx_event_store_created_at` - Time-based queries
- `idx_event_store_source` - Service queries

#### saga_state

Saga instance persistence:

```sql
CREATE TABLE saga_state (
    saga_id UUID PRIMARY KEY,
    saga_type VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,            -- running/completed/failed/compensated
    current_step INTEGER NOT NULL,
    current_step_name VARCHAR(255),
    correlation_id UUID NOT NULL,
    user_id VARCHAR(255),
    context_data JSONB NOT NULL,
    errors JSONB DEFAULT '[]',
    compensation_log JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    timeout_at TIMESTAMPTZ
);
```

#### event_dlq

Dead Letter Queue for failed events:

```sql
CREATE TABLE event_dlq (
    id BIGSERIAL PRIMARY KEY,
    original_event_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    failure_reason TEXT NOT NULL,
    failure_type VARCHAR(50),               -- transient/permanent/unknown
    total_attempts INTEGER,
    status VARCHAR(50),                     -- pending/processing/resolved/skipped
    entered_dlq_at TIMESTAMPTZ NOT NULL
);
```

#### idempotency_keys

Exactly-once processing:

```sql
CREATE TABLE idempotency_keys (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    operation VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,            -- processing/completed/failed
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
```

### Useful SQL Functions

```sql
-- Get complete item lifecycle
SELECT * FROM get_item_lifecycle('123456789');

-- Get all events in a saga
SELECT * FROM get_saga_trace('correlation-uuid');

-- Cleanup expired idempotency keys
SELECT cleanup_expired_idempotency_keys();
```

### Useful Views

```sql
-- Recent events (last 24 hours)
SELECT * FROM recent_events;

-- Event statistics by type
SELECT * FROM event_type_stats;

-- Currently running sagas
SELECT * FROM active_sagas;

-- Dead letter queue summary
SELECT * FROM dlq_summary;
```

---

## 7. Integration Guide

### Step 1: Install Package

```bash
cd your-service
npm install @quickwms/events
```

Or in monorepo:
```json
{
  "dependencies": {
    "@quickwms/events": "workspace:*"
  }
}
```

### Step 2: Create Event Bus Instance

```typescript
// src/events/bus.ts
import { RedisStreamEventBus } from '@quickwms/events';

export const eventBus = new RedisStreamEventBus({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  serviceName: process.env.SERVICE_NAME || 'my-service',
});
```

### Step 3: Create Publisher

```typescript
// src/events/publisher.ts
import { EventPublisher } from '@quickwms/events';
import { eventBus } from './bus';

export const publisher = new EventPublisher({
  serviceName: process.env.SERVICE_NAME || 'my-service',
  eventBus,
});
```

### Step 4: Create Subscriber

```typescript
// src/events/subscriber.ts
import { EventSubscriber } from '@quickwms/events';
import { eventBus } from './bus';

export const subscriber = new EventSubscriber(eventBus);
```

### Step 5: Register Event Handlers

```typescript
// src/events/handlers.ts
import { subscriber } from './subscriber';
import { InboundEvents, ProcessingEvents } from '@quickwms/events';

export function registerHandlers() {
  // Handle item received
  subscriber.on(InboundEvents.ITEM_RECEIVED, async (event, ctx) => {
    console.log(`Item received: ${event.data.qlid}`);
    // Create grading task...
  });

  // Handle item graded
  subscriber.on(ProcessingEvents.ITEM_GRADED, async (event, ctx) => {
    if (event.data.requiresRefurbishment) {
      // Create refurb job...
    } else {
      // Ready for listing...
    }
  });
}
```

### Step 6: Bootstrap on Startup

```typescript
// src/index.ts
import { eventBus } from './events/bus';
import { subscriber } from './events/subscriber';
import { registerHandlers } from './events/handlers';

async function bootstrap() {
  // Connect to Redis
  await eventBus.connect();

  // Register all handlers
  registerHandlers();

  // Start consuming
  await subscriber.start();

  console.log('Event consumer started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await subscriber.stop();
    process.exit(0);
  });
}

bootstrap();
```

### Step 7: Publish Events in Business Logic

```typescript
// src/services/intake.service.ts
import { publisher } from '../events/publisher';
import { InboundEvents } from '@quickwms/events';

export class IntakeService {
  async receiveItem(itemData: CreateItemInput, userId: string) {
    // 1. Save to database
    const item = await this.itemRepository.create(itemData);

    // 2. Publish event
    await publisher.publish({
      type: InboundEvents.ITEM_RECEIVED,
      qlid: item.qlid,
      subject: item.id,
      data: {
        itemId: item.id,
        qlid: item.qlid,
        sku: item.sku,
        manifestId: item.manifestId,
        condition: item.condition,
      },
      userId,
    });

    return item;
  }
}
```

---

## 8. Saga Patterns

### When to Use Sagas

Use sagas for operations that span multiple services and need to maintain consistency:

- **Order Fulfillment:** Reserve inventory → Process payment → Generate pick list → Ship
- **Auction Sale:** Close auction → Charge winner → Create order → Fulfill
- **Item Intake:** Receive manifest → Create inventory → Assign pallet → Queue grading

### Implementing a Saga

```typescript
// src/sagas/order-fulfillment.saga.ts
import {
  SagaOrchestrator,
  BaseSagaContext,
  SagaStep,
  SagaStatus,
  successResult,
  failureResult,
} from '@quickwms/events';
import { publisher } from '../events/publisher';

// Define context
interface OrderFulfillmentContext extends BaseSagaContext {
  orderId: string;
  orderNumber: string;
  items: Array<{ itemId: string; qlid: string }>;
  reservationIds: string[];
  pickListId?: string;
  shipmentId?: string;
}

// Implement saga
export class OrderFulfillmentSaga extends SagaOrchestrator<OrderFulfillmentContext> {
  get sagaType() {
    return 'OrderFulfillment';
  }

  initializeContext(input: any, sagaId: string, correlationId: string) {
    return {
      sagaId,
      sagaType: this.sagaType,
      status: SagaStatus.PENDING,
      currentStep: 0,
      currentStepName: '',
      startedAt: new Date().toISOString(),
      correlationId,
      errors: [],
      compensationLog: [],
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      items: input.items,
      reservationIds: [],
    };
  }

  getSteps(): SagaStep<OrderFulfillmentContext>[] {
    return [
      // Step 1: Reserve inventory
      {
        name: 'reserve_inventory',
        execute: async (ctx) => {
          const reservations = await this.inventoryService.reserve(ctx.items);
          ctx.reservationIds = reservations.map(r => r.id);
          return successResult({ reservationIds: ctx.reservationIds });
        },
        compensate: async (ctx) => {
          await this.inventoryService.releaseReservations(ctx.reservationIds);
          return successResult();
        },
      },

      // Step 2: Generate pick list
      {
        name: 'generate_pick_list',
        execute: async (ctx) => {
          const pickList = await this.fulfillmentService.createPickList(ctx.orderId);
          ctx.pickListId = pickList.id;
          return successResult({ pickListId: pickList.id });
        },
        compensate: async (ctx) => {
          if (ctx.pickListId) {
            await this.fulfillmentService.cancelPickList(ctx.pickListId);
          }
          return successResult();
        },
      },

      // Step 3: Create shipment
      {
        name: 'create_shipment',
        execute: async (ctx) => {
          const shipment = await this.shippingService.createShipment(ctx.orderId);
          ctx.shipmentId = shipment.id;
          return successResult({ shipmentId: shipment.id });
        },
        compensate: async (ctx) => {
          if (ctx.shipmentId) {
            await this.shippingService.cancelShipment(ctx.shipmentId);
          }
          return successResult();
        },
      },
    ];
  }
}

// Usage
const saga = new OrderFulfillmentSaga({ publisher });

const result = await saga.start({
  orderId: 'order-uuid',
  orderNumber: 'ORD-12345',
  items: [{ itemId: 'item-1', qlid: '123456789' }],
}, 'user-uuid');

if (result.status === SagaStatus.COMPLETED) {
  console.log('Order fulfilled successfully');
} else if (result.status === SagaStatus.COMPENSATED) {
  console.log('Order failed, compensations applied');
}
```

### Saga Events Published

The saga orchestrator automatically publishes events:

- `saga.OrderFulfillment.started` - Saga initiated
- `saga.OrderFulfillment.step_completed` - Each step completion
- `saga.OrderFulfillment.step_failed` - Step failure
- `saga.OrderFulfillment.compensation_completed` - Compensation success
- `saga.OrderFulfillment.completed` - Saga finished successfully
- `saga.OrderFulfillment.failed` - Saga failed (with compensation status)

---

## 9. Error Handling & Resilience

### Retry Policies

```typescript
import { executeWithRetry, defaultRetryPolicies } from '@quickwms/events';

// Use default policy
const result = await executeWithRetry(
  () => externalApi.call(),
  defaultRetryPolicies.externalApi,
  { operationName: 'fetchProductData' }
);

// Custom policy
const customPolicy = {
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
  retryableErrors: ['TIMEOUT', 'RATE_LIMITED'],
  nonRetryableErrors: ['NOT_FOUND', 'INVALID_REQUEST'],
};

await executeWithRetry(
  () => riskyOperation(),
  customPolicy,
  { operationName: 'riskyOperation', sagaId: 'saga-123' }
);
```

### Idempotency

```typescript
import { IdempotencyHandler, generateIdempotencyKey } from '@quickwms/events';
import Redis from 'ioredis';

const redis = new Redis();
const idempotency = new IdempotencyHandler({ redis });

// Generate key
const key = generateIdempotencyKey({
  sagaId: 'saga-uuid',
  step: 'reserve_inventory',
  entityId: 'order-uuid',
});

// Execute idempotently
const result = await idempotency.executeIdempotent(
  key,
  'reserve_inventory',
  async () => {
    return inventoryService.reserve(items);
  },
  3600  // TTL in seconds
);

// Check if already executed
const alreadyDone = await idempotency.isExecuted(key);

// Get cached result
const cachedResult = await idempotency.getResult(key);
```

### Dead Letter Queue

Failed events after max retries go to DLQ:

```sql
-- View pending DLQ entries
SELECT * FROM event_dlq WHERE status = 'pending';

-- Reprocess an entry
UPDATE event_dlq SET status = 'processing' WHERE id = 123;

-- Mark as resolved
UPDATE event_dlq
SET status = 'resolved',
    resolved_at = NOW(),
    resolved_by = 'admin-user',
    resolution_notes = 'Manually fixed data and reprocessed'
WHERE id = 123;

-- Skip an entry
UPDATE event_dlq
SET status = 'skipped',
    resolved_at = NOW(),
    resolved_by = 'admin-user',
    resolution_notes = 'Duplicate event, safe to skip'
WHERE id = 123;
```

---

## 10. Monitoring & Observability

### Redis Streams Monitoring

```bash
# Stream info
redis-cli XINFO STREAM quickwms:events:item

# Consumer groups
redis-cli XINFO GROUPS quickwms:events:item

# Consumers in a group
redis-cli XINFO CONSUMERS quickwms:events:item quickinventoryz-group

# Pending messages (unacknowledged)
redis-cli XPENDING quickwms:events:item quickinventoryz-group
```

### Event Bus Metrics

```typescript
const bus = new RedisStreamEventBus({ ... });

// Listen to metrics events
bus.on('published', ({ streamKey, messageId, event }) => {
  metrics.increment('events.published', { type: event.type });
});

bus.on('processed', ({ streamKey, messageId, event }) => {
  metrics.increment('events.processed', { type: event.type });
});

bus.on('processingError', ({ streamKey, error }) => {
  metrics.increment('events.errors');
});

bus.on('deadLetter', ({ streamKey, messageId }) => {
  metrics.increment('events.dead_letter');
});

// Get stream info programmatically
const info = await bus.getStreamInfo('quickwms:events:item');
console.log('Stream length:', info.length);
console.log('Consumer groups:', info.groups);

const groups = await bus.getGroupInfo('quickwms:events:item');
console.log('Pending messages:', groups[0].pending);
```

### SQL Queries for Monitoring

```sql
-- Events per hour (last 24h)
SELECT
    date_trunc('hour', created_at) as hour,
    event_type,
    COUNT(*) as count
FROM event_store
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', created_at), event_type
ORDER BY hour DESC, count DESC;

-- Active sagas with age
SELECT
    saga_type,
    status,
    current_step_name,
    EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as age_minutes
FROM saga_state
WHERE status IN ('running', 'compensating')
ORDER BY started_at;

-- DLQ breakdown
SELECT
    event_type,
    failure_type,
    COUNT(*) as count
FROM event_dlq
WHERE status = 'pending'
GROUP BY event_type, failure_type;

-- Item lifecycle trace
SELECT * FROM get_item_lifecycle('123456789');
```

---

## 11. Migration Strategy

### Phase 1: Foundation (Completed)

- [x] Create `@quickwms/events` package
- [x] Implement Redis Streams event bus
- [x] Implement PostgreSQL event store
- [x] Create database migration
- [x] Add saga orchestrator

### Phase 2: Pilot Services

1. **QuickInventoryz** - First publisher
   - Add event publishing on item CRUD
   - Maintain REST API (dual-write)

2. **QuickInsightz** - First subscriber
   - Subscribe to all `item.*` events
   - Real-time analytics updates

### Phase 3: Critical Path

3. **Inbound Flow**
   - QuickIntakez → QuickPalletz → QuickGradez

4. **Processing Flow**
   - QuickGradez → QuickRefurbz → QuickListz

5. **Sales Flow**
   - QuickListz → QuickAuctionz → QuickBidz

### Phase 4: Outbound & Finance

6. **Order Fulfillment Saga**
7. **QuickFulfillment → QuickLoadz**
8. **QuickFinancez subscriptions**

### Phase 5: Disposition & 3PL

9. **Item Disposition (choreography)**
10. **Quick3PLz client events**

### Dual-Write Pattern

During migration, services use dual-write:

```typescript
async function receiveItem(data: ItemInput) {
  // 1. Database write (existing)
  const item = await db.items.create(data);

  // 2. Event publish (new)
  await publisher.publish({
    type: InboundEvents.ITEM_RECEIVED,
    qlid: item.qlid,
    data: { itemId: item.id, ... },
  });

  // 3. REST call to dependent service (existing - will be removed later)
  await gradingApi.createTask(item.id);

  return item;
}
```

Eventually, step 3 is removed when QuickGradez subscribes to events.

---

## 12. Best Practices

### Event Design

1. **Use past tense** - Events describe what happened: `item.received`, not `item.receive`

2. **Include enough context** - Events should be self-contained:
   ```typescript
   // Good
   { type: 'item.graded', data: { itemId, qlid, grade, condition, gradedBy, gradedAt } }

   // Bad - requires lookup
   { type: 'item.graded', data: { itemId } }
   ```

3. **Version your schemas** - Use the `version` field for evolution:
   ```typescript
   { type: 'item.graded', version: 2, data: { ... } }
   ```

4. **Always include QLID** - For item-related events, always set `qlid`:
   ```typescript
   await publisher.publish({
     type: 'item.sold',
     qlid: '123456789',  // Always include!
     data: { ... },
   });
   ```

### Publishing

1. **Store before publish** - Enable `storeBeforePublish` for durability
2. **Use correlation IDs** - For related events, use `publishCorrelated()`
3. **Set userId** - Always track who initiated the action

### Subscribing

1. **Handle duplicates** - Events may be delivered more than once
2. **Process idempotently** - Use the `idempotency` utilities
3. **Keep handlers fast** - Avoid long-running operations in handlers
4. **Use specific event types** - Avoid `*` wildcards in production

### Error Handling

1. **Let errors bubble** - The bus handles retries
2. **Log with correlation ID** - For distributed tracing
3. **Monitor DLQ** - Set up alerts for DLQ growth

### Performance

1. **Batch when possible** - Use `publishBatch()` for multiple events
2. **Use consumer groups** - Scale horizontally by adding instances
3. **Trim streams** - Set appropriate `maxStreamLength`

---

## 13. API Reference

### Event Bus

```typescript
class RedisStreamEventBus extends EventEmitter {
  constructor(config: RedisStreamEventBusConfig)
  connect(): Promise<void>
  publish<T>(event: EventEnvelope<T>): Promise<string>
  publishBatch<T>(events: EventEnvelope<T>[]): Promise<string[]>
  subscribe(eventTypes: string[], handler: EventHandler): Promise<void>
  start(): Promise<void>
  shutdown(): Promise<void>
  getStreamInfo(streamKey: string): Promise<StreamInfo>
  getGroupInfo(streamKey: string): Promise<GroupInfo[]>
}
```

### Event Publisher

```typescript
class EventPublisher {
  constructor(config: EventPublisherConfig)
  publish<T>(options: CreateEventOptions<T>): Promise<EventEnvelope<T>>
  publishBatch<T>(events: CreateEventOptions<T>[]): Promise<EventEnvelope<T>[]>
  publishCorrelated<T>(options: CreateEventOptions<T>, parent: EventEnvelope): Promise<EventEnvelope<T>>
  publishItemEvent<T>(type: string, qlid: string, itemId: string, data: T): Promise<EventEnvelope<T>>
  publishOrderEvent<T>(type: string, orderId: string, data: T): Promise<EventEnvelope<T>>
}
```

### Event Subscriber

```typescript
class EventSubscriber {
  constructor(bus: RedisStreamEventBus)
  on<T>(eventType: string, handler: TypedEventHandler<T>, options?: SubscriptionOptions): this
  onMultiple<T>(eventTypes: string[], handler: TypedEventHandler<T>, options?: SubscriptionOptions): this
  onDomain(domain: string, handler: TypedEventHandler, options?: SubscriptionOptions): this
  start(): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
}
```

### Event Store

```typescript
class PostgresEventStore {
  constructor(config: PostgresEventStoreConfig)
  initialize(): Promise<void>
  append(event: EventEnvelope): Promise<bigint>
  appendBatch(events: EventEnvelope[]): Promise<bigint[]>
  getBySubject(subject: string, options?: EventQueryOptions): Promise<EventEnvelope[]>
  getByQlid(qlid: string, options?: EventQueryOptions): Promise<EventEnvelope[]>
  getByCorrelationId(correlationId: string, options?: EventQueryOptions): Promise<EventEnvelope[]>
  getByTimeRange(options: TimeRangeOptions): Promise<EventEnvelope[]>
  getById(eventId: string): Promise<EventEnvelope | null>
  getCount(eventType?: string): Promise<number>
  getLatestSequence(): Promise<bigint | null>
  close(): Promise<void>
}
```

### Saga Orchestrator

```typescript
abstract class SagaOrchestrator<TContext extends BaseSagaContext> {
  abstract get sagaType(): string
  abstract getSteps(): SagaStep<TContext>[]
  abstract initializeContext(input: unknown, sagaId: string, correlationId: string): TContext
  start(input: unknown, userId?: string): Promise<TContext>
}

interface SagaStep<TContext> {
  name: string
  execute: (context: TContext) => Promise<StepResult>
  compensate: (context: TContext) => Promise<StepResult>
  timeout?: number
  retryable?: boolean
  maxRetries?: number
}
```

---

## Conclusion

The `@quickwms/events` package provides a complete Event-Driven Architecture foundation for QuickWMS. Key benefits:

1. **Decoupled services** - Services communicate via events, not direct calls
2. **Full audit trail** - Every event stored in PostgreSQL
3. **Distributed transactions** - Saga patterns with automatic compensation
4. **Real-time updates** - Redis Streams for immediate event delivery
5. **Resilience** - Retry policies, DLQ, and idempotency built-in
6. **Type safety** - Full TypeScript support with Zod validation

For questions or issues, refer to the source code at:
`/packages/events/src/`

---

*Document generated: February 2026*
*Package version: 1.0.0*
