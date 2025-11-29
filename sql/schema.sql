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
  permission VARCHAR(32) NOT NULL DEFAULT 'front_staff',
  shift_start TIME,
  hire_date DATE,
  status VARCHAR(32) DEFAULT 'active',
  require_password_reset BOOLEAN DEFAULT FALSE,
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
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(32) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  category VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(12,2) DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  customer VARCHAR(255),
  items_json JSONB,
  total NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'pending',
  type VARCHAR(32) DEFAULT 'dine-in',
  timestamp TIMESTAMP NOT NULL,
  served_at TIMESTAMP DEFAULT NULL
);

-- Sales history (daily totals)
CREATE TABLE IF NOT EXISTS sales_history (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  date DATE NOT NULL,
  total NUMERIC(14,2) DEFAULT 0,
  orders_count INT DEFAULT 0
);

-- Inventory usage (simple table for weekly usage / metrics)
CREATE TABLE IF NOT EXISTS inventory_usage (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL UNIQUE,
  used INT DEFAULT 0
);

-- End of schema
