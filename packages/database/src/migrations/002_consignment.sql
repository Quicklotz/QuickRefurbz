-- ============================================================================
-- QuickWMS Database Migration: 002_consignment.sql
-- Consignment program tables for managing consigned inventory
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE consignment_status AS ENUM (
        'pending',
        'active',
        'on_hold',
        'closed',
        'terminated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE consignment_item_status AS ENUM (
        'received',
        'processing',
        'listed',
        'sold',
        'returned_to_owner',
        'disposed',
        'in_dispute'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM (
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CONSIGNORS TABLE (People/companies who consign inventory to us)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consignors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consignor_code VARCHAR(20) UNIQUE NOT NULL,  -- CON-001

    -- Business info
    company_name VARCHAR(255),
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',

    -- Tax info
    tax_id VARCHAR(50),                          -- EIN or SSN
    w9_on_file BOOLEAN DEFAULT false,
    w9_date DATE,

    -- Payment info
    payment_method VARCHAR(50) DEFAULT 'check',  -- check, ach, paypal, zelle
    payment_email VARCHAR(255),
    bank_name VARCHAR(100),
    bank_routing VARCHAR(20),
    bank_account VARCHAR(50),
    paypal_email VARCHAR(255),
    zelle_email VARCHAR(255),

    -- Agreement terms
    default_commission_rate DECIMAL(5,2) DEFAULT 30.00,  -- Our commission %
    minimum_payout DECIMAL(10,2) DEFAULT 25.00,
    payout_frequency VARCHAR(20) DEFAULT 'monthly',      -- weekly, biweekly, monthly
    agreement_signed_date DATE,
    agreement_expires_date DATE,

    -- Status
    status consignment_status DEFAULT 'pending',

    -- Stats
    total_items_consigned INTEGER DEFAULT 0,
    total_items_sold INTEGER DEFAULT 0,
    total_sales DECIMAL(12,2) DEFAULT 0,
    total_paid_out DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,

    -- Notes
    notes TEXT,

    -- Audit
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- CONSIGNMENT AGREEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS consignment_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agreement_number VARCHAR(50) UNIQUE NOT NULL,
    consignor_id UUID NOT NULL REFERENCES consignors(id) ON DELETE RESTRICT,

    -- Terms
    commission_rate DECIMAL(5,2) NOT NULL,       -- Our commission %
    minimum_price_rule VARCHAR(50),              -- 'none', 'approval_required', 'floor_price'
    pricing_authority VARCHAR(50) DEFAULT 'us',  -- 'us', 'consignor', 'mutual'

    -- Duration
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT true,
    renewal_terms TEXT,

    -- Disposal rules
    unsold_return_days INTEGER DEFAULT 90,       -- Days before returning unsold items
    disposal_allowed BOOLEAN DEFAULT false,
    disposal_threshold DECIMAL(10,2),            -- Min value for disposal approval

    -- Categories
    allowed_categories TEXT[],                   -- NULL means all categories
    excluded_categories TEXT[],

    -- Status
    status consignment_status DEFAULT 'active',

    -- Document storage
    document_url VARCHAR(500),
    signed_document_url VARCHAR(500),

    -- Audit
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- CONSIGNMENT BATCHES TABLE (Groups of items received together)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consignment_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,    -- CB-2024-001
    consignor_id UUID NOT NULL REFERENCES consignors(id),
    agreement_id UUID REFERENCES consignment_agreements(id),

    -- Batch details
    description TEXT,
    expected_item_count INTEGER,
    received_item_count INTEGER DEFAULT 0,

    -- Receiving
    received_date DATE,
    received_by VARCHAR(100),
    receiving_notes TEXT,

    -- Values
    estimated_value DECIMAL(12,2),
    consignor_estimated_value DECIMAL(12,2),
    our_estimated_value DECIMAL(12,2),

    -- Status
    status VARCHAR(50) DEFAULT 'pending',        -- pending, received, processing, active, closed

    -- Location
    location VARCHAR(50),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- CONSIGNMENT ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS consignment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consignor_id UUID NOT NULL REFERENCES consignors(id),
    agreement_id UUID REFERENCES consignment_agreements(id),
    batch_id UUID REFERENCES consignment_batches(id),
    item_id UUID REFERENCES items(id),           -- Links to main inventory

    -- Consignor's item info
    consignor_sku VARCHAR(100),
    consignor_description TEXT,
    consignor_condition VARCHAR(50),
    consignor_asking_price DECIMAL(10,2),
    consignor_minimum_price DECIMAL(10,2),

    -- Our assessment
    our_condition item_condition,
    our_estimated_value DECIMAL(10,2),
    our_minimum_price DECIMAL(10,2),
    approved_list_price DECIMAL(10,2),

    -- Commission for this item (can override agreement)
    commission_rate DECIMAL(5,2),

    -- Status
    status consignment_item_status DEFAULT 'received',

    -- Sale info
    sold_price DECIMAL(10,2),
    sold_date DATE,
    marketplace marketplace_type,
    listing_id UUID REFERENCES listings(id),
    order_id UUID REFERENCES orders(id),

    -- Financials
    gross_sale DECIMAL(10,2),
    platform_fees DECIMAL(10,2),
    shipping_cost DECIMAL(10,2),
    net_sale DECIMAL(10,2),
    our_commission DECIMAL(10,2),
    consignor_payout DECIMAL(10,2),

    -- Payout tracking
    payout_id UUID,                              -- References consignment_payouts
    payout_status payout_status DEFAULT 'pending',

    -- Return/disposal
    return_requested BOOLEAN DEFAULT false,
    return_date DATE,
    disposal_date DATE,
    disposal_reason TEXT,

    -- Audit
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- CONSIGNMENT PAYOUTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS consignment_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_number VARCHAR(50) UNIQUE NOT NULL,   -- PAY-2024-001
    consignor_id UUID NOT NULL REFERENCES consignors(id),

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Amounts
    gross_sales DECIMAL(12,2) DEFAULT 0,
    total_fees DECIMAL(12,2) DEFAULT 0,
    total_commission DECIMAL(12,2) DEFAULT 0,
    adjustments DECIMAL(12,2) DEFAULT 0,
    adjustment_notes TEXT,
    net_payout DECIMAL(12,2) DEFAULT 0,

    -- Item counts
    items_sold INTEGER DEFAULT 0,
    items_returned INTEGER DEFAULT 0,

    -- Payment
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),              -- Check #, transaction ID, etc.
    payment_date DATE,

    -- Status
    status payout_status DEFAULT 'pending',

    -- Approval workflow
    prepared_by VARCHAR(100),
    prepared_at TIMESTAMPTZ,
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,

    -- Documents
    statement_url VARCHAR(500),

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add foreign key from consignment_items to payouts
ALTER TABLE consignment_items
    ADD CONSTRAINT fk_consignment_items_payout
    FOREIGN KEY (payout_id)
    REFERENCES consignment_payouts(id)
    ON DELETE SET NULL;

-- ============================================================================
-- CONSIGNMENT TRANSACTIONS TABLE (Ledger for all financial movements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consignment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consignor_id UUID NOT NULL REFERENCES consignors(id),
    consignment_item_id UUID REFERENCES consignment_items(id),
    payout_id UUID REFERENCES consignment_payouts(id),

    -- Transaction type
    transaction_type VARCHAR(50) NOT NULL,       -- sale, fee, commission, payout, adjustment, refund

    -- Amounts (positive = credit to consignor, negative = debit)
    amount DECIMAL(12,2) NOT NULL,
    running_balance DECIMAL(12,2),

    -- Description
    description TEXT,
    reference VARCHAR(100),

    -- Date
    transaction_date TIMESTAMPTZ DEFAULT NOW(),

    -- Audit
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- CONSIGNMENT COMMUNICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS consignment_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consignor_id UUID NOT NULL REFERENCES consignors(id),

    -- Communication type
    comm_type VARCHAR(50) NOT NULL,              -- email, phone, text, in_person
    direction VARCHAR(10) NOT NULL,              -- inbound, outbound

    -- Content
    subject VARCHAR(255),
    body TEXT,

    -- Related records
    batch_id UUID REFERENCES consignment_batches(id),
    item_id UUID REFERENCES consignment_items(id),
    payout_id UUID REFERENCES consignment_payouts(id),

    -- Status
    status VARCHAR(50) DEFAULT 'logged',         -- logged, requires_response, responded

    -- Audit
    logged_by VARCHAR(100),
    logged_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Consignors
CREATE INDEX IF NOT EXISTS idx_consignors_code ON consignors(consignor_code);
CREATE INDEX IF NOT EXISTS idx_consignors_email ON consignors(email);
CREATE INDEX IF NOT EXISTS idx_consignors_status ON consignors(status);

-- Agreements
CREATE INDEX IF NOT EXISTS idx_consignment_agreements_consignor ON consignment_agreements(consignor_id);
CREATE INDEX IF NOT EXISTS idx_consignment_agreements_status ON consignment_agreements(status);

-- Batches
CREATE INDEX IF NOT EXISTS idx_consignment_batches_consignor ON consignment_batches(consignor_id);
CREATE INDEX IF NOT EXISTS idx_consignment_batches_number ON consignment_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_consignment_batches_status ON consignment_batches(status);

-- Items
CREATE INDEX IF NOT EXISTS idx_consignment_items_consignor ON consignment_items(consignor_id);
CREATE INDEX IF NOT EXISTS idx_consignment_items_batch ON consignment_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_consignment_items_item ON consignment_items(item_id);
CREATE INDEX IF NOT EXISTS idx_consignment_items_status ON consignment_items(status);
CREATE INDEX IF NOT EXISTS idx_consignment_items_payout ON consignment_items(payout_id);
CREATE INDEX IF NOT EXISTS idx_consignment_items_payout_status ON consignment_items(payout_status);

-- Payouts
CREATE INDEX IF NOT EXISTS idx_consignment_payouts_consignor ON consignment_payouts(consignor_id);
CREATE INDEX IF NOT EXISTS idx_consignment_payouts_status ON consignment_payouts(status);
CREATE INDEX IF NOT EXISTS idx_consignment_payouts_period ON consignment_payouts(period_start, period_end);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_consignment_transactions_consignor ON consignment_transactions(consignor_id);
CREATE INDEX IF NOT EXISTS idx_consignment_transactions_type ON consignment_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_consignment_transactions_date ON consignment_transactions(transaction_date);

-- Communications
CREATE INDEX IF NOT EXISTS idx_consignment_communications_consignor ON consignment_communications(consignor_id);
CREATE INDEX IF NOT EXISTS idx_consignment_communications_type ON consignment_communications(comm_type);

-- ============================================================================
-- SEQUENCE FOR CONSIGNOR CODES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS consignor_seq START 1;

-- ============================================================================
-- CONSIGNOR CODE GENERATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_consignor_code()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN 'CON-' || LPAD(nextval('consignor_seq')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION TO CALCULATE CONSIGNOR BALANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_consignor_balance(p_consignor_id UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_balance DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM consignment_transactions
    WHERE consignor_id = p_consignor_id;

    -- Update the consignor record
    UPDATE consignors
    SET current_balance = v_balance,
        updated_at = NOW()
    WHERE id = p_consignor_id;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO UPDATE CONSIGNOR STATS ON ITEM SALE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_consignor_stats_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'sold' AND OLD.status != 'sold' THEN
        UPDATE consignors
        SET total_items_sold = total_items_sold + 1,
            total_sales = total_sales + COALESCE(NEW.sold_price, 0),
            updated_at = NOW()
        WHERE id = NEW.consignor_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_consignor_stats ON consignment_items;
CREATE TRIGGER trg_update_consignor_stats
    AFTER UPDATE ON consignment_items
    FOR EACH ROW
    EXECUTE FUNCTION update_consignor_stats_on_sale();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE consignors IS 'People or companies who consign inventory to us for sale';
COMMENT ON TABLE consignment_agreements IS 'Legal agreements defining consignment terms';
COMMENT ON TABLE consignment_batches IS 'Groups of items received together from a consignor';
COMMENT ON TABLE consignment_items IS 'Individual consigned items linked to main inventory';
COMMENT ON TABLE consignment_payouts IS 'Periodic payments to consignors';
COMMENT ON TABLE consignment_transactions IS 'Financial ledger for consignment accounts';
COMMENT ON TABLE consignment_communications IS 'Communication log with consignors';
