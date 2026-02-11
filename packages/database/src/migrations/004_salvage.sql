-- ============================================================================
-- QuickWMS Database Migration: 004_salvage.sql
-- Salvage and recycling management tables
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE salvage_disposition AS ENUM (
        'recycle_electronics',
        'recycle_metal',
        'recycle_plastic',
        'donate',
        'parts_harvest',
        'auction',
        'liquidate',
        'dispose',
        'pending'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE salvage_status AS ENUM (
        'pending_review',
        'approved',
        'in_processing',
        'completed',
        'on_hold'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE parts_status AS ENUM (
        'available',
        'reserved',
        'sold',
        'used_internal',
        'disposed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SALVAGE PARTNERS TABLE (Recyclers, Donation Centers, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_code VARCHAR(20) UNIQUE NOT NULL,

    -- Business info
    name VARCHAR(255) NOT NULL,
    partner_type VARCHAR(50) NOT NULL,           -- recycler, donation, auction, parts_buyer

    -- Contact
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',

    -- Certifications (for e-waste recyclers)
    r2_certified BOOLEAN DEFAULT false,
    e_stewards_certified BOOLEAN DEFAULT false,
    certifications JSONB,                        -- Other certifications

    -- Capabilities
    accepts_categories TEXT[],                   -- Electronics, Appliances, Furniture, etc.
    pickup_available BOOLEAN DEFAULT false,
    minimum_weight_lbs INTEGER,

    -- Pricing
    pays_per_lb BOOLEAN DEFAULT false,
    rate_per_lb DECIMAL(8,4),
    pickup_fee DECIMAL(10,2),

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Stats
    total_weight_sent_lbs DECIMAL(12,2) DEFAULT 0,
    total_items_sent INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- Insert default partners
INSERT INTO salvage_partners (partner_code, name, partner_type) VALUES
    ('RCY-001', 'Local E-Waste Recycler', 'recycler'),
    ('DON-001', 'Goodwill', 'donation'),
    ('DON-002', 'Habitat ReStore', 'donation')
ON CONFLICT (partner_code) DO NOTHING;

-- ============================================================================
-- SALVAGE BATCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,    -- SLV-2024-001

    -- Disposition
    disposition salvage_disposition NOT NULL,
    partner_id UUID REFERENCES salvage_partners(id),

    -- Batch details
    description TEXT,
    category VARCHAR(100),

    -- Counts and weights
    item_count INTEGER DEFAULT 0,
    total_weight_lbs DECIMAL(10,2) DEFAULT 0,
    pallet_count INTEGER DEFAULT 0,

    -- Values
    original_msrp DECIMAL(12,2) DEFAULT 0,
    original_cost DECIMAL(12,2) DEFAULT 0,
    salvage_value DECIMAL(12,2) DEFAULT 0,       -- What we receive/recover

    -- Status
    status salvage_status DEFAULT 'pending_review',

    -- Pickup/Shipping
    scheduled_date DATE,
    pickup_date DATE,
    pickup_reference VARCHAR(100),

    -- Documentation
    certificate_of_destruction BOOLEAN DEFAULT false,
    cod_url VARCHAR(500),
    donation_receipt_url VARCHAR(500),

    -- Location
    staging_location VARCHAR(50),

    -- Approval
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,

    -- Audit
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- SALVAGE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES salvage_batches(id),
    item_id UUID REFERENCES items(id),

    -- Item details (copied for historical record)
    qlid VARCHAR(20),
    title VARCHAR(500),
    brand VARCHAR(100),
    category VARCHAR(100),
    upc VARCHAR(20),
    serial_number VARCHAR(100),

    -- Original values
    msrp DECIMAL(10,2),
    cost DECIMAL(10,2),

    -- Condition at time of salvage
    condition_notes TEXT,
    reason_for_salvage VARCHAR(255),             -- Non-functional, Missing parts, Obsolete, etc.

    -- Weight
    weight_lbs DECIMAL(8,2),

    -- Disposition
    disposition salvage_disposition,

    -- If parts harvested
    parts_harvested BOOLEAN DEFAULT false,

    -- Environmental
    contains_hazmat BOOLEAN DEFAULT false,
    hazmat_type VARCHAR(100),
    contains_battery BOOLEAN DEFAULT false,
    battery_type VARCHAR(50),

    -- Audit
    salvaged_by VARCHAR(100),
    salvaged_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- HARVESTED PARTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_number VARCHAR(50) UNIQUE NOT NULL,     -- PRT-000001

    -- Source item
    source_item_id UUID REFERENCES items(id),
    source_salvage_item_id UUID REFERENCES salvage_items(id),

    -- Part details
    part_name VARCHAR(255) NOT NULL,
    part_type VARCHAR(100),                      -- Screen, Battery, Logic Board, etc.
    compatible_models TEXT[],

    -- Product info (what it came from)
    source_brand VARCHAR(100),
    source_model VARCHAR(100),

    -- Identifiers
    manufacturer_part_number VARCHAR(100),

    -- Condition
    condition VARCHAR(50),                       -- New, Like New, Good, Fair, For Parts
    condition_notes TEXT,
    is_tested BOOLEAN DEFAULT false,
    is_functional BOOLEAN,

    -- Value
    estimated_value DECIMAL(10,2),
    list_price DECIMAL(10,2),
    sold_price DECIMAL(10,2),

    -- Status
    status parts_status DEFAULT 'available',

    -- Location
    location VARCHAR(50),
    bin_location VARCHAR(50),

    -- Sale info
    sold_to VARCHAR(255),
    sold_date DATE,
    listing_id UUID REFERENCES listings(id),

    -- Audit
    harvested_by VARCHAR(100),
    harvested_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- SALVAGE TRANSACTIONS TABLE (Financial tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES salvage_batches(id),
    partner_id UUID REFERENCES salvage_partners(id),

    -- Transaction type
    transaction_type VARCHAR(50) NOT NULL,       -- recycling_payment, donation_credit, parts_sale, disposal_fee

    -- Amount (positive = revenue, negative = cost)
    amount DECIMAL(12,2) NOT NULL,

    -- Reference
    reference_number VARCHAR(100),
    description TEXT,

    -- Date
    transaction_date DATE DEFAULT CURRENT_DATE,

    -- Audit
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- ENVIRONMENTAL TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_environmental_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES salvage_batches(id),
    partner_id UUID REFERENCES salvage_partners(id),

    -- Period
    record_date DATE NOT NULL,
    period_start DATE,
    period_end DATE,

    -- Materials recycled (lbs)
    electronics_lbs DECIMAL(10,2) DEFAULT 0,
    metals_lbs DECIMAL(10,2) DEFAULT 0,
    plastics_lbs DECIMAL(10,2) DEFAULT 0,
    glass_lbs DECIMAL(10,2) DEFAULT 0,
    batteries_lbs DECIMAL(10,2) DEFAULT 0,
    other_lbs DECIMAL(10,2) DEFAULT 0,
    total_lbs DECIMAL(10,2) GENERATED ALWAYS AS (
        electronics_lbs + metals_lbs + plastics_lbs + glass_lbs + batteries_lbs + other_lbs
    ) STORED,

    -- Items
    items_recycled INTEGER DEFAULT 0,
    items_donated INTEGER DEFAULT 0,
    items_disposed INTEGER DEFAULT 0,

    -- Diversion rate
    landfill_diversion_rate DECIMAL(5,2),        -- Percentage diverted from landfill

    -- Certifications
    certificate_url VARCHAR(500),

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- SALVAGE REVIEW QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_review_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id),

    -- Reason for review
    review_reason VARCHAR(255) NOT NULL,         -- Failed grading, Customer return, Damage, Age, etc.

    -- Suggested disposition
    suggested_disposition salvage_disposition,

    -- Values
    current_value DECIMAL(10,2),
    salvage_value_estimate DECIMAL(10,2),
    repair_cost_estimate DECIMAL(10,2),

    -- Priority
    priority VARCHAR(20) DEFAULT 'normal',       -- low, normal, high, urgent

    -- Status
    status VARCHAR(50) DEFAULT 'pending',        -- pending, reviewed, approved, rejected

    -- Review
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Decision
    final_disposition salvage_disposition,
    batch_id UUID REFERENCES salvage_batches(id),

    -- Audit
    submitted_by VARCHAR(100),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DONATION TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS salvage_donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES salvage_batches(id),
    partner_id UUID NOT NULL REFERENCES salvage_partners(id),

    -- Donation details
    donation_number VARCHAR(50) UNIQUE NOT NULL,
    donation_date DATE NOT NULL,

    -- Items
    item_count INTEGER NOT NULL,

    -- Values for tax purposes
    fair_market_value DECIMAL(12,2),
    original_cost DECIMAL(12,2),

    -- Receipt
    receipt_number VARCHAR(100),
    receipt_url VARCHAR(500),

    -- Tax deduction tracking
    tax_year INTEGER,
    claimed BOOLEAN DEFAULT false,

    -- Notes
    notes TEXT,

    -- Audit
    donated_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Salvage Partners
CREATE INDEX IF NOT EXISTS idx_salvage_partners_type ON salvage_partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_salvage_partners_active ON salvage_partners(is_active);

-- Salvage Batches
CREATE INDEX IF NOT EXISTS idx_salvage_batches_number ON salvage_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_salvage_batches_status ON salvage_batches(status);
CREATE INDEX IF NOT EXISTS idx_salvage_batches_disposition ON salvage_batches(disposition);
CREATE INDEX IF NOT EXISTS idx_salvage_batches_partner ON salvage_batches(partner_id);
CREATE INDEX IF NOT EXISTS idx_salvage_batches_date ON salvage_batches(created_at);

-- Salvage Items
CREATE INDEX IF NOT EXISTS idx_salvage_items_batch ON salvage_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_salvage_items_item ON salvage_items(item_id);
CREATE INDEX IF NOT EXISTS idx_salvage_items_qlid ON salvage_items(qlid);
CREATE INDEX IF NOT EXISTS idx_salvage_items_disposition ON salvage_items(disposition);

-- Salvage Parts
CREATE INDEX IF NOT EXISTS idx_salvage_parts_number ON salvage_parts(part_number);
CREATE INDEX IF NOT EXISTS idx_salvage_parts_source ON salvage_parts(source_item_id);
CREATE INDEX IF NOT EXISTS idx_salvage_parts_status ON salvage_parts(status);
CREATE INDEX IF NOT EXISTS idx_salvage_parts_type ON salvage_parts(part_type);

-- Salvage Transactions
CREATE INDEX IF NOT EXISTS idx_salvage_transactions_batch ON salvage_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_salvage_transactions_partner ON salvage_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_salvage_transactions_type ON salvage_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_salvage_transactions_date ON salvage_transactions(transaction_date);

-- Review Queue
CREATE INDEX IF NOT EXISTS idx_salvage_review_queue_item ON salvage_review_queue(item_id);
CREATE INDEX IF NOT EXISTS idx_salvage_review_queue_status ON salvage_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_salvage_review_queue_priority ON salvage_review_queue(priority);

-- Donations
CREATE INDEX IF NOT EXISTS idx_salvage_donations_batch ON salvage_donations(batch_id);
CREATE INDEX IF NOT EXISTS idx_salvage_donations_partner ON salvage_donations(partner_id);
CREATE INDEX IF NOT EXISTS idx_salvage_donations_date ON salvage_donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_salvage_donations_tax_year ON salvage_donations(tax_year);

-- ============================================================================
-- SEQUENCES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS salvage_batch_seq START 1;
CREATE SEQUENCE IF NOT EXISTS salvage_part_seq START 1;
CREATE SEQUENCE IF NOT EXISTS donation_seq START 1;

-- ============================================================================
-- ID GENERATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_salvage_batch_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'SLV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('salvage_batch_seq')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_part_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'PRT-' || LPAD(nextval('salvage_part_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_donation_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'DON-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('donation_seq')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO UPDATE ITEM STATUS WHEN ADDED TO SALVAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_item_status_on_salvage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE items
    SET status = 'salvage',
        updated_at = NOW()
    WHERE id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_item_on_salvage ON salvage_items;
CREATE TRIGGER trg_update_item_on_salvage
    AFTER INSERT ON salvage_items
    FOR EACH ROW
    EXECUTE FUNCTION update_item_status_on_salvage();

-- ============================================================================
-- TRIGGER TO UPDATE BATCH TOTALS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_salvage_batch_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE salvage_batches
    SET item_count = (SELECT COUNT(*) FROM salvage_items WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
        total_weight_lbs = (SELECT COALESCE(SUM(weight_lbs), 0) FROM salvage_items WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
        original_msrp = (SELECT COALESCE(SUM(msrp), 0) FROM salvage_items WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
        original_cost = (SELECT COALESCE(SUM(cost), 0) FROM salvage_items WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_batch_totals_insert ON salvage_items;
CREATE TRIGGER trg_update_batch_totals_insert
    AFTER INSERT ON salvage_items
    FOR EACH ROW
    WHEN (NEW.batch_id IS NOT NULL)
    EXECUTE FUNCTION update_salvage_batch_totals();

DROP TRIGGER IF EXISTS trg_update_batch_totals_delete ON salvage_items;
CREATE TRIGGER trg_update_batch_totals_delete
    AFTER DELETE ON salvage_items
    FOR EACH ROW
    WHEN (OLD.batch_id IS NOT NULL)
    EXECUTE FUNCTION update_salvage_batch_totals();

-- ============================================================================
-- VIEW FOR SALVAGE SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW v_salvage_summary AS
SELECT
    DATE_TRUNC('month', sb.created_at) AS month,
    sb.disposition,
    COUNT(DISTINCT sb.id) AS batch_count,
    SUM(sb.item_count) AS total_items,
    SUM(sb.total_weight_lbs) AS total_weight_lbs,
    SUM(sb.original_cost) AS total_original_cost,
    SUM(sb.salvage_value) AS total_recovered_value
FROM salvage_batches sb
WHERE sb.status = 'completed'
GROUP BY DATE_TRUNC('month', sb.created_at), sb.disposition
ORDER BY month DESC, sb.disposition;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE salvage_partners IS 'Recyclers, donation centers, and other salvage partners';
COMMENT ON TABLE salvage_batches IS 'Batches of items sent for recycling, donation, or disposal';
COMMENT ON TABLE salvage_items IS 'Individual items within salvage batches';
COMMENT ON TABLE salvage_parts IS 'Parts harvested from salvage items for resale or internal use';
COMMENT ON TABLE salvage_transactions IS 'Financial transactions related to salvage operations';
COMMENT ON TABLE salvage_environmental_records IS 'Environmental impact tracking for sustainability reporting';
COMMENT ON TABLE salvage_review_queue IS 'Queue for items pending salvage review';
COMMENT ON TABLE salvage_donations IS 'Donation records for tax purposes';
