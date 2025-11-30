-- Add unit column to inventory table if it doesn't exist
-- Run this migration if your database was created before the unit column was added

DO $$ 
BEGIN
    -- Check if unit column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='inventory' AND column_name='unit'
    ) THEN
        ALTER TABLE inventory 
        ADD COLUMN unit VARCHAR(32) DEFAULT 'kg';
        
        RAISE NOTICE 'Unit column added to inventory table';
    ELSE
        RAISE NOTICE 'Unit column already exists in inventory table';
    END IF;
END $$;
