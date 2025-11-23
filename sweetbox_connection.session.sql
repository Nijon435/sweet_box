-- create_tables_and_queries.sql
-- SQL DDL and example CRUD queries inferred from java.js (MySQL compatible / InnoDB)
-- Adjust types and constraints for your target SQL dialect as needed.

-- PostgreSQL compatible SQL (converted from MySQL-style file)
-- Note: run this in a database where you have CREATE rights.

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
  total NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'pending',
  type VARCHAR(32) DEFAULT 'dine-in',
  timestamp TIMESTAMP NOT NULL,
  served_at TIMESTAMP DEFAULT NULL
);

-- Sales history (daily totals)
CREATE TABLE IF NOT EXISTS sales_history (
  date DATE NOT NULL PRIMARY KEY,
  total NUMERIC(14,2) DEFAULT 0
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

-- end of schema creation


-- ===================================================
-- Example queries (CRUD and common reports)
-- ===================================================

-- 1) Get latest attendance per employee
SELECT e.id, e.name, al.action, al.timestamp
FROM employees e
LEFT JOIN attendance_logs al ON al.employee_id = e.id
  AND al.timestamp = (
    SELECT MAX(timestamp) FROM attendance_logs WHERE employee_id = e.id
  )
ORDER BY e.name;

-- 2) Low stock items (quantity <= reorder_point)
SELECT id, category, name, quantity, unit, reorder_point
FROM inventory
WHERE quantity <= reorder_point
ORDER BY quantity ASC;

-- 3) Orders by status
SELECT id, customer, items, total, status, type, timestamp
FROM orders
WHERE status = 'pending'
ORDER BY timestamp DESC;

-- 4) Total sales in a date range
SELECT SUM(total) AS total_sales
FROM sales_history
WHERE date BETWEEN '2025-11-01' AND '2025-11-30';

-- 5) Average ticket (using latest orders)
SELECT (SUM(o.total) / GREATEST(COUNT(o.id),1)) AS avg_ticket
FROM orders o
WHERE o.timestamp >= NOW() - INTERVAL '30 days';

-- 6) Mark an order served (update status and served_at)
UPDATE orders
SET status = 'served', served_at = NOW()
WHERE id = 'ord-203';

-- 7) Decrease inventory based on usage (example: reduce cake slices by 1)
UPDATE inventory
SET quantity = quantity - 1
WHERE id = 'inv-3' AND quantity > 0;

-- 8) Add an attendance log (example)
INSERT INTO attendance_logs (id, employee_id, action, timestamp, note)
VALUES ('att-' || FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint, 'emp-3', 'in', NOW(), 'Manual log');

-- 9) Performance leaderboard
SELECT p.employee_id, e.name, p.rating, p.completed_orders
FROM performance_scores p
JOIN employees e ON e.id = p.employee_id
ORDER BY p.rating DESC, p.completed_orders DESC;

-- 10) Inventory value summary
SELECT SUM(quantity * cost) AS inventory_value FROM inventory;

-- End of file
