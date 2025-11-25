-- migrations.sql
-- Run this file to add missing columns to existing tables

-- Add missing columns to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contact VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';

-- Add missing columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items_json JSONB;

-- Modify sales_history to add id and orders_count
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS id VARCHAR(64);
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS orders_count INT DEFAULT 0;

-- If the table doesn't have id as primary key, update it
DO $$ 
BEGIN
    -- Remove old primary key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'sales_history' 
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name = 'sales_history_pkey'
    ) THEN
        ALTER TABLE sales_history DROP CONSTRAINT sales_history_pkey;
    END IF;
    
    -- Set id values for existing rows if needed
    UPDATE sales_history SET id = 'sale-' || EXTRACT(EPOCH FROM date)::TEXT WHERE id IS NULL;
    
    -- Make id NOT NULL and set as primary key
    ALTER TABLE sales_history ALTER COLUMN id SET NOT NULL;
    ALTER TABLE sales_history ADD PRIMARY KEY (id);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration partially completed or already applied';
END $$;
