-- Migration script to consolidate users and employees tables
-- Run this after updating schema.sql and seeds.sql

-- Step 1: Drop the old employees table (CASCADE will also drop foreign keys)
DROP TABLE IF EXISTS employees CASCADE;

-- Step 2: Recreate tables with new schema
-- This will create the unified users table
\i schema.sql

-- Step 3: Load seed data with new structure
\i seeds.sql

-- Verify the migration
SELECT 'Users count:' as info, COUNT(*) as count FROM users;
SELECT 'Attendance logs count:' as info, COUNT(*) as count FROM attendance_logs;
SELECT 'Admin users:' as info, name, email, permission FROM users WHERE permission = 'admin';
SELECT 'Non-admin users:' as info, name, role, shift_start FROM users WHERE permission != 'admin';
