-- ============================================================================
-- QuickWMS Database Migration: 005_analytics.sql
-- Analytics, reporting, and dashboard tables
-- ============================================================================

-- ============================================================================
-- DAILY SNAPSHOTS TABLE (For trend analysis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_daily_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE NOT NULL,
    location VARCHAR(50) DEFAULT 'ALL',

    -- Inventory counts
    total_items INTEGER DEFAULT 0,
    items_received INTEGER DEFAULT 0,
    items_graded INTEGER DEFAULT 0,
    items_listed INTEGER DEFAULT 0,
    items_sold INTEGER DEFAULT 0,
    items_shipped INTEGER DEFAULT 0,
    items_returned INTEGER DEFAULT 0,
    items_salvaged INTEGER DEFAULT 0,

    -- Inventory by status
    status_received INTEGER DEFAULT 0,
    status_grading INTEGER DEFAULT 0,
    status_graded INTEGER DEFAULT 0,
    status_listed INTEGER DEFAULT 0,
    status_sold INTEGER DEFAULT 0,
    status_shipped INTEGER DEFAULT 0,
    status_salvage INTEGER DEFAULT 0,

    -- Values
    total_inventory_cost DECIMAL(14,2) DEFAULT 0,
    total_inventory_msrp DECIMAL(14,2) DEFAULT 0,
    total_listed_value DECIMAL(14,2) DEFAULT 0,

    -- Sales
    daily_sales_count INTEGER DEFAULT 0,
    daily_sales_revenue DECIMAL(14,2) DEFAULT 0,
    daily_sales_cost DECIMAL(14,2) DEFAULT 0,
    daily_gross_profit DECIMAL(14,2) DEFAULT 0,

    -- Averages
    avg_days_to_sale DECIMAL(8,2),
    avg_margin_percent DECIMAL(8,2),

    -- Pallets
    pallets_received INTEGER DEFAULT 0,
    pallets_built INTEGER DEFAULT 0,
    pallets_shipped INTEGER DEFAULT 0,

    -- 3PL
    tpl_units_stored INTEGER DEFAULT 0,
    tpl_orders_fulfilled INTEGER DEFAULT 0,
    tpl_revenue DECIMAL(12,2) DEFAULT 0,

    -- Consignment
    consignment_units INTEGER DEFAULT 0,
    consignment_sales DECIMAL(12,2) DEFAULT 0,

    -- Audit
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint
    CONSTRAINT uq_daily_snapshot UNIQUE (snapshot_date, location)
);

-- ============================================================================
-- WEEKLY METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_weekly_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    week_number INTEGER,
    year INTEGER,
    location VARCHAR(50) DEFAULT 'ALL',

    -- Volume metrics
    units_received INTEGER DEFAULT 0,
    units_processed INTEGER DEFAULT 0,
    units_sold INTEGER DEFAULT 0,
    units_salvaged INTEGER DEFAULT 0,

    -- Financial metrics
    total_revenue DECIMAL(14,2) DEFAULT 0,
    total_cogs DECIMAL(14,2) DEFAULT 0,
    gross_profit DECIMAL(14,2) DEFAULT 0,
    gross_margin_percent DECIMAL(8,2) DEFAULT 0,

    -- Operating costs (if tracked)
    labor_cost DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    supplies_cost DECIMAL(12,2) DEFAULT 0,
    platform_fees DECIMAL(12,2) DEFAULT 0,

    -- Efficiency metrics
    avg_processing_time_hours DECIMAL(8,2),
    avg_days_to_list DECIMAL(8,2),
    avg_days_to_sale DECIMAL(8,2),

    -- By condition
    sold_new_sealed INTEGER DEFAULT 0,
    sold_open_box INTEGER DEFAULT 0,
    sold_used INTEGER DEFAULT 0,
    sold_salvage INTEGER DEFAULT 0,

    -- By channel
    sales_ebay INTEGER DEFAULT 0,
    sales_amazon INTEGER DEFAULT 0,
    sales_whatnot INTEGER DEFAULT 0,
    sales_wholesale INTEGER DEFAULT 0,
    sales_other INTEGER DEFAULT 0,

    -- Top categories
    top_categories JSONB,                        -- {category: count, ...}

    -- Audit
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_weekly_metrics UNIQUE (week_start, location)
);

-- ============================================================================
-- MONTHLY SUMMARY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_monthly_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_start DATE NOT NULL,
    month_end DATE NOT NULL,
    month INTEGER,
    year INTEGER,
    location VARCHAR(50) DEFAULT 'ALL',

    -- Volume
    units_acquired INTEGER DEFAULT 0,
    units_sold INTEGER DEFAULT 0,
    units_salvaged INTEGER DEFAULT 0,
    net_inventory_change INTEGER DEFAULT 0,

    -- Financials
    acquisition_cost DECIMAL(14,2) DEFAULT 0,
    total_revenue DECIMAL(14,2) DEFAULT 0,
    total_cogs DECIMAL(14,2) DEFAULT 0,
    gross_profit DECIMAL(14,2) DEFAULT 0,
    gross_margin_percent DECIMAL(8,2) DEFAULT 0,

    -- Operating metrics
    total_operating_costs DECIMAL(14,2) DEFAULT 0,
    net_operating_profit DECIMAL(14,2) DEFAULT 0,

    -- By supplier
    supplier_breakdown JSONB,                    -- {supplier_code: {units, cost, revenue}, ...}

    -- By retailer source
    retailer_breakdown JSONB,                    -- {retailer: {units, cost, revenue}, ...}

    -- By marketplace
    marketplace_breakdown JSONB,                 -- {marketplace: {sales, revenue, fees}, ...}

    -- By category
    category_breakdown JSONB,                    -- {category: {units, revenue, margin}, ...}

    -- Inventory health
    ending_inventory_units INTEGER DEFAULT 0,
    ending_inventory_value DECIMAL(14,2) DEFAULT 0,
    aged_inventory_30_plus INTEGER DEFAULT 0,
    aged_inventory_60_plus INTEGER DEFAULT 0,
    aged_inventory_90_plus INTEGER DEFAULT 0,

    -- 3PL business
    tpl_revenue DECIMAL(12,2) DEFAULT 0,
    tpl_new_clients INTEGER DEFAULT 0,

    -- Consignment business
    consignment_revenue DECIMAL(12,2) DEFAULT 0,
    consignment_payouts DECIMAL(12,2) DEFAULT 0,

    -- Notes
    notes TEXT,

    -- Audit
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    finalized BOOLEAN DEFAULT false,
    finalized_at TIMESTAMPTZ,
    finalized_by VARCHAR(100),

    CONSTRAINT uq_monthly_summary UNIQUE (month_start, location)
);

-- ============================================================================
-- SUPPLIER PERFORMANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_supplier_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    supplier_code VARCHAR(10),

    -- Volume
    manifests_received INTEGER DEFAULT 0,
    units_received INTEGER DEFAULT 0,
    pallets_received INTEGER DEFAULT 0,

    -- Costs
    total_cost DECIMAL(14,2) DEFAULT 0,
    avg_cost_per_unit DECIMAL(10,2) DEFAULT 0,
    total_msrp DECIMAL(14,2) DEFAULT 0,
    cost_to_msrp_ratio DECIMAL(8,4) DEFAULT 0,

    -- Quality metrics
    units_graded_a INTEGER DEFAULT 0,
    units_graded_b INTEGER DEFAULT 0,
    units_graded_c INTEGER DEFAULT 0,
    units_salvaged INTEGER DEFAULT 0,
    quality_score DECIMAL(5,2),                  -- 1-100

    -- Manifest accuracy
    manifest_accuracy_percent DECIMAL(5,2),
    missing_items INTEGER DEFAULT 0,
    extra_items INTEGER DEFAULT 0,
    condition_mismatches INTEGER DEFAULT 0,

    -- Profitability
    units_sold INTEGER DEFAULT 0,
    total_revenue DECIMAL(14,2) DEFAULT 0,
    gross_profit DECIMAL(14,2) DEFAULT 0,
    profit_margin_percent DECIMAL(8,2) DEFAULT 0,
    roi_percent DECIMAL(8,2) DEFAULT 0,

    -- Turnaround
    avg_days_to_sale DECIMAL(8,2),

    -- Audit
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_supplier_performance UNIQUE (period_start, supplier_id)
);

-- ============================================================================
-- CATEGORY PERFORMANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_category_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),

    -- Volume
    units_received INTEGER DEFAULT 0,
    units_sold INTEGER DEFAULT 0,
    units_salvaged INTEGER DEFAULT 0,
    current_inventory INTEGER DEFAULT 0,

    -- Financials
    total_cost DECIMAL(14,2) DEFAULT 0,
    total_revenue DECIMAL(14,2) DEFAULT 0,
    gross_profit DECIMAL(14,2) DEFAULT 0,
    margin_percent DECIMAL(8,2) DEFAULT 0,

    -- Sell-through
    sell_through_rate DECIMAL(8,2),              -- Percentage sold
    avg_days_to_sale DECIMAL(8,2),

    -- Pricing
    avg_msrp DECIMAL(10,2),
    avg_sale_price DECIMAL(10,2),
    price_realization DECIMAL(8,2),              -- Sale price / MSRP

    -- By condition
    condition_breakdown JSONB,                   -- {condition: {count, revenue}, ...}

    -- Top brands
    top_brands JSONB,                            -- {brand: count, ...}

    -- Audit
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_category_performance UNIQUE (period_start, category, subcategory)
);

-- ============================================================================
-- MARKETPLACE PERFORMANCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_marketplace_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    marketplace marketplace_type NOT NULL,

    -- Volume
    listings_active INTEGER DEFAULT 0,
    listings_created INTEGER DEFAULT 0,
    listings_sold INTEGER DEFAULT 0,
    listings_ended INTEGER DEFAULT 0,

    -- Sales
    total_sales INTEGER DEFAULT 0,
    total_revenue DECIMAL(14,2) DEFAULT 0,
    avg_sale_price DECIMAL(10,2) DEFAULT 0,

    -- Fees
    platform_fees DECIMAL(12,2) DEFAULT 0,
    payment_fees DECIMAL(12,2) DEFAULT 0,
    total_fees DECIMAL(12,2) DEFAULT 0,
    fee_percentage DECIMAL(8,2) DEFAULT 0,

    -- Net
    net_revenue DECIMAL(14,2) DEFAULT 0,

    -- Performance
    sell_through_rate DECIMAL(8,2),
    avg_days_to_sale DECIMAL(8,2),

    -- Listing quality
    avg_views_per_listing DECIMAL(10,2),
    avg_watchers_per_listing DECIMAL(8,2),
    conversion_rate DECIMAL(8,4),

    -- Returns
    return_count INTEGER DEFAULT 0,
    return_rate DECIMAL(8,2),

    -- Audit
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_marketplace_performance UNIQUE (period_start, marketplace)
);

-- ============================================================================
-- INVENTORY AGING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_inventory_aging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE NOT NULL,
    location VARCHAR(50) DEFAULT 'ALL',

    -- Age buckets (count and value)
    age_0_7_count INTEGER DEFAULT 0,
    age_0_7_value DECIMAL(12,2) DEFAULT 0,

    age_8_14_count INTEGER DEFAULT 0,
    age_8_14_value DECIMAL(12,2) DEFAULT 0,

    age_15_30_count INTEGER DEFAULT 0,
    age_15_30_value DECIMAL(12,2) DEFAULT 0,

    age_31_60_count INTEGER DEFAULT 0,
    age_31_60_value DECIMAL(12,2) DEFAULT 0,

    age_61_90_count INTEGER DEFAULT 0,
    age_61_90_value DECIMAL(12,2) DEFAULT 0,

    age_91_180_count INTEGER DEFAULT 0,
    age_91_180_value DECIMAL(12,2) DEFAULT 0,

    age_181_365_count INTEGER DEFAULT 0,
    age_181_365_value DECIMAL(12,2) DEFAULT 0,

    age_365_plus_count INTEGER DEFAULT 0,
    age_365_plus_value DECIMAL(12,2) DEFAULT 0,

    -- Summary
    total_count INTEGER DEFAULT 0,
    total_value DECIMAL(14,2) DEFAULT 0,
    avg_age_days DECIMAL(8,2),

    -- By status
    aging_by_status JSONB,                       -- {status: {count, value, avg_age}, ...}

    -- By category
    aging_by_category JSONB,                     -- {category: {count, value, avg_age}, ...}

    -- Audit
    generated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_inventory_aging UNIQUE (snapshot_date, location)
);

-- ============================================================================
-- KPI DASHBOARD TABLE (Real-time KPIs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_kpi_dashboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_name VARCHAR(100) NOT NULL,
    kpi_category VARCHAR(50) NOT NULL,           -- inventory, sales, operations, financial

    -- Current value
    current_value DECIMAL(14,4),
    current_value_text VARCHAR(100),

    -- Comparison
    previous_value DECIMAL(14,4),
    change_percent DECIMAL(8,2),
    change_direction VARCHAR(10),                -- up, down, flat

    -- Target
    target_value DECIMAL(14,4),
    vs_target_percent DECIMAL(8,2),

    -- Display
    display_format VARCHAR(20) DEFAULT 'number', -- number, currency, percent, text
    display_order INTEGER,
    is_visible BOOLEAN DEFAULT true,

    -- Thresholds for color coding
    threshold_warning DECIMAL(14,4),
    threshold_critical DECIMAL(14,4),
    threshold_direction VARCHAR(10),             -- above, below

    -- Last updated
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_kpi_name UNIQUE (kpi_name)
);

-- Insert default KPIs
INSERT INTO analytics_kpi_dashboard (kpi_name, kpi_category, display_format, display_order) VALUES
    ('total_inventory_units', 'inventory', 'number', 1),
    ('total_inventory_value', 'inventory', 'currency', 2),
    ('items_awaiting_grading', 'inventory', 'number', 3),
    ('items_listed', 'inventory', 'number', 4),
    ('aged_inventory_90_plus', 'inventory', 'number', 5),
    ('daily_sales_count', 'sales', 'number', 10),
    ('daily_revenue', 'sales', 'currency', 11),
    ('daily_profit', 'sales', 'currency', 12),
    ('avg_days_to_sale', 'sales', 'number', 13),
    ('sell_through_rate', 'sales', 'percent', 14),
    ('orders_pending', 'operations', 'number', 20),
    ('orders_shipped_today', 'operations', 'number', 21),
    ('receiving_pending', 'operations', 'number', 22),
    ('grading_queue', 'operations', 'number', 23),
    ('mtd_revenue', 'financial', 'currency', 30),
    ('mtd_gross_profit', 'financial', 'currency', 31),
    ('mtd_margin_percent', 'financial', 'percent', 32),
    ('ytd_revenue', 'financial', 'currency', 33)
ON CONFLICT (kpi_name) DO NOTHING;

-- ============================================================================
-- SAVED REPORTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_saved_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,            -- inventory, sales, supplier, custom
    description TEXT,

    -- Report definition
    query_definition JSONB NOT NULL,             -- Filters, groupings, date range, etc.
    column_config JSONB,                         -- Column visibility, order, formatting
    chart_config JSONB,                          -- Chart type, axes, etc.

    -- Sharing
    is_public BOOLEAN DEFAULT false,
    shared_with TEXT[],                          -- User IDs who can access

    -- Scheduling
    is_scheduled BOOLEAN DEFAULT false,
    schedule_cron VARCHAR(100),
    email_recipients TEXT[],
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,

    -- Audit
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- REPORT EXECUTION LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_report_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES analytics_saved_reports(id),
    report_name VARCHAR(255),

    -- Execution details
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by VARCHAR(100),
    execution_type VARCHAR(20) DEFAULT 'manual', -- manual, scheduled, api

    -- Parameters used
    parameters JSONB,
    date_range_start DATE,
    date_range_end DATE,

    -- Results
    row_count INTEGER,
    execution_time_ms INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'success',        -- success, failed, timeout
    error_message TEXT,

    -- Export
    export_format VARCHAR(20),                   -- csv, excel, pdf
    export_url VARCHAR(500)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Daily Snapshots
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON analytics_daily_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_location ON analytics_daily_snapshots(location);

-- Weekly Metrics
CREATE INDEX IF NOT EXISTS idx_weekly_metrics_date ON analytics_weekly_metrics(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_metrics_year_week ON analytics_weekly_metrics(year, week_number);

-- Monthly Summary
CREATE INDEX IF NOT EXISTS idx_monthly_summary_date ON analytics_monthly_summary(month_start);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_year_month ON analytics_monthly_summary(year, month);

-- Supplier Performance
CREATE INDEX IF NOT EXISTS idx_supplier_performance_period ON analytics_supplier_performance(period_start);
CREATE INDEX IF NOT EXISTS idx_supplier_performance_supplier ON analytics_supplier_performance(supplier_id);

-- Category Performance
CREATE INDEX IF NOT EXISTS idx_category_performance_period ON analytics_category_performance(period_start);
CREATE INDEX IF NOT EXISTS idx_category_performance_category ON analytics_category_performance(category);

-- Marketplace Performance
CREATE INDEX IF NOT EXISTS idx_marketplace_performance_period ON analytics_marketplace_performance(period_start);
CREATE INDEX IF NOT EXISTS idx_marketplace_performance_marketplace ON analytics_marketplace_performance(marketplace);

-- Inventory Aging
CREATE INDEX IF NOT EXISTS idx_inventory_aging_date ON analytics_inventory_aging(snapshot_date);

-- KPI Dashboard
CREATE INDEX IF NOT EXISTS idx_kpi_dashboard_category ON analytics_kpi_dashboard(kpi_category);

-- Saved Reports
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON analytics_saved_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON analytics_saved_reports(created_by);

-- Report Log
CREATE INDEX IF NOT EXISTS idx_report_log_report ON analytics_report_log(report_id);
CREATE INDEX IF NOT EXISTS idx_report_log_date ON analytics_report_log(executed_at);

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================================================

-- Current inventory summary by status
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_by_status AS
SELECT
    status,
    location,
    COUNT(*) AS item_count,
    SUM(cost) AS total_cost,
    SUM(msrp) AS total_msrp,
    SUM(list_price) AS total_list_value,
    AVG(EXTRACT(EPOCH FROM (NOW() - received_at)) / 86400)::DECIMAL(8,2) AS avg_age_days
FROM items
WHERE status NOT IN ('shipped', 'disposed')
GROUP BY status, location;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inventory_by_status
    ON mv_inventory_by_status(status, location);

-- Sales by day for last 90 days
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_sales AS
SELECT
    DATE(sold_at) AS sale_date,
    marketplace,
    COUNT(*) AS sales_count,
    SUM(sold_price) AS revenue,
    SUM(cost) AS cogs,
    SUM(sold_price - cost) AS gross_profit
FROM items
WHERE sold_at >= NOW() - INTERVAL '90 days'
    AND status = 'sold'
GROUP BY DATE(sold_at), marketplace;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_sales
    ON mv_daily_sales(sale_date, marketplace);

-- Top sellers
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_sellers AS
SELECT
    brand,
    category,
    COUNT(*) AS units_sold,
    SUM(sold_price) AS total_revenue,
    AVG(sold_price) AS avg_sale_price,
    AVG(EXTRACT(EPOCH FROM (sold_at - received_at)) / 86400)::DECIMAL(8,2) AS avg_days_to_sale
FROM items
WHERE sold_at >= NOW() - INTERVAL '30 days'
    AND status = 'sold'
GROUP BY brand, category
ORDER BY units_sold DESC
LIMIT 100;

-- ============================================================================
-- FUNCTION TO REFRESH MATERIALIZED VIEWS
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_by_status;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales;
    REFRESH MATERIALIZED VIEW mv_top_sellers;  -- No unique index, so no CONCURRENTLY
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION TO GENERATE DAILY SNAPSHOT
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_daily_snapshot(p_date DATE DEFAULT CURRENT_DATE, p_location VARCHAR DEFAULT 'ALL')
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO analytics_daily_snapshots (
        snapshot_date,
        location,
        total_items,
        items_received,
        items_graded,
        items_listed,
        items_sold,
        items_shipped,
        items_salvaged,
        status_received,
        status_grading,
        status_graded,
        status_listed,
        status_sold,
        status_shipped,
        status_salvage,
        total_inventory_cost,
        total_inventory_msrp,
        daily_sales_count,
        daily_sales_revenue
    )
    SELECT
        p_date,
        p_location,
        COUNT(*),
        COUNT(*) FILTER (WHERE DATE(received_at) = p_date),
        COUNT(*) FILTER (WHERE DATE(graded_at) = p_date),
        COUNT(*) FILTER (WHERE DATE(listed_at) = p_date),
        COUNT(*) FILTER (WHERE DATE(sold_at) = p_date),
        COUNT(*) FILTER (WHERE DATE(shipped_at) = p_date),
        COUNT(*) FILTER (WHERE status = 'salvage' AND DATE(updated_at) = p_date),
        COUNT(*) FILTER (WHERE status = 'received'),
        COUNT(*) FILTER (WHERE status = 'grading'),
        COUNT(*) FILTER (WHERE status = 'graded'),
        COUNT(*) FILTER (WHERE status = 'listed'),
        COUNT(*) FILTER (WHERE status = 'sold'),
        COUNT(*) FILTER (WHERE status = 'shipped'),
        COUNT(*) FILTER (WHERE status = 'salvage'),
        COALESCE(SUM(cost) FILTER (WHERE status NOT IN ('shipped', 'disposed', 'salvage')), 0),
        COALESCE(SUM(msrp) FILTER (WHERE status NOT IN ('shipped', 'disposed', 'salvage')), 0),
        COUNT(*) FILTER (WHERE DATE(sold_at) = p_date),
        COALESCE(SUM(sold_price) FILTER (WHERE DATE(sold_at) = p_date), 0)
    FROM items
    WHERE p_location = 'ALL' OR location = p_location
    ON CONFLICT (snapshot_date, location)
    DO UPDATE SET
        total_items = EXCLUDED.total_items,
        items_received = EXCLUDED.items_received,
        items_graded = EXCLUDED.items_graded,
        items_listed = EXCLUDED.items_listed,
        items_sold = EXCLUDED.items_sold,
        items_shipped = EXCLUDED.items_shipped,
        items_salvaged = EXCLUDED.items_salvaged,
        status_received = EXCLUDED.status_received,
        status_grading = EXCLUDED.status_grading,
        status_graded = EXCLUDED.status_graded,
        status_listed = EXCLUDED.status_listed,
        status_sold = EXCLUDED.status_sold,
        status_shipped = EXCLUDED.status_shipped,
        status_salvage = EXCLUDED.status_salvage,
        total_inventory_cost = EXCLUDED.total_inventory_cost,
        total_inventory_msrp = EXCLUDED.total_inventory_msrp,
        daily_sales_count = EXCLUDED.daily_sales_count,
        daily_sales_revenue = EXCLUDED.daily_sales_revenue,
        generated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE analytics_daily_snapshots IS 'Daily point-in-time snapshots of inventory and sales metrics';
COMMENT ON TABLE analytics_weekly_metrics IS 'Weekly aggregated performance metrics';
COMMENT ON TABLE analytics_monthly_summary IS 'Monthly financial and operational summaries';
COMMENT ON TABLE analytics_supplier_performance IS 'Supplier performance analytics by period';
COMMENT ON TABLE analytics_category_performance IS 'Product category performance analytics';
COMMENT ON TABLE analytics_marketplace_performance IS 'Sales channel/marketplace performance analytics';
COMMENT ON TABLE analytics_inventory_aging IS 'Inventory aging analysis snapshots';
COMMENT ON TABLE analytics_kpi_dashboard IS 'Real-time KPI values for dashboard display';
COMMENT ON TABLE analytics_saved_reports IS 'User-saved report definitions';
COMMENT ON TABLE analytics_report_log IS 'Report execution history';
COMMENT ON MATERIALIZED VIEW mv_inventory_by_status IS 'Current inventory summary by status (refresh periodically)';
COMMENT ON MATERIALIZED VIEW mv_daily_sales IS 'Sales by day for last 90 days (refresh periodically)';
COMMENT ON MATERIALIZED VIEW mv_top_sellers IS 'Top selling brands/categories last 30 days';
