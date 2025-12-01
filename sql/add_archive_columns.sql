-- Add archive columns to orders and inventory tables

-- Add archive columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64);
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS fk_orders_archived_by 
    FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add archive columns to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64);
ALTER TABLE inventory ADD CONSTRAINT IF NOT EXISTS fk_inventory_archived_by 
    FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
