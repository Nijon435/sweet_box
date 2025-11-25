-- schema.sql
-- PostgreSQL-compatible CREATE TABLE statements for Sweet Box
-- Run this file first to create the database schema.

-- Accounts / Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  pin VARCHAR(128), -- store hashed PINs in production
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(128) NOT NULL,
  contact VARCHAR(255),
  hire_date DATE,
  status VARCHAR(32) DEFAULT 'active',
  shift_start TIME,
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
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  category VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(12,2) DEFAULT 0,
  unit VARCHAR(32),
  reorder_point INT DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  customer VARCHAR(255),
  items TEXT,
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

-- Performance scores (per employee)
CREATE TABLE IF NOT EXISTS performance_scores (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL UNIQUE,
  rating NUMERIC(3,2) DEFAULT 0,
  completed_orders INT DEFAULT 0,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Stock trends (simple storage for reporting)
CREATE TABLE IF NOT EXISTS stock_trends (
  id SERIAL PRIMARY KEY,
  item VARCHAR(255) NOT NULL UNIQUE,
  turnover INT DEFAULT 0
);

-- End of schema
