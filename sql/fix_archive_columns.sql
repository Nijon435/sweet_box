-- Migration: Fix archive columns
-- Remove archived_by from users table (users don't track who archived them)
-- Add archive columns to attendance_logs table

-- Remove archived_by from users table
ALTER TABLE users DROP COLUMN IF EXISTS archived_by;

-- Add archive columns to attendance_logs
ALTER TABLE attendance_logs 
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS archived_by VARCHAR(64);

-- Add foreign key for archived_by in attendance_logs
ALTER TABLE attendance_logs 
  ADD CONSTRAINT fk_attendance_logs_archived_by 
  FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
