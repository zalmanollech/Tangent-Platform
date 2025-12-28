-- Migration: Add Risk Engine Fields to Contracts Table
-- STEP 1: Non-breaking addition of risk fields
-- Date: 2025-01-XX
-- Description: Adds nullable risk engine fields to contracts table for future risk scoring

-- This migration is idempotent and safe to run multiple times
-- It will only add columns if they don't already exist

-- Add risk_score column (nullable integer, 1-10 scale)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'risk_score'
    ) THEN
        ALTER TABLE contracts ADD COLUMN risk_score INTEGER;
        COMMENT ON COLUMN contracts.risk_score IS 'Risk score from 1-10 (null = not calculated yet)';
    END IF;
END $$;

-- Add risk_band column (nullable string, e.g., 'LOW', 'MEDIUM', 'HIGH')
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'risk_band'
    ) THEN
        ALTER TABLE contracts ADD COLUMN risk_band VARCHAR(50);
        COMMENT ON COLUMN contracts.risk_band IS 'Risk band classification (null = not calculated yet)';
    END IF;
END $$;

-- Add max_financing_percent column (nullable decimal, 0-100)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'max_financing_percent'
    ) THEN
        ALTER TABLE contracts ADD COLUMN max_financing_percent DECIMAL(5, 2);
        COMMENT ON COLUMN contracts.max_financing_percent IS 'Maximum financing percentage based on risk (null = not calculated yet)';
    END IF;
END $$;

-- Add required_deposit_percent column (nullable decimal, 0-100)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'required_deposit_percent'
    ) THEN
        ALTER TABLE contracts ADD COLUMN required_deposit_percent DECIMAL(5, 2);
        COMMENT ON COLUMN contracts.required_deposit_percent IS 'Required deposit percentage based on risk (null = not calculated yet)';
    END IF;
END $$;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'contracts' 
    AND column_name IN ('risk_score', 'risk_band', 'max_financing_percent', 'required_deposit_percent')
ORDER BY column_name;











