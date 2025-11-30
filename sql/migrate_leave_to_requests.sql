-- Migration script to convert leave_requests table to requests table
-- This preserves all existing data and adds the new request_type field

-- Step 1: Create requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(32) NOT NULL DEFAULT 'leave',
    start_date DATE,
    end_date DATE,
    reason TEXT,
    requested_changes JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TIMESTAMP
);

-- Step 2: Copy all data from leave_requests to requests
INSERT INTO requests (
    id,
    employee_id,
    request_type,
    start_date,
    end_date,
    reason,
    requested_changes,
    status,
    requested_at,
    reviewed_by,
    reviewed_at
)
SELECT
    id,
    employee_id,
    'leave' as request_type,  -- All existing requests are leave requests
    start_date,
    end_date,
    reason,
    NULL as requested_changes,  -- Leave requests don't have profile changes
    status,
    requested_at,
    approved_by as reviewed_by,  -- Rename approved_by to reviewed_by
    approved_at as reviewed_at   -- Rename approved_at to reviewed_at
FROM leave_requests
ON CONFLICT (id) DO NOTHING;  -- Skip if already exists

-- Step 3: Verify migration
SELECT 
    'Migration complete' as status,
    (SELECT COUNT(*) FROM leave_requests) as old_table_count,
    (SELECT COUNT(*) FROM requests WHERE request_type = 'leave') as new_table_count;

-- Step 4: Drop old table (commented out for safety - run manually after verifying)
-- DROP TABLE IF EXISTS leave_requests CASCADE;

-- After running this migration and verifying data:
-- 1. Check that all leave requests are in the requests table
-- 2. Manually uncomment and run the DROP TABLE command above
-- 3. Redeploy the backend with updated code
