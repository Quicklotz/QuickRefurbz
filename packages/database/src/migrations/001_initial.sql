-- ============================================================================
-- QuickWMS Database Migration: 001_initial.sql
-- Core tables for inventory management system
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization

-- ============================================================================
-- SEQUENCES FOR ID GENERATION
-- ============================================================================

-- Master QLID sequence for all items
CREATE SEQUENCE IF NOT EXISTS qlid_seq START 1;

-- Pallet sequences per retailer source
CREATE SEQUENCE IF NOT EXISTS pallet_seq_bby START 1;   -- Best Buy
CREATE SEQUENCE IF NOT EXISTS pallet_seq_tgt START 1;   -- Target
CREATE SEQUENCE IF NOT EXISTS pallet_seq_amz START 1;   -- Amazon
CREATE SEQUENCE IF NOT EXISTS pallet_seq_wmt START 1;   -- Walmart
CREATE SEQUENCE IF NOT EXISTS pallet_seq_hd START 1;    -- Home Depot
CREATE SEQUENCE IF NOT EXISTS pallet_seq_low START 1;   -- Lowes
CREATE SEQUENCE IF NOT EXISTS pallet_seq_cos START 1;   -- Costco
CREATE SEQUENCE IF NOT EXISTS pallet_seq_sam START 1;   -- Sam's Club
CREATE SEQUENCE IF NOT EXISTS pallet_seq_khl START 1;   -- Kohl's
CREATE SEQUENCE IF NOT EXISTS pallet_seq_mac START 1;   -- Macy's
CREATE SEQUENCE IF NOT EXISTS pallet_seq_jcp START 1;   -- JCPenney
CREATE SEQUENCE IF NOT EXISTS pallet_seq_oth START 1;   -- Other/Unknown

-- Order sequence
CREATE SEQUENCE IF NOT EXISTS order_seq START 1000;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE item_condition AS ENUM (
        'new_sealed',
        'new_open_box',
        'like_new',
        'very_good',
        'good',
        'acceptable',
        'for_parts',
        'salvage',
        'untested'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM (
        'received',
        'grading',
        'graded',
        'listed',
        'sold',
        'shipped',
        'returned',
        'salvage',
        'consigned',
        'disposed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pallet_status AS ENUM (
        'building',
        'complete',
        'manifested',
        'shipped',
        'delivered'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending',
        'confirmed',
        'processing',
        'packed',
        'shipped',
        'delivered',
        'cancelled',
        'returned'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM (
        'draft',
        'active',
        'sold',
        'ended',
        'relisted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE marketplace_type AS ENUM (
        'ebay',
        'amazon',
        'whatnot',
        'shopify',
        'facebook',
        'offerup',
        'wholesale',
        'local',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SUPPLIERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,           -- TL, QL, BS, DL, etc.
    name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255),
    website VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    payment_terms VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default suppliers
INSERT INTO suppliers (code, name, full_name, website) VALUES
    ('TL', 'TechLiquidators', 'Tech Liquidators LLC', 'https://techliquidators.com'),
    ('QL', 'QuickLotz', 'QuickLotz.com', 'https://quicklotz.com'),
    ('BS', 'B-Stock', 'B-Stock Solutions', 'https://bstock.com'),
    ('DL', 'DirectLiq', 'Direct Liquidation', 'https://directliquidation.com'),
    ('LL', 'LiqLots', 'Liquidation Lots', NULL),
    ('AM', 'Amazon', 'Amazon Liquidation Auctions', 'https://liquidationauctions.amazon.com'),
    ('OT', 'Other', 'Other/Direct', NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- MANIFESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS manifests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manifest_id VARCHAR(50) UNIQUE NOT NULL,    -- TL-2024-001, QL-BBY-2024-001
    supplier_id UUID REFERENCES suppliers(id),
    supplier_code VARCHAR(10),
    order_number VARCHAR(50),                   -- Supplier's order/invoice number
    retailer_source VARCHAR(50),                -- BBY, TGT, AMZ, etc.
    manifest_type VARCHAR(50),                  -- customer_returns, overstock, salvage
    total_units INTEGER DEFAULT 0,
    total_msrp DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2) DEFAULT 0,
    manifest_date DATE,
    received_date DATE,
    file_path VARCHAR(500),                     -- Path to manifest file
    file_hash VARCHAR(64),                      -- SHA256 of manifest file
    raw_data JSONB,                             -- Original manifest data
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RECEIVING SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS receiving_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(50) UNIQUE NOT NULL,     -- RCV-2024-01-15-001
    manifest_id UUID REFERENCES manifests(id),
    location VARCHAR(50) DEFAULT 'ATL',         -- ATL, DAL, etc.
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    started_by VARCHAR(100),
    completed_by VARCHAR(100),
    expected_units INTEGER DEFAULT 0,
    received_units INTEGER DEFAULT 0,
    discrepancy_notes TEXT,
    status VARCHAR(20) DEFAULT 'in_progress',   -- in_progress, completed, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ITEMS TABLE (Master Inventory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Unique identifiers
    qlid VARCHAR(20) UNIQUE NOT NULL,           -- QLID000000001
    internal_pallet_id VARCHAR(20),             -- P1BBY, P5TGT
    source_pallet_id VARCHAR(50),               -- External pallet ID from supplier
    order_id VARCHAR(50),                       -- Supplier order/invoice number

    -- Source information
    manifest_id UUID REFERENCES manifests(id),
    receiving_session_id UUID REFERENCES receiving_sessions(id),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_code VARCHAR(10),
    retailer_source VARCHAR(50),                -- BBY, TGT, AMZ, WMT, etc.

    -- Product identification
    upc VARCHAR(20),
    ean VARCHAR(20),
    asin VARCHAR(20),
    mpn VARCHAR(100),                           -- Manufacturer part number
    sku VARCHAR(100),                           -- Retailer SKU
    model_number VARCHAR(100),
    serial_number VARCHAR(100),

    -- Product details
    title VARCHAR(500) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    description TEXT,
    color VARCHAR(50),
    size VARCHAR(50),
    weight_lbs DECIMAL(8,2),

    -- Dimensions (inches)
    length_in DECIMAL(8,2),
    width_in DECIMAL(8,2),
    height_in DECIMAL(8,2),

    -- Pricing
    msrp DECIMAL(10,2),
    wholesale_price DECIMAL(10,2),
    cost DECIMAL(10,2),                         -- Our acquisition cost
    list_price DECIMAL(10,2),                   -- Our listing price
    sold_price DECIMAL(10,2),

    -- Condition and grading
    manifest_condition VARCHAR(50),             -- Condition from manifest
    graded_condition item_condition,            -- Our graded condition
    condition_notes TEXT,
    functionality_score INTEGER CHECK (functionality_score BETWEEN 1 AND 10),
    cosmetic_score INTEGER CHECK (cosmetic_score BETWEEN 1 AND 10),
    completeness_score INTEGER CHECK (completeness_score BETWEEN 1 AND 10),

    -- Status and location
    status item_status DEFAULT 'received',
    location VARCHAR(50) DEFAULT 'ATL',         -- Warehouse location
    bin_location VARCHAR(50),                   -- Specific bin/shelf
    zone VARCHAR(20),                           -- Warehouse zone

    -- Flags
    is_tested BOOLEAN DEFAULT false,
    is_complete BOOLEAN DEFAULT true,           -- Has all parts/accessories
    has_damage BOOLEAN DEFAULT false,
    is_missing_parts BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,            -- For electronics (iCloud, FRP, etc.)
    needs_repair BOOLEAN DEFAULT false,

    -- Photos
    photo_count INTEGER DEFAULT 0,
    primary_photo_url VARCHAR(500),
    photo_urls JSONB,                           -- Array of photo URLs

    -- Outbound pallet (if being palletized for resale)
    outbound_pallet_id UUID,

    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    listed_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,

    -- Audit
    graded_by VARCHAR(100),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Flexible metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PALLETS TABLE (Outbound pallets we build)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pallet_id VARCHAR(20) UNIQUE NOT NULL,      -- P1BBY, P25TGT

    -- Pallet details
    pallet_type VARCHAR(50),                    -- standard, gaylord, oversized
    retailer_source VARCHAR(50),                -- BBY, TGT, etc.
    category VARCHAR(100),                      -- Electronics, Home, etc.
    condition_tier VARCHAR(50),                 -- A, B, C, Salvage

    -- Counts and values
    item_count INTEGER DEFAULT 0,
    total_msrp DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2) DEFAULT 0,
    target_price DECIMAL(12,2),
    sold_price DECIMAL(12,2),

    -- Physical specs
    weight_lbs DECIMAL(8,2),
    length_in DECIMAL(8,2) DEFAULT 48,
    width_in DECIMAL(8,2) DEFAULT 40,
    height_in DECIMAL(8,2) DEFAULT 48,

    -- Status
    status pallet_status DEFAULT 'building',
    location VARCHAR(50) DEFAULT 'ATL',

    -- Buyer info (if sold)
    buyer_id UUID,
    buyer_name VARCHAR(255),

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    manifested_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,

    -- Audit
    built_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add foreign key for items -> pallets
ALTER TABLE items
    ADD CONSTRAINT fk_items_outbound_pallet
    FOREIGN KEY (outbound_pallet_id)
    REFERENCES pallets(id)
    ON DELETE SET NULL;

-- ============================================================================
-- GRADING RECORDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS gradings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

    -- Grading details
    graded_condition item_condition NOT NULL,
    functionality_score INTEGER CHECK (functionality_score BETWEEN 1 AND 10),
    cosmetic_score INTEGER CHECK (cosmetic_score BETWEEN 1 AND 10),
    completeness_score INTEGER CHECK (completeness_score BETWEEN 1 AND 10),
    overall_score INTEGER GENERATED ALWAYS AS (
        (COALESCE(functionality_score, 5) + COALESCE(cosmetic_score, 5) + COALESCE(completeness_score, 5)) / 3
    ) STORED,

    -- Testing results
    powers_on BOOLEAN,
    functions_properly BOOLEAN,
    has_original_packaging BOOLEAN DEFAULT false,
    has_accessories BOOLEAN DEFAULT true,
    missing_parts TEXT,
    damage_description TEXT,

    -- Repair assessment
    is_repairable BOOLEAN,
    estimated_repair_cost DECIMAL(10,2),
    repair_notes TEXT,

    -- Photos taken during grading
    grading_photos JSONB,

    -- Audit
    graded_by VARCHAR(100) NOT NULL,
    graded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Version for re-grades
    version INTEGER DEFAULT 1,
    previous_grading_id UUID REFERENCES gradings(id),

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LISTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

    -- Listing identifiers
    listing_id VARCHAR(100),                    -- Platform-specific listing ID
    marketplace marketplace_type NOT NULL,
    marketplace_url VARCHAR(500),

    -- Listing details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    list_price DECIMAL(10,2) NOT NULL,
    shipping_price DECIMAL(10,2) DEFAULT 0,
    handling_time_days INTEGER DEFAULT 1,

    -- Status
    status listing_status DEFAULT 'draft',

    -- Listing performance
    views INTEGER DEFAULT 0,
    watchers INTEGER DEFAULT 0,
    offers_received INTEGER DEFAULT 0,

    -- Dates
    listed_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- Sale details
    sold_price DECIMAL(10,2),
    buyer_username VARCHAR(100),
    platform_fees DECIMAL(10,2),
    shipping_cost_actual DECIMAL(10,2),
    net_profit DECIMAL(10,2),

    -- Audit
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- ORDERS TABLE (Fulfillment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,   -- ORD-001000

    -- Order source
    marketplace marketplace_type,
    marketplace_order_id VARCHAR(100),
    listing_id UUID REFERENCES listings(id),

    -- Buyer info
    buyer_name VARCHAR(255),
    buyer_email VARCHAR(255),
    buyer_phone VARCHAR(50),
    buyer_username VARCHAR(100),

    -- Shipping address
    ship_to_name VARCHAR(255),
    ship_to_company VARCHAR(255),
    ship_to_address1 VARCHAR(255),
    ship_to_address2 VARCHAR(255),
    ship_to_city VARCHAR(100),
    ship_to_state VARCHAR(50),
    ship_to_zip VARCHAR(20),
    ship_to_country VARCHAR(50) DEFAULT 'USA',

    -- Order totals
    subtotal DECIMAL(10,2),
    shipping_charged DECIMAL(10,2),
    tax_collected DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2),

    -- Shipping details
    carrier VARCHAR(50),
    service_type VARCHAR(100),
    tracking_number VARCHAR(100),
    shipping_cost DECIMAL(10,2),
    shipping_weight_lbs DECIMAL(8,2),

    -- Dates
    order_date TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,

    -- Status
    status order_status DEFAULT 'pending',

    -- Financials
    platform_fees DECIMAL(10,2),
    payment_processing_fees DECIMAL(10,2),
    net_revenue DECIMAL(10,2),

    -- Notes
    internal_notes TEXT,
    gift_message TEXT,

    -- Audit
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- ORDER ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    listing_id UUID REFERENCES listings(id),

    -- Item details at time of sale
    qlid VARCHAR(20) NOT NULL,
    title VARCHAR(500),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),

    -- Cost basis
    cost DECIMAL(10,2),
    profit DECIMAL(10,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Items indexes
CREATE INDEX IF NOT EXISTS idx_items_qlid ON items(qlid);
CREATE INDEX IF NOT EXISTS idx_items_upc ON items(upc);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);
CREATE INDEX IF NOT EXISTS idx_items_retailer ON items(retailer_source);
CREATE INDEX IF NOT EXISTS idx_items_supplier ON items(supplier_code);
CREATE INDEX IF NOT EXISTS idx_items_manifest ON items(manifest_id);
CREATE INDEX IF NOT EXISTS idx_items_internal_pallet ON items(internal_pallet_id);
CREATE INDEX IF NOT EXISTS idx_items_outbound_pallet ON items(outbound_pallet_id);
CREATE INDEX IF NOT EXISTS idx_items_received_at ON items(received_at);
CREATE INDEX IF NOT EXISTS idx_items_brand ON items(brand);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_title_trgm ON items USING gin(title gin_trgm_ops);

-- Manifests indexes
CREATE INDEX IF NOT EXISTS idx_manifests_supplier ON manifests(supplier_code);
CREATE INDEX IF NOT EXISTS idx_manifests_order ON manifests(order_number);
CREATE INDEX IF NOT EXISTS idx_manifests_date ON manifests(manifest_date);

-- Pallets indexes
CREATE INDEX IF NOT EXISTS idx_pallets_status ON pallets(status);
CREATE INDEX IF NOT EXISTS idx_pallets_retailer ON pallets(retailer_source);
CREATE INDEX IF NOT EXISTS idx_pallets_location ON pallets(location);

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_item ON listings(item_id);
CREATE INDEX IF NOT EXISTS idx_listings_marketplace ON listings(marketplace);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_listing_id ON listings(listing_id);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders(marketplace);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON order_items(item_id);

-- Gradings indexes
CREATE INDEX IF NOT EXISTS idx_gradings_item ON gradings(item_id);
CREATE INDEX IF NOT EXISTS idx_gradings_condition ON gradings(graded_condition);
CREATE INDEX IF NOT EXISTS idx_gradings_date ON gradings(graded_at);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- ============================================================================
-- QLID GENERATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_qlid()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN 'QLID' || LPAD(nextval('qlid_seq')::text, 9, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PALLET ID GENERATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_pallet_id(retailer_code VARCHAR)
RETURNS VARCHAR(20) AS $$
DECLARE
    seq_name TEXT;
    seq_val BIGINT;
BEGIN
    seq_name := 'pallet_seq_' || LOWER(retailer_code);

    -- Check if sequence exists, create if not
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = seq_name) THEN
        EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
    END IF;

    EXECUTE format('SELECT nextval(%L)', seq_name) INTO seq_val;
    RETURN 'P' || seq_val || UPPER(retailer_code);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ORDER NUMBER GENERATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'ORD-' || LPAD(nextval('order_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE items IS 'Master inventory table - one row per physical unit';
COMMENT ON TABLE pallets IS 'Outbound pallets we build for resale';
COMMENT ON TABLE manifests IS 'Inbound manifest records from suppliers';
COMMENT ON TABLE suppliers IS 'Liquidation suppliers we purchase from';
COMMENT ON TABLE gradings IS 'Item grading/testing records with full history';
COMMENT ON TABLE listings IS 'Marketplace listings for items';
COMMENT ON TABLE orders IS 'Customer orders for fulfillment';
COMMENT ON TABLE order_items IS 'Line items within orders';
COMMENT ON COLUMN items.qlid IS 'Unique QuickLotz ID in format QLID000000001';
COMMENT ON COLUMN items.internal_pallet_id IS 'Our internal pallet ID like P1BBY';
COMMENT ON COLUMN items.source_pallet_id IS 'External pallet ID from supplier manifest';
