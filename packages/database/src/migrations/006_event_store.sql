-- Migration: 006_event_store
-- Description: Event Store for Event-Driven Architecture (EDA)
-- Purpose: Durable storage for domain events with audit trail capabilities
-- Part of: @quickwms/events package

-- ============================================================================
-- Event Store Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_store (
    -- Primary key: monotonically increasing sequence for ordering
    sequence_number BIGSERIAL PRIMARY KEY,

    -- CloudEvents standard fields
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(255) NOT NULL,
    source VARCHAR(255) NOT NULL,

    -- Entity reference
    subject VARCHAR(255),

    -- QuickWMS specific extensions
    qlid VARCHAR(9),  -- 9-digit QuickLotz global ID
    correlation_id UUID,  -- Saga/distributed transaction tracking
    causation_id UUID,  -- Event that caused this event
    user_id VARCHAR(255),  -- User who triggered the action
    warehouse_id VARCHAR(255),  -- Multi-warehouse support

    -- Schema versioning
    version INTEGER NOT NULL DEFAULT 1,

    -- Event payload (JSONB for efficient querying)
    data JSONB NOT NULL,

    -- Optional metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE event_store IS 'Durable event store for EDA - stores all domain events for audit and replay';
COMMENT ON COLUMN event_store.sequence_number IS 'Global sequence number for event ordering';
COMMENT ON COLUMN event_store.event_id IS 'Unique event identifier (UUID v4)';
COMMENT ON COLUMN event_store.event_type IS 'Event type (e.g., item.graded, order.shipped)';
COMMENT ON COLUMN event_store.source IS 'Service that produced the event';
COMMENT ON COLUMN event_store.subject IS 'Primary entity ID (e.g., item ID, order ID)';
COMMENT ON COLUMN event_store.qlid IS '9-digit QuickLotz global ID for item tracking';
COMMENT ON COLUMN event_store.correlation_id IS 'Correlation ID for saga/distributed transaction tracking';
COMMENT ON COLUMN event_store.causation_id IS 'ID of the event that caused this event';
COMMENT ON COLUMN event_store.user_id IS 'User who triggered the action';
COMMENT ON COLUMN event_store.warehouse_id IS 'Warehouse identifier for multi-warehouse support';
COMMENT ON COLUMN event_store.version IS 'Event schema version for evolution';
COMMENT ON COLUMN event_store.data IS 'Event-specific payload as JSONB';
COMMENT ON COLUMN event_store.metadata IS 'Optional metadata (retry count, environment, etc.)';

-- ============================================================================
-- Indexes for Common Query Patterns
-- ============================================================================

-- Index for event type queries (e.g., get all 'item.graded' events)
CREATE INDEX IF NOT EXISTS idx_event_store_event_type
    ON event_store(event_type);

-- Index for QLID queries (item lifecycle tracking)
CREATE INDEX IF NOT EXISTS idx_event_store_qlid
    ON event_store(qlid)
    WHERE qlid IS NOT NULL;

-- Index for correlation ID queries (saga tracing)
CREATE INDEX IF NOT EXISTS idx_event_store_correlation_id
    ON event_store(correlation_id)
    WHERE correlation_id IS NOT NULL;

-- Index for subject queries (entity-specific events)
CREATE INDEX IF NOT EXISTS idx_event_store_subject
    ON event_store(subject)
    WHERE subject IS NOT NULL;

-- Index for time-based queries (debugging, replay)
CREATE INDEX IF NOT EXISTS idx_event_store_created_at
    ON event_store(created_at);

-- Index for source service queries
CREATE INDEX IF NOT EXISTS idx_event_store_source
    ON event_store(source);

-- Compound index for QLID + event type (common pattern)
CREATE INDEX IF NOT EXISTS idx_event_store_qlid_type
    ON event_store(qlid, event_type)
    WHERE qlid IS NOT NULL;

-- Compound index for time range + event type (analytics)
CREATE INDEX IF NOT EXISTS idx_event_store_created_at_type
    ON event_store(created_at, event_type);

-- ============================================================================
-- Saga State Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS saga_state (
    -- Primary key
    saga_id UUID PRIMARY KEY,

    -- Saga identification
    saga_type VARCHAR(255) NOT NULL,

    -- Current state
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    current_step INTEGER NOT NULL DEFAULT 0,
    current_step_name VARCHAR(255),

    -- Correlation for event tracking
    correlation_id UUID NOT NULL,

    -- User context
    user_id VARCHAR(255),
    warehouse_id VARCHAR(255),

    -- Saga input data
    input_data JSONB,

    -- Current context state
    context_data JSONB NOT NULL DEFAULT '{}',

    -- Error tracking
    errors JSONB DEFAULT '[]',

    -- Compensation log
    compensation_log JSONB DEFAULT '[]',

    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timeout tracking
    timeout_at TIMESTAMPTZ,

    CONSTRAINT saga_state_status_check CHECK (
        status IN ('pending', 'running', 'completed', 'compensating', 'compensated', 'failed')
    )
);

-- Add comments
COMMENT ON TABLE saga_state IS 'Saga state persistence for distributed transaction management';
COMMENT ON COLUMN saga_state.saga_id IS 'Unique saga instance identifier';
COMMENT ON COLUMN saga_state.saga_type IS 'Type of saga (e.g., OrderFulfillmentSaga)';
COMMENT ON COLUMN saga_state.status IS 'Current saga status';
COMMENT ON COLUMN saga_state.current_step IS 'Current step index';
COMMENT ON COLUMN saga_state.current_step_name IS 'Current step name';
COMMENT ON COLUMN saga_state.correlation_id IS 'Correlation ID for event tracking';
COMMENT ON COLUMN saga_state.context_data IS 'Current saga context state';
COMMENT ON COLUMN saga_state.errors IS 'Array of errors encountered';
COMMENT ON COLUMN saga_state.compensation_log IS 'Log of compensation actions';

-- Indexes for saga state
CREATE INDEX IF NOT EXISTS idx_saga_state_status
    ON saga_state(status);

CREATE INDEX IF NOT EXISTS idx_saga_state_saga_type
    ON saga_state(saga_type);

CREATE INDEX IF NOT EXISTS idx_saga_state_correlation_id
    ON saga_state(correlation_id);

CREATE INDEX IF NOT EXISTS idx_saga_state_started_at
    ON saga_state(started_at);

-- Index for finding timed out sagas
CREATE INDEX IF NOT EXISTS idx_saga_state_timeout
    ON saga_state(timeout_at)
    WHERE status = 'running' AND timeout_at IS NOT NULL;

-- ============================================================================
-- Dead Letter Queue Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_dlq (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,

    -- Original event info
    original_event_id UUID NOT NULL,
    original_stream_key VARCHAR(255) NOT NULL,
    original_message_id VARCHAR(255),

    -- Event data
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,

    -- Failure context
    failure_reason TEXT NOT NULL,
    failure_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
    last_error_message TEXT,
    last_error_stack TEXT,

    -- Retry history
    attempt_history JSONB DEFAULT '[]',
    total_attempts INTEGER NOT NULL DEFAULT 0,

    -- Source/target tracking
    source_service VARCHAR(255),
    target_service VARCHAR(255),

    -- Resolution tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255),
    resolution_notes TEXT,

    -- Timestamps
    entered_dlq_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_dlq_status_check CHECK (
        status IN ('pending', 'processing', 'resolved', 'skipped')
    ),
    CONSTRAINT event_dlq_failure_type_check CHECK (
        failure_type IN ('transient', 'permanent', 'unknown')
    )
);

-- Add comments
COMMENT ON TABLE event_dlq IS 'Dead Letter Queue for failed event processing';
COMMENT ON COLUMN event_dlq.original_event_id IS 'ID of the original event that failed';
COMMENT ON COLUMN event_dlq.failure_reason IS 'Reason for the failure';
COMMENT ON COLUMN event_dlq.failure_type IS 'Classification of failure (transient/permanent/unknown)';
COMMENT ON COLUMN event_dlq.attempt_history IS 'History of processing attempts';
COMMENT ON COLUMN event_dlq.status IS 'Current DLQ entry status';

-- Indexes for DLQ
CREATE INDEX IF NOT EXISTS idx_event_dlq_status
    ON event_dlq(status);

CREATE INDEX IF NOT EXISTS idx_event_dlq_event_type
    ON event_dlq(event_type);

CREATE INDEX IF NOT EXISTS idx_event_dlq_entered_at
    ON event_dlq(entered_dlq_at);

CREATE INDEX IF NOT EXISTS idx_event_dlq_original_event
    ON event_dlq(original_event_id);

-- ============================================================================
-- Idempotency Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
    -- Composite key
    idempotency_key VARCHAR(255) PRIMARY KEY,

    -- Operation info
    operation VARCHAR(255) NOT NULL,

    -- Execution state
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    result JSONB,
    error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT idempotency_keys_status_check CHECK (
        status IN ('processing', 'completed', 'failed')
    )
);

-- Add comments
COMMENT ON TABLE idempotency_keys IS 'Idempotency tracking for exactly-once processing';
COMMENT ON COLUMN idempotency_keys.idempotency_key IS 'Unique key for idempotent operation';
COMMENT ON COLUMN idempotency_keys.operation IS 'Operation name';
COMMENT ON COLUMN idempotency_keys.status IS 'Execution status';
COMMENT ON COLUMN idempotency_keys.result IS 'Cached result for completed operations';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'When this key expires';

-- Index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
    ON idempotency_keys(expires_at);

-- ============================================================================
-- Event Store Views
-- ============================================================================

-- View: Recent events (last 24 hours)
CREATE OR REPLACE VIEW recent_events AS
SELECT
    sequence_number,
    event_id,
    event_type,
    source,
    subject,
    qlid,
    correlation_id,
    created_at
FROM event_store
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY sequence_number DESC;

COMMENT ON VIEW recent_events IS 'Events from the last 24 hours';

-- View: Event type statistics
CREATE OR REPLACE VIEW event_type_stats AS
SELECT
    event_type,
    source,
    COUNT(*) as event_count,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event
FROM event_store
GROUP BY event_type, source
ORDER BY event_count DESC;

COMMENT ON VIEW event_type_stats IS 'Statistics by event type and source';

-- View: Active sagas
CREATE OR REPLACE VIEW active_sagas AS
SELECT
    saga_id,
    saga_type,
    status,
    current_step_name,
    started_at,
    EXTRACT(EPOCH FROM (NOW() - started_at)) as age_seconds,
    timeout_at,
    CASE
        WHEN timeout_at IS NOT NULL AND NOW() > timeout_at THEN true
        ELSE false
    END as is_timed_out
FROM saga_state
WHERE status IN ('running', 'compensating')
ORDER BY started_at ASC;

COMMENT ON VIEW active_sagas IS 'Currently running or compensating sagas';

-- View: DLQ summary
CREATE OR REPLACE VIEW dlq_summary AS
SELECT
    status,
    failure_type,
    event_type,
    COUNT(*) as entry_count,
    MIN(entered_dlq_at) as oldest_entry,
    MAX(entered_dlq_at) as newest_entry
FROM event_dlq
GROUP BY status, failure_type, event_type
ORDER BY entry_count DESC;

COMMENT ON VIEW dlq_summary IS 'Dead Letter Queue summary by status and failure type';

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: Get item lifecycle by QLID
CREATE OR REPLACE FUNCTION get_item_lifecycle(p_qlid VARCHAR(9))
RETURNS TABLE (
    sequence_number BIGINT,
    event_type VARCHAR(255),
    source VARCHAR(255),
    created_at TIMESTAMPTZ,
    data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.sequence_number,
        e.event_type,
        e.source,
        e.created_at,
        e.data
    FROM event_store e
    WHERE e.qlid = p_qlid
    ORDER BY e.sequence_number ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_item_lifecycle IS 'Get complete event history for an item by QLID';

-- Function: Get saga trace by correlation ID
CREATE OR REPLACE FUNCTION get_saga_trace(p_correlation_id UUID)
RETURNS TABLE (
    sequence_number BIGINT,
    event_type VARCHAR(255),
    source VARCHAR(255),
    created_at TIMESTAMPTZ,
    data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.sequence_number,
        e.event_type,
        e.source,
        e.created_at,
        e.data
    FROM event_store e
    WHERE e.correlation_id = p_correlation_id
    ORDER BY e.sequence_number ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_saga_trace IS 'Get all events for a saga/distributed transaction';

-- Function: Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS 'Remove expired idempotency keys (call periodically)';

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Update saga_state.updated_at on changes
CREATE OR REPLACE FUNCTION update_saga_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_saga_state_updated_at
    BEFORE UPDATE ON saga_state
    FOR EACH ROW
    EXECUTE FUNCTION update_saga_updated_at();

-- ============================================================================
-- Partitioning (Optional - for high volume)
-- ============================================================================

-- Note: If event volume exceeds 10M events/month, consider partitioning:
--
-- CREATE TABLE event_store (
--     sequence_number BIGSERIAL,
--     ...
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- ) PARTITION BY RANGE (created_at);
--
-- CREATE TABLE event_store_2024_01 PARTITION OF event_store
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
--
-- This migration creates the table without partitioning for simplicity.
-- Add partitioning when needed based on volume.

-- ============================================================================
-- Grants (adjust based on your database users)
-- ============================================================================

-- Example grants (uncomment and modify as needed):
-- GRANT SELECT, INSERT ON event_store TO quickwms_app;
-- GRANT SELECT, INSERT, UPDATE ON saga_state TO quickwms_app;
-- GRANT SELECT, INSERT, UPDATE ON event_dlq TO quickwms_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO quickwms_app;

-- ============================================================================
-- End of Migration
-- ============================================================================
