-- schema.sql
-- PostgreSQL-compatible CREATE TABLE statements for Sweet Box
-- Run this file first to create the database schema.

-- Users table (merged employees table into this)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  role VARCHAR(128) NOT NULL,
  permission VARCHAR(32) NOT NULL DEFAULT 'staff',
  shift_start TIME,
  hire_date DATE,
  status VARCHAR(32) DEFAULT 'active',
  require_password_reset BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  archived_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance logs
CREATE TABLE IF NOT EXISTS attendance_logs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  shift VARCHAR(64),
  note TEXT,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  archived_by VARCHAR(64),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Requests table (combined leave and profile edit requests)
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

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  category VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(12,2) DEFAULT 0,
  unit VARCHAR(32) DEFAULT 'kg', 
  cost NUMERIC(12,2) DEFAULT 0,
  date_purchased DATE,
  use_by_date DATE,
  expiry_date DATE,
  reorder_point NUMERIC(12,2) DEFAULT 10,
  last_restocked DATE,
  total_used NUMERIC(12,2) DEFAULT 0,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  archived_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Inventory Usage Logs (tracking usage of inventory items)
CREATE TABLE IF NOT EXISTS inventory_usage_logs (
  id SERIAL PRIMARY KEY,
  inventory_item_id VARCHAR(64) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  reason VARCHAR(64) NOT NULL, -- 'order', 'waste', 'testing', 'staff_consumption', 'spoilage', 'other'
  batch_id VARCHAR(64), -- Groups multiple items logged together
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  archived_by VARCHAR(64),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  customer VARCHAR(255),
  items_json JSONB,
  total NUMERIC(12,2) DEFAULT 0,
  type VARCHAR(32) DEFAULT 'dine-in',
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  archived_by VARCHAR(64),
  timestamp TIMESTAMP NOT NULL,
  FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Sales history (daily totals)
CREATE TABLE IF NOT EXISTS sales_history (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  date DATE NOT NULL,
  total NUMERIC(14,2) DEFAULT 0,
  orders_count INT DEFAULT 0
);

-- Inventory usage (simple table for weekly usage / metrics)
CREATE TABLE IF NOT EXISTS inventory_trends (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL UNIQUE,
  used INT DEFAULT 0
);

-- End of schema
