-- Migration: Add batch_id and remove order_id from inventory_usage_logs
-- This migration updates the inventory_usage_logs table to support batch logging

-- Add batch_id column for grouping multiple items logged together
ALTER TABLE inventory_usage_logs
ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64);

-- Drop the foreign key constraint for order_id if it exists
ALTER TABLE inventory_usage_logs
DROP CONSTRAINT IF EXISTS inventory_usage_logs_order_id_fkey;

-- Remove order_id column
ALTER TABLE inventory_usage_logs
DROP COLUMN IF EXISTS order_id;

-- Add index on batch_id for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_usage_logs_batch_id 
ON inventory_usage_logs(batch_id);

-- Add index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_inventory_usage_logs_created_at 
ON inventory_usage_logs(created_at DESC);
