-- cleanup.sql
-- This script clears all data from the database tables
-- Run this before seeding fresh data

-- ========================================
-- DELETE ALL DATA FROM ALL TABLES
-- ========================================

-- Delete in order to respect foreign key constraints

-- Step 1: Delete attendance logs (has FK to employees)
DELETE FROM attendance_logs;

-- Step 2: Delete orders (no FK dependencies)
DELETE FROM orders;

-- Step 3: Delete sales history (no FK dependencies)
DELETE FROM sales_history;

-- Step 4: Delete inventory usage (no FK dependencies, reset sequence)
DELETE FROM inventory_usage;
ALTER SEQUENCE IF EXISTS inventory_usage_id_seq RESTART WITH 1;

-- Step 5: Delete inventory (no FK dependencies)
DELETE FROM inventory;

-- Step 6: Delete employees (referenced by attendance_logs, already cleared)
DELETE FROM employees;

-- Step 7: Delete users (no FK dependencies)
DELETE FROM users;

-- ========================================
-- VERIFICATION
-- ========================================

-- Success message
SELECT 'All data deleted successfully! Database is ready for fresh seeds.' as status;
