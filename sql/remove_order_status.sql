-- Migration to remove order status columns
-- Run this to update the existing database

-- Remove status and served_at columns from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS status;
ALTER TABLE orders DROP COLUMN IF EXISTS served_at;

-- Update default permission in users table from 'front_staff' to 'staff'
ALTER TABLE users ALTER COLUMN permission SET DEFAULT 'staff';

-- Update existing users with old permissions to new ones
UPDATE users SET permission = 'staff' WHERE permission = 'front_staff';
UPDATE users SET permission = 'staff' WHERE permission = 'delivery_staff';
