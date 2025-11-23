-- create_tables_and_queries.sql
-- SQL DDL and example CRUD queries inferred from java.js (MySQL compatible / InnoDB)
-- Adjust types and constraints for your target SQL dialect as needed.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Database / schema creation (optional)
-- CREATE DATABASE IF NOT EXISTS cake_restaurant;
-- USE cake_restaurant;

-- Accounts / Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  pin VARCHAR(128), -- store hashed PINs in production
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(128) NOT NULL,
  shift_start TIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Attendance logs
CREATE TABLE IF NOT EXISTS attendance_logs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  shift VARCHAR(64),
  note TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  category VARCHAR(64),
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,2) DEFAULT 0,
  unit VARCHAR(32),
  reorder_point INT DEFAULT 0,
  cost DECIMAL(12,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  customer VARCHAR(255),
  items TEXT,
  total DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'pending',
  type VARCHAR(32) DEFAULT 'dine-in',
  timestamp DATETIME NOT NULL,
  served_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sales history (daily totals)
CREATE TABLE IF NOT EXISTS sales_history (
  date DATE NOT NULL PRIMARY KEY,
  total DECIMAL(14,2) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inventory usage (simple table for weekly usage / metrics)
CREATE TABLE IF NOT EXISTS inventory_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  used INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Performance scores (per employee)
CREATE TABLE IF NOT EXISTS performance_scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  rating DECIMAL(3,2) DEFAULT 0,
  completed_orders INT DEFAULT 0,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock trends (simple storage for reporting)
CREATE TABLE IF NOT EXISTS stock_trends (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item VARCHAR(255) NOT NULL,
  turnover INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ===================================================
-- Sample INSERT statements (seed data from java.js)
-- ===================================================

-- Users
INSERT INTO users (id, name, role, pin)
VALUES
  ('admin-1', 'Sofia Morales', 'admin', '4321'),
  ('staff-1', 'Front Desk', 'staff', '1111'),
  ('staff-2', 'Dining Captain', 'staff', '2222')
ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), pin=VALUES(pin);

-- Employees
INSERT INTO employees (id, name, role, shift_start)
VALUES
  ('emp-1','Ava Santos','Head Baker','07:30'),
  ('emp-2','Luis Mercado','Sous Chef','08:00'),
  ('emp-3','Mia Reyes','Cashier','09:00'),
  ('emp-4','Daniel Cruz','Barista','09:00'),
  ('emp-5','Carina Uy','Pastry Assistant','08:00'),
  ('emp-6','Jasper Lim','Dining Captain','10:00')
ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), shift_start=VALUES(shift_start);

-- Attendance logs
INSERT INTO attendance_logs (id, employee_id, action, timestamp, note)
VALUES
  ('att-101','emp-1','in','2025-11-20 07:24:00','Opened kitchen'),
  ('att-102','emp-2','in','2025-11-20 07:55:00','Prep'),
  ('att-103','emp-3','in','2025-11-20 09:08:00','Traffic'),
  ('att-104','emp-4','in','2025-11-20 08:55:00','Bar set'),
  ('att-105','emp-5','in','2025-11-20 08:10:00',''),
  ('att-106','emp-6','in','2025-11-20 09:58:00','Floor walk'),
  ('att-107','emp-1','out','2025-11-19 16:02:00','')
ON DUPLICATE KEY UPDATE timestamp=VALUES(timestamp), note=VALUES(note);

-- Inventory
INSERT INTO inventory (id, category, name, quantity, unit, reorder_point, cost)
VALUES
  ('inv-1','cakes','Chocolate Truffle Cake',12,'whole',5,28.00),
  ('inv-2','cakes','Ube Macapuno Cake',8,'whole',4,32.00),
  ('inv-3','cakes','Mango Cream Slice',48,'slice',24,5.00),
  ('inv-4','ingredients','Cake Flour',32,'kg',15,2.40),
  ('inv-5','ingredients','Butter',18,'kg',10,3.50),
  ('inv-6','supplies','Cake Boxes',140,'pcs',60,0.60),
  ('inv-7','supplies','Coffee Cups',220,'pcs',120,0.25),
  ('inv-8','beverages','Cold Brew Concentrate',18,'L',8,4.20),
  ('inv-9','beverages','House Iced Tea',25,'L',12,1.80)
ON DUPLICATE KEY UPDATE quantity=VALUES(quantity), cost=VALUES(cost), reorder_point=VALUES(reorder_point);

-- Orders
INSERT INTO orders (id, customer, items, total, status, type, timestamp, served_at)
VALUES
  ('ord-201','Walk-in #1051','Whole Ube Cake',45.00,'ready','takeout','2025-11-20 11:12:00',NULL),
  ('ord-202','Table 7','Steak + Iced Tea',32.00,'preparing','dine-in','2025-11-20 11:25:00',NULL),
  ('ord-203','Delivery #8821','Dozen Ensaymada',26.00,'pending','delivery','2025-11-20 11:45:00',NULL),
  ('ord-204','Table 3','Latte & Croissant',11.00,'served','dine-in','2025-11-20 10:55:00','2025-11-20 10:55:00')
ON DUPLICATE KEY UPDATE status=VALUES(status), served_at=VALUES(served_at);

-- Sales history
INSERT INTO sales_history (date, total)
VALUES
  ('2025-11-07',780.00),('2025-11-08',810.00),('2025-11-09',795.00),('2025-11-10',860.00),
  ('2025-11-11',910.00),('2025-11-12',940.00),('2025-11-13',880.00),('2025-11-14',920.00),
  ('2025-11-15',970.00),('2025-11-16',1010.00),('2025-11-17',985.00),('2025-11-18',1040.00),
  ('2025-11-19',990.00),('2025-11-20',1095.00)
ON DUPLICATE KEY UPDATE total=VALUES(total);

-- Inventory usage
INSERT INTO inventory_usage (label, used)
VALUES
  ('Flour (kg)',36),('Butter (kg)',22),('Sugar (kg)',28),('Fresh Milk (L)',30),('Chocolate (kg)',18)
ON DUPLICATE KEY UPDATE used=VALUES(used);

-- Performance scores
INSERT INTO performance_scores (employee_id, rating, completed_orders)
VALUES
  ('emp-1',4.9,128),('emp-2',4.7,118),('emp-3',4.5,156),('emp-4',4.6,141),('emp-5',4.4,102),('emp-6',4.3,96)
ON DUPLICATE KEY UPDATE rating=VALUES(rating), completed_orders=VALUES(completed_orders);

-- Stock trends
INSERT INTO stock_trends (item, turnover)
VALUES
  ('Chocolate Truffle Cake',58),('Ube Macapuno Cake',54),('Mango Cream Slice',72),
  ('Cake Flour',65),('Cold Brew Concentrate',49),('House Iced Tea',61)
ON DUPLICATE KEY UPDATE turnover=VALUES(turnover);

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
WHERE o.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY);

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
VALUES (CONCAT('att-', UNIX_TIMESTAMP()), 'emp-3', 'in', NOW(), 'Manual log');

-- 9) Performance leaderboard
SELECT p.employee_id, e.name, p.rating, p.completed_orders
FROM performance_scores p
JOIN employees e ON e.id = p.employee_id
ORDER BY p.rating DESC, p.completed_orders DESC;

-- 10) Inventory value summary
SELECT SUM(quantity * cost) AS inventory_value FROM inventory;

-- End of file
