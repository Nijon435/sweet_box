-- Add created_by column to inventory_usage_logs table
-- Run this to track which user created each usage log

ALTER TABLE inventory_usage_logs 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(64);

ALTER TABLE inventory_usage_logs 
ADD CONSTRAINT fk_usage_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Update existing logs to have NULL created_by (will show as "System")
UPDATE inventory_usage_logs SET created_by = NULL WHERE created_by IS NULL;
