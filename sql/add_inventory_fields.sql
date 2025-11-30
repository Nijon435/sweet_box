-- Migration: Add new fields to inventory table
-- Run this to update existing inventory table with new columns

-- Add new columns to inventory table
ALTER TABLE inventory 
  ADD COLUMN IF NOT EXISTS date_purchased DATE,
  ADD COLUMN IF NOT EXISTS use_by_date DATE,
  ADD COLUMN IF NOT EXISTS reorder_point NUMERIC(12,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_restocked DATE,
  ADD COLUMN IF NOT EXISTS total_used NUMERIC(12,2) DEFAULT 0;

-- Update existing records with default values
UPDATE inventory 
SET 
  date_purchased = CURRENT_DATE - INTERVAL '7 days',
  reorder_point = CASE 
    WHEN category = 'cakes & pastries' THEN 5
    WHEN category = 'beverages' THEN 15
    WHEN category = 'ingredients' THEN 5
    WHEN category = 'supplies' THEN 20
    ELSE 10
  END,
  last_restocked = CURRENT_DATE - INTERVAL '7 days',
  total_used = 0,
  use_by_date = CASE 
    WHEN category = 'cakes & pastries' THEN CURRENT_DATE + INTERVAL '3 days'
    WHEN category = 'beverages' THEN CURRENT_DATE + INTERVAL '90 days'
    WHEN category = 'ingredients' THEN CURRENT_DATE + INTERVAL '30 days'
    ELSE NULL
  END
WHERE date_purchased IS NULL;

-- End of migration
