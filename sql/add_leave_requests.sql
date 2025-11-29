-- Add leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(32) DEFAULT 'pending',  -- pending, approved, rejected
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
