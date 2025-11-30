-- Add profile_edit_requests table for tracking employee profile change requests
CREATE TABLE IF NOT EXISTS profile_edit_requests (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  requested_changes JSONB NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by VARCHAR(64),
  reviewed_at TIMESTAMP,
  review_note TEXT,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Rename leave_requests table to requests (generic for all request types)
-- Note: In production, you would use ALTER TABLE RENAME, but for schema consistency:
DROP TABLE IF EXISTS leave_requests CASCADE;

CREATE TABLE IF NOT EXISTS requests (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  request_type VARCHAR(32) NOT NULL, -- 'leave' or 'profile_edit'
  
  -- Leave request fields
  start_date DATE,
  end_date DATE,
  reason TEXT,
  
  -- Profile edit request fields
  requested_changes JSONB,
  
  -- Common fields
  status VARCHAR(32) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by VARCHAR(64),
  reviewed_at TIMESTAMP,
  review_note TEXT,
  
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Migration: Copy data from old leave_requests to new requests table
-- INSERT INTO requests (id, employee_id, request_type, start_date, end_date, reason, status, requested_at, reviewed_by, reviewed_at)
-- SELECT id, employee_id, 'leave', start_date, end_date, reason, status, requested_at, approved_by, approved_at
-- FROM leave_requests;
