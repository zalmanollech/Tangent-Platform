-- Traidefi Database Schema
-- Run this in your Supabase SQL Editor to create the required tables

-- Users table (for Traidefi SaaS users)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchases table (track PayPal payments)
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    brand VARCHAR(50) DEFAULT 'traidefi',
    product VARCHAR(50) NOT NULL, -- 'credit-report' or 'insurance-quote'
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'cancelled'
    paypal_order_id VARCHAR(255),
    paypal_payer_id VARCHAR(255),
    form_data JSONB, -- Store form input data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit Reports table
CREATE TABLE IF NOT EXISTS credit_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    purchase_id INTEGER REFERENCES purchases(id),
    brand VARCHAR(50) DEFAULT 'traidefi',
    input_json JSONB NOT NULL, -- Form input data
    score INTEGER, -- 0-100 credit score
    factors JSONB, -- Risk factors and details
    risk_notes TEXT,
    pdf_url VARCHAR(500), -- URL to stored PDF
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Premium Quotes table
CREATE TABLE IF NOT EXISTS premium_quotes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    purchase_id INTEGER REFERENCES purchases(id),
    brand VARCHAR(50) DEFAULT 'traidefi',
    input_json JSONB NOT NULL, -- Form input data
    premium_min DECIMAL(5, 2), -- Minimum premium percentage
    premium_max DECIMAL(5, 2), -- Maximum premium percentage
    assumptions_json JSONB, -- Actuarial assumptions
    pdf_url VARCHAR(500), -- URL to stored PDF (optional)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_paypal_order_id ON purchases(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_credit_reports_user_id ON credit_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reports_purchase_id ON credit_reports(purchase_id);
CREATE INDEX IF NOT EXISTS idx_premium_quotes_user_id ON premium_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_quotes_purchase_id ON premium_quotes(purchase_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

