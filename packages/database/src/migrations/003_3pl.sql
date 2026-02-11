-- ============================================================================
-- QuickWMS Database Migration: 003_3pl.sql
-- 3PL (Third-Party Logistics) client management tables
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE tpl_client_status AS ENUM (
        'prospect',
        'onboarding',
        'active',
        'paused',
        'terminated'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tpl_billing_type AS ENUM (
        'per_unit',
        'per_pallet',
        'per_sqft',
        'flat_monthly',
        'hybrid'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tpl_service_type AS ENUM (
        'storage_only',
        'pick_pack',
        'full_fulfillment',
        'returns_processing',
        'kitting',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tpl_shipment_status AS ENUM (
        'pending',
        'received',
        'processing',
        'stocked',
        'issue'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 3PL CLIENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_code VARCHAR(20) UNIQUE NOT NULL,     -- 3PL-001

    -- Business info
    company_name VARCHAR(255) NOT NULL,
    dba_name VARCHAR(255),
    contact_name VARCHAR(255),
    contact_title VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),

    -- Billing contact (if different)
    billing_contact_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_phone VARCHAR(50),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',

    -- Tax/Legal
    tax_id VARCHAR(50),
    w9_on_file BOOLEAN DEFAULT false,
    insurance_on_file BOOLEAN DEFAULT false,
    insurance_expiry DATE,

    -- Service configuration
    service_type tpl_service_type DEFAULT 'storage_only',
    billing_type tpl_billing_type DEFAULT 'per_unit',

    -- Billing rates (can be overridden in contract)
    storage_rate_per_unit DECIMAL(8,4),          -- Per unit per day
    storage_rate_per_pallet DECIMAL(8,2),        -- Per pallet per month
    storage_rate_per_sqft DECIMAL(8,2),          -- Per sq ft per month
    pick_fee DECIMAL(8,2) DEFAULT 1.50,
    pack_fee DECIMAL(8,2) DEFAULT 2.00,
    receiving_fee_per_unit DECIMAL(8,2) DEFAULT 0.50,
    shipping_handling_fee DECIMAL(8,2) DEFAULT 1.00,
    return_processing_fee DECIMAL(8,2) DEFAULT 3.00,
    minimum_monthly_fee DECIMAL(10,2),

    -- Allocated space
    allocated_sqft INTEGER,
    allocated_pallet_positions INTEGER,
    warehouse_zone VARCHAR(50),

    -- Status
    status tpl_client_status DEFAULT 'prospect',

    -- Stats
    current_units_stored INTEGER DEFAULT 0,
    current_pallets_stored INTEGER DEFAULT 0,
    total_units_processed INTEGER DEFAULT 0,
    total_orders_fulfilled INTEGER DEFAULT 0,

    -- Integration
    api_enabled BOOLEAN DEFAULT false,
    api_key VARCHAR(100),
    webhook_url VARCHAR(500),
    inventory_sync_enabled BOOLEAN DEFAULT false,

    -- Notes
    notes TEXT,
    special_instructions TEXT,

    -- Audit
    sales_rep VARCHAR(100),
    onboarded_by VARCHAR(100),
    onboarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3PL CONTRACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES tpl_clients(id) ON DELETE RESTRICT,

    -- Contract period
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT true,
    renewal_notice_days INTEGER DEFAULT 30,

    -- Service level
    service_type tpl_service_type NOT NULL,
    sla_order_processing_hours INTEGER DEFAULT 24,
    sla_receiving_hours INTEGER DEFAULT 48,

    -- Billing
    billing_type tpl_billing_type NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly',  -- weekly, biweekly, monthly
    payment_terms_days INTEGER DEFAULT 30,

    -- Custom rates (override client defaults)
    storage_rate_per_unit DECIMAL(8,4),
    storage_rate_per_pallet DECIMAL(8,2),
    storage_rate_per_sqft DECIMAL(8,2),
    pick_fee DECIMAL(8,2),
    pack_fee DECIMAL(8,2),
    receiving_fee_per_unit DECIMAL(8,2),
    shipping_handling_fee DECIMAL(8,2),
    return_processing_fee DECIMAL(8,2),
    minimum_monthly_fee DECIMAL(10,2),

    -- Volume discounts
    volume_discount_tiers JSONB,                 -- {"1000": 5, "5000": 10, "10000": 15}

    -- Space allocation
    guaranteed_pallet_positions INTEGER,
    guaranteed_sqft INTEGER,

    -- Special terms
    special_terms TEXT,
    exclusions TEXT,

    -- Documents
    document_url VARCHAR(500),
    signed_document_url VARCHAR(500),

    -- Status
    status VARCHAR(50) DEFAULT 'active',         -- draft, pending, active, expired, terminated

    -- Audit
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3PL INVENTORY TABLE (Client's inventory we store)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES tpl_clients(id),

    -- Client's SKU info
    client_sku VARCHAR(100) NOT NULL,
    client_name VARCHAR(500),
    client_description TEXT,

    -- Our reference
    internal_sku VARCHAR(100),

    -- Product identifiers
    upc VARCHAR(20),
    ean VARCHAR(20),
    asin VARCHAR(20),

    -- Product details
    category VARCHAR(100),
    brand VARCHAR(100),
    weight_lbs DECIMAL(8,2),
    length_in DECIMAL(8,2),
    width_in DECIMAL(8,2),
    height_in DECIMAL(8,2),

    -- Inventory counts
    quantity_on_hand INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,         -- Reserved for orders
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    quantity_inbound INTEGER DEFAULT 0,          -- Expected from shipments

    -- Reorder info (if we manage)
    reorder_point INTEGER,
    reorder_quantity INTEGER,

    -- Location
    primary_bin VARCHAR(50),
    warehouse_zone VARCHAR(50),

    -- Costs
    client_cost DECIMAL(10,2),                   -- Client's cost for insurance/valuation

    -- Flags
    is_active BOOLEAN DEFAULT true,
    requires_lot_tracking BOOLEAN DEFAULT false,
    requires_serial_tracking BOOLEAN DEFAULT false,
    is_hazmat BOOLEAN DEFAULT false,
    is_fragile BOOLEAN DEFAULT false,
    requires_climate_control BOOLEAN DEFAULT false,

    -- Photos
    primary_photo_url VARCHAR(500),

    -- Audit
    last_counted_at TIMESTAMPTZ,
    last_received_at TIMESTAMPTZ,
    last_shipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb,

    -- Unique constraint on client + sku
    CONSTRAINT uq_tpl_inventory_client_sku UNIQUE (client_id, client_sku)
);

-- ============================================================================
-- 3PL INVENTORY LOCATIONS TABLE (Bin-level tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_inventory_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES tpl_inventory(id) ON DELETE CASCADE,

    -- Location
    warehouse VARCHAR(50) DEFAULT 'ATL',
    zone VARCHAR(20),
    aisle VARCHAR(10),
    rack VARCHAR(10),
    shelf VARCHAR(10),
    bin VARCHAR(20),

    -- Full bin code (computed)
    bin_code VARCHAR(50) GENERATED ALWAYS AS (
        COALESCE(zone, '') || '-' ||
        COALESCE(aisle, '') || '-' ||
        COALESCE(rack, '') || '-' ||
        COALESCE(shelf, '') || '-' ||
        COALESCE(bin, '')
    ) STORED,

    -- Quantity at this location
    quantity INTEGER NOT NULL DEFAULT 0,

    -- Lot/Serial tracking
    lot_number VARCHAR(100),
    lot_expiry DATE,
    serial_numbers TEXT[],

    -- Flags
    is_primary BOOLEAN DEFAULT false,

    -- Audit
    last_movement_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3PL INBOUND SHIPMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_inbound_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR(50) UNIQUE NOT NULL,  -- IB-2024-001
    client_id UUID NOT NULL REFERENCES tpl_clients(id),

    -- Shipment details
    client_reference VARCHAR(100),               -- Client's PO or reference
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    pro_number VARCHAR(100),                     -- For freight

    -- Expected
    expected_date DATE,
    expected_pallets INTEGER,
    expected_cartons INTEGER,
    expected_units INTEGER,

    -- Actual received
    received_date DATE,
    received_pallets INTEGER,
    received_cartons INTEGER,
    received_units INTEGER,

    -- Status
    status tpl_shipment_status DEFAULT 'pending',

    -- Receiving details
    received_by VARCHAR(100),
    receiving_notes TEXT,
    discrepancy_notes TEXT,

    -- Documents
    bol_url VARCHAR(500),
    packing_list_url VARCHAR(500),

    -- Fees
    receiving_fee DECIMAL(10,2),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3PL INBOUND SHIPMENT ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_inbound_shipment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES tpl_inbound_shipments(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES tpl_inventory(id),

    -- Item details
    client_sku VARCHAR(100) NOT NULL,
    description VARCHAR(500),

    -- Quantities
    expected_quantity INTEGER NOT NULL,
    received_quantity INTEGER,
    damaged_quantity INTEGER DEFAULT 0,

    -- Lot tracking
    lot_number VARCHAR(100),
    lot_expiry DATE,

    -- Assigned location
    assigned_bin VARCHAR(50),

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3PL OUTBOUND ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_outbound_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,    -- 3PL-ORD-001
    client_id UUID NOT NULL REFERENCES tpl_clients(id),

    -- Client's order info
    client_order_number VARCHAR(100),
    client_order_date TIMESTAMPTZ,
    marketplace VARCHAR(50),
    marketplace_order_id VARCHAR(100),

    -- Ship to
    ship_to_name VARCHAR(255) NOT NULL,
    ship_to_company VARCHAR(255),
    ship_to_address1 VARCHAR(255) NOT NULL,
    ship_to_address2 VARCHAR(255),
    ship_to_city VARCHAR(100) NOT NULL,
    ship_to_state VARCHAR(50) NOT NULL,
    ship_to_zip VARCHAR(20) NOT NULL,
    ship_to_country VARCHAR(50) DEFAULT 'USA',
    ship_to_phone VARCHAR(50),
    ship_to_email VARCHAR(255),

    -- Shipping
    requested_carrier VARCHAR(100),
    requested_service VARCHAR(100),
    ship_by_date DATE,

    -- Actual shipping
    shipped_carrier VARCHAR(100),
    shipped_service VARCHAR(100),
    tracking_number VARCHAR(100),
    shipped_date DATE,
    delivered_date DATE,

    -- Packages
    package_count INTEGER DEFAULT 1,
    total_weight_lbs DECIMAL(8,2),

    -- Status
    status order_status DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',       -- low, normal, high, rush

    -- Fees
    pick_fee DECIMAL(10,2),
    pack_fee DECIMAL(10,2),
    shipping_fee DECIMAL(10,2),
    total_fees DECIMAL(10,2),

    -- Notes
    internal_notes TEXT,
    packing_instructions TEXT,
    gift_message TEXT,

    -- Audit
    picked_by VARCHAR(100),
    picked_at TIMESTAMPTZ,
    packed_by VARCHAR(100),
    packed_at TIMESTAMPTZ,
    shipped_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3PL OUTBOUND ORDER ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_outbound_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES tpl_outbound_orders(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES tpl_inventory(id),

    -- Item details
    client_sku VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    quantity_ordered INTEGER NOT NULL,
    quantity_picked INTEGER,
    quantity_shipped INTEGER,

    -- Pick location
    pick_bin VARCHAR(50),

    -- Lot/Serial
    lot_number VARCHAR(100),
    serial_number VARCHAR(100),

    -- Status
    pick_status VARCHAR(20) DEFAULT 'pending',   -- pending, picked, short, cancelled

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3PL BILLING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES tpl_clients(id),
    contract_id UUID REFERENCES tpl_contracts(id),

    -- Billing period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Totals
    storage_charges DECIMAL(12,2) DEFAULT 0,
    receiving_charges DECIMAL(12,2) DEFAULT 0,
    fulfillment_charges DECIMAL(12,2) DEFAULT 0,
    shipping_charges DECIMAL(12,2) DEFAULT 0,
    returns_charges DECIMAL(12,2) DEFAULT 0,
    other_charges DECIMAL(12,2) DEFAULT 0,
    subtotal DECIMAL(12,2) DEFAULT 0,

    -- Adjustments
    volume_discount DECIMAL(12,2) DEFAULT 0,
    credits DECIMAL(12,2) DEFAULT 0,

    -- Final
    tax DECIMAL(12,2) DEFAULT 0,
    total_due DECIMAL(12,2) DEFAULT 0,

    -- Payment
    due_date DATE,
    payment_date DATE,
    payment_reference VARCHAR(100),
    amount_paid DECIMAL(12,2),

    -- Status
    status VARCHAR(50) DEFAULT 'draft',          -- draft, sent, paid, overdue, void

    -- Documents
    invoice_url VARCHAR(500),

    -- Notes
    notes TEXT,

    -- Audit
    created_by VARCHAR(100),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3PL INVOICE LINE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES tpl_invoices(id) ON DELETE CASCADE,

    -- Line item details
    line_type VARCHAR(50) NOT NULL,              -- storage, receiving, pick, pack, shipping, etc.
    description VARCHAR(500),
    quantity DECIMAL(12,2),
    unit_price DECIMAL(10,4),
    total_price DECIMAL(12,2),

    -- Reference
    reference_type VARCHAR(50),                  -- order, shipment, etc.
    reference_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3PL ACTIVITY LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tpl_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES tpl_clients(id),

    -- Activity type
    activity_type VARCHAR(50) NOT NULL,          -- receive, pick, pack, ship, adjust, count

    -- Related records
    inventory_id UUID REFERENCES tpl_inventory(id),
    order_id UUID REFERENCES tpl_outbound_orders(id),
    shipment_id UUID REFERENCES tpl_inbound_shipments(id),

    -- Details
    sku VARCHAR(100),
    quantity INTEGER,
    from_location VARCHAR(50),
    to_location VARCHAR(50),

    -- Description
    description TEXT,

    -- Audit
    performed_by VARCHAR(100),
    performed_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Clients
CREATE INDEX IF NOT EXISTS idx_tpl_clients_code ON tpl_clients(client_code);
CREATE INDEX IF NOT EXISTS idx_tpl_clients_status ON tpl_clients(status);
CREATE INDEX IF NOT EXISTS idx_tpl_clients_email ON tpl_clients(email);

-- Contracts
CREATE INDEX IF NOT EXISTS idx_tpl_contracts_client ON tpl_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_tpl_contracts_status ON tpl_contracts(status);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_tpl_inventory_client ON tpl_inventory(client_id);
CREATE INDEX IF NOT EXISTS idx_tpl_inventory_sku ON tpl_inventory(client_sku);
CREATE INDEX IF NOT EXISTS idx_tpl_inventory_upc ON tpl_inventory(upc);
CREATE INDEX IF NOT EXISTS idx_tpl_inventory_active ON tpl_inventory(is_active);

-- Inventory Locations
CREATE INDEX IF NOT EXISTS idx_tpl_inventory_locations_inventory ON tpl_inventory_locations(inventory_id);
CREATE INDEX IF NOT EXISTS idx_tpl_inventory_locations_bin ON tpl_inventory_locations(bin_code);

-- Inbound Shipments
CREATE INDEX IF NOT EXISTS idx_tpl_inbound_shipments_client ON tpl_inbound_shipments(client_id);
CREATE INDEX IF NOT EXISTS idx_tpl_inbound_shipments_status ON tpl_inbound_shipments(status);
CREATE INDEX IF NOT EXISTS idx_tpl_inbound_shipments_tracking ON tpl_inbound_shipments(tracking_number);

-- Outbound Orders
CREATE INDEX IF NOT EXISTS idx_tpl_outbound_orders_client ON tpl_outbound_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_tpl_outbound_orders_status ON tpl_outbound_orders(status);
CREATE INDEX IF NOT EXISTS idx_tpl_outbound_orders_client_order ON tpl_outbound_orders(client_order_number);
CREATE INDEX IF NOT EXISTS idx_tpl_outbound_orders_tracking ON tpl_outbound_orders(tracking_number);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_tpl_invoices_client ON tpl_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_tpl_invoices_status ON tpl_invoices(status);
CREATE INDEX IF NOT EXISTS idx_tpl_invoices_period ON tpl_invoices(period_start, period_end);

-- Activity Log
CREATE INDEX IF NOT EXISTS idx_tpl_activity_log_client ON tpl_activity_log(client_id);
CREATE INDEX IF NOT EXISTS idx_tpl_activity_log_type ON tpl_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_tpl_activity_log_date ON tpl_activity_log(performed_at);

-- ============================================================================
-- SEQUENCES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS tpl_client_seq START 1;
CREATE SEQUENCE IF NOT EXISTS tpl_order_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS tpl_shipment_seq START 1;
CREATE SEQUENCE IF NOT EXISTS tpl_invoice_seq START 1;

-- ============================================================================
-- ID GENERATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_tpl_client_code()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN '3PL-' || LPAD(nextval('tpl_client_seq')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_tpl_order_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN '3PL-ORD-' || LPAD(nextval('tpl_order_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_tpl_shipment_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'IB-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('tpl_shipment_seq')::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_tpl_invoice_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('tpl_invoice_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO UPDATE INVENTORY ON ORDER PICK
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tpl_inventory_on_pick()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pick_status = 'picked' AND OLD.pick_status = 'pending' THEN
        UPDATE tpl_inventory
        SET quantity_reserved = quantity_reserved - NEW.quantity_picked,
            quantity_on_hand = quantity_on_hand - NEW.quantity_picked,
            last_shipped_at = NOW(),
            updated_at = NOW()
        WHERE id = NEW.inventory_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_inventory_on_pick ON tpl_outbound_order_items;
CREATE TRIGGER trg_update_inventory_on_pick
    AFTER UPDATE ON tpl_outbound_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_tpl_inventory_on_pick();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tpl_clients IS 'Third-party logistics clients we provide warehousing/fulfillment for';
COMMENT ON TABLE tpl_contracts IS 'Service contracts with 3PL clients';
COMMENT ON TABLE tpl_inventory IS 'Client inventory we store and manage';
COMMENT ON TABLE tpl_inventory_locations IS 'Bin-level location tracking for client inventory';
COMMENT ON TABLE tpl_inbound_shipments IS 'Incoming inventory shipments from clients';
COMMENT ON TABLE tpl_outbound_orders IS 'Fulfillment orders for client customers';
COMMENT ON TABLE tpl_invoices IS 'Billing invoices for 3PL services';
COMMENT ON TABLE tpl_activity_log IS 'Activity log for all 3PL operations';
