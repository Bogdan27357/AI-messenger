-- MAS AI System - Database Initialization

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ Categorizer Tables ============

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tmc_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article VARCHAR(100),
    name VARCHAR(500) NOT NULL,
    unit VARCHAR(50),
    group_name VARCHAR(255),
    category_id UUID REFERENCES categories(id),
    external_id VARCHAR(255),
    qdrant_point_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    inn VARCHAR(12),
    email VARCHAR(255),
    phone VARCHAR(50),
    region VARCHAR(255),
    external_id VARCHAR(255),
    qdrant_point_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 1.0,
    source VARCHAR(50) DEFAULT 'auto',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(supplier_id, category_id)
);

CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number VARCHAR(100) NOT NULL,
    tmc_item_id UUID REFERENCES tmc_items(id),
    description TEXT,
    requester_name VARCHAR(255),
    requester_email VARCHAR(255),
    category_id UUID REFERENCES categories(id),
    status VARCHAR(50) DEFAULT 'new',
    external_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name VARCHAR(500),
    price DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    payment_terms TEXT,
    delivery_days INTEGER,
    currency VARCHAR(10) DEFAULT 'RUB',
    raw_text TEXT,
    file_path VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'received',
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kp_mailings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id),
    mailing_type VARCHAR(20) DEFAULT 'initial',
    sent_at TIMESTAMP DEFAULT NOW(),
    supplier_emails TEXT[],
    email_subject VARCHAR(500),
    status VARCHAR(50) DEFAULT 'sent'
);

-- ============ Legal Tables ============

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(100),
    title VARCHAR(500),
    counterparty_name VARCHAR(500),
    counterparty_inn VARCHAR(12),
    contract_type VARCHAR(100),
    file_path VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'pending_review',
    overall_risk VARCHAR(20),
    external_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    review_status VARCHAR(50) NOT NULL,
    critical_errors JSONB DEFAULT '[]',
    recommended_edits JSONB DEFAULT '[]',
    discrepancies JSONB DEFAULT '[]',
    risk_assessment JSONB DEFAULT '{}',
    report_file_path VARCHAR(1000),
    reviewer_comment TEXT,
    reviewed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counterparty_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id),
    counterparty_inn VARCHAR(12) NOT NULL,
    egrul_data JSONB,
    bankruptcy_data JSONB,
    kad_data JSONB,
    fns_data JSONB,
    risk_level VARCHAR(20),
    checked_at TIMESTAMP DEFAULT NOW()
);

-- ============ Travel Tables ============

CREATE TABLE IF NOT EXISTS travel_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(100),
    trip_date_start DATE,
    trip_date_end DATE,
    route TEXT,
    smartway_trip_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
    receipt_type VARCHAR(50),
    file_path VARCHAR(1000),
    ocr_text TEXT,
    route VARCHAR(500),
    travel_date DATE,
    tariff_amount DECIMAL(12, 2),
    service_fee DECIMAL(12, 2),
    other_fees DECIMAL(12, 2),
    total_amount DECIMAL(12, 2),
    vat_tariff DECIMAL(12, 2),
    vat_fees DECIMAL(12, 2),
    currency VARCHAR(10) DEFAULT 'RUB',
    ocr_confidence FLOAT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_1c_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES travel_trips(id),
    request_number VARCHAR(100),
    external_id VARCHAR(255),
    lines JSONB DEFAULT '[]',
    approval_status VARCHAR(50) DEFAULT 'draft',
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    order_number VARCHAR(100),
    order_external_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_diadoc_docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES travel_trips(id),
    request_1c_id UUID REFERENCES travel_1c_requests(id),
    diadoc_document_id VARCHAR(255),
    document_type VARCHAR(50),
    signing_status VARCHAR(50) DEFAULT 'pending',
    signed_by VARCHAR(255),
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============ System Tables ============

CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(50) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(50),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    user_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tmc_items_category ON tmc_items(category_id);
CREATE INDEX idx_tmc_items_external ON tmc_items(external_id);
CREATE INDEX idx_suppliers_inn ON suppliers(inn);
CREATE INDEX idx_supplier_categories_supplier ON supplier_categories(supplier_id);
CREATE INDEX idx_supplier_categories_category ON supplier_categories(category_id);
CREATE INDEX idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX idx_commercial_offers_request ON commercial_offers(purchase_request_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contract_reviews_contract ON contract_reviews(contract_id);
CREATE INDEX idx_travel_trips_status ON travel_trips(status);
CREATE INDEX idx_travel_receipts_trip ON travel_receipts(trip_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_type ON agent_tasks(agent_type, task_type);
CREATE INDEX idx_audit_log_agent ON audit_log(agent_type);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
