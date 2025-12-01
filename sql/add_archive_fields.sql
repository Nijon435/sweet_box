-- Migration to add archive fields to existing tables
-- Run this to update existing databases

-- Add archived fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64);

-- Add archived fields to inventory table
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64);

-- Add archived fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64);

-- Add foreign key constraints (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_archived_by_fkey'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_archived_by_fkey 
        FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_archived_by_fkey'
    ) THEN
        ALTER TABLE inventory ADD CONSTRAINT inventory_archived_by_fkey 
        FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_archived_by_fkey'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_archived_by_fkey 
        FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END$$;

-- Create indexes for better query performance on archived items
CREATE INDEX IF NOT EXISTS idx_users_archived ON users(archived);
CREATE INDEX IF NOT EXISTS idx_inventory_archived ON inventory(archived);
CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived);
