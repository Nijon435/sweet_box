-- seeds.sql
-- Sample INSERT statements (pre-made data). Run this after `schema.sql`.
-- Adjust IDs and values to match your needs.

-- Example users (from demo accounts)
-- Users (admin + staff)
INSERT INTO users (id, name, role, pin, created_at) VALUES
  ('admin-1', 'Sofia Morales', 'admin', '4321', NOW()),
  ('staff-1', 'Front Desk', 'inventory_manager', '1111', NOW()),
  ('staff-2', 'Counter Staff', 'staff', '2222', NOW()),
  ('staff-3', 'Luis Navarro', 'staff', '3333', NOW()),
  ('staff-4', 'Anne Lopez', 'staff', '4444', NOW())
ON CONFLICT (id) DO NOTHING;

-- Example employees
-- Employees
INSERT INTO employees (id, name, role, shift_start, created_at) VALUES
  ('emp-1', 'Sofia Morales', 'manager', '08:00', NOW()),
  ('emp-2', 'Juan Dela Cruz', 'cashier', '09:00', NOW()),
  ('emp-3', 'Maria Santos', 'baker', '06:00', NOW()),
  ('emp-4', 'Luis Navarro', 'barista', '07:00', NOW()),
  ('emp-5', 'Anne Lopez', 'cook', '05:30', NOW())
ON CONFLICT (id) DO NOTHING;

-- Example inventory items
-- Inventory (expanded)
INSERT INTO inventory (id, category, name, quantity, unit, reorder_point, cost, created_at) VALUES
  ('inv-1', 'cakes', 'Chocolate Mousse Slice', 40, 'pcs', 6, 120.00, NOW()),
  ('inv-2', 'cakes', 'Classic Cheesecake (whole)', 10, 'pcs', 2, 850.00, NOW()),
  ('inv-3', 'pastries', 'Butter Croissant', 120, 'pcs', 20, 35.00, NOW()),
  ('inv-4', 'pastries', 'Almond Danish', 80, 'pcs', 15, 45.00, NOW()),
  ('inv-5', 'bread', 'Sourdough Loaf', 30, 'pcs', 5, 150.00, NOW()),
  ('inv-6', 'beverages', 'Espresso Shot (single)', 500, 'shots', 100, 20.00, NOW()),
  ('inv-7', 'beverages', 'Bottled Water 500ml', 300, 'btl', 50, 15.00, NOW()),
  ('inv-8', 'confectionery', 'Milk Chocolate Bar 70g', 200, 'pcs', 30, 55.00, NOW()),
  ('inv-9', 'confectionery', 'Assorted Macarons (box of 6)', 45, 'box', 5, 220.00, NOW()),
  ('inv-10', 'ingredients', 'All-purpose Flour', 120.00, 'kg', 20, 40.00, NOW()),
  ('inv-11', 'ingredients', 'Granulated Sugar', 80.00, 'kg', 15, 35.00, NOW()),
  ('inv-12', 'ingredients', 'Unsalted Butter', 60.00, 'kg', 10, 180.00, NOW()),
  ('inv-13', 'ingredients', 'Whole Milk', 200.00, 'L', 30, 45.00, NOW()),
  ('inv-14', 'savoury', 'Ham & Cheese Roll', 50, 'pcs', 8, 70.00, NOW()),
  ('inv-15', 'cakes', 'Red Velvet Slice', 30, 'pcs', 5, 110.00, NOW()),
  ('inv-16', 'beverages', 'Iced Tea 350ml', 140, 'btl', 20, 45.00, NOW()),
  ('inv-17', 'beverages', 'Canned Soda 330ml', 180, 'can', 40, 30.00, NOW()),
  ('inv-18', 'confectionery', 'Gummy Candy Pack', 90, 'pcs', 10, 20.00, NOW()),
  ('inv-19', 'pastries', 'Cinnamon Roll', 70, 'pcs', 10, 50.00, NOW()),
  ('inv-20', 'ingredients', 'Cocoa Powder', 25.00, 'kg', 5, 120.00, NOW())
ON CONFLICT (id) DO NOTHING;

-- Example orders
-- Orders (sample)
INSERT INTO orders (id, customer, items, total, status, type, timestamp, served_at) VALUES
  ('ord-100', 'Table 3', '[{"name":"Chocolate Mousse Slice","qty":2}]', 240.00, 'served', 'dine-in', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 55 minutes'),
  ('ord-101', 'Delivery #201', '[{"name":"Bottled Water 500ml","qty":3}]', 45.00, 'delivering', 'delivery', NOW() - INTERVAL '90 minutes', NULL),
  ('ord-102', 'Takeaway #45', '[{"name":"Butter Croissant","qty":4},{"name":"Espresso Shot (single)","qty":2}]', 160.00, 'served', 'takeaway', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '55 minutes'),
  ('ord-103', 'Walk-in', '[{"name":"Classic Cheesecake (whole)","qty":1}]', 850.00, 'pending', 'pickup', NOW() - INTERVAL '30 minutes', NULL),
  ('ord-104', 'Table 5', '[{"name":"Red Velvet Slice","qty":3},{"name":"Iced Tea 350ml","qty":3}]', 465.00, 'served', 'dine-in', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 55 minutes'),
  ('ord-105', 'Delivery #202', '[{"name":"Assorted Macarons (box of 6)","qty":2}]', 440.00, 'cancelled', 'delivery', NOW() - INTERVAL '6 hours', NULL),
  ('ord-106', 'Online #9001', '[{"name":"Sourdough Loaf","qty":2},{"name":"Gummy Candy Pack","qty":3}]', 340.00, 'pending', 'delivery', NOW() - INTERVAL '20 minutes', NULL),
  ('ord-107', 'Table 1', '[{"name":"Ham & Cheese Roll","qty":2},{"name":"Cinnamon Roll","qty":2}]', 240.00, 'served', 'dine-in', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 55 minutes'),
  ('ord-108', 'Takeaway #46', '[{"name":"Milk Chocolate Bar 70g","qty":5}]', 275.00, 'served', 'takeaway', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '5 minutes'),
  ('ord-109', 'Corporate #55', '[{"name":"Classic Cheesecake (whole)","qty":3},{"name":"Assorted Macarons (box of 6)","qty":5}]', 4350.00, 'pending', 'corporate', NOW() - INTERVAL '1 day', NULL)
ON CONFLICT (id) DO NOTHING;

-- Example sales_history
-- Sales history (daily totals)
INSERT INTO sales_history (date, total) VALUES
  (CURRENT_DATE - INTERVAL '7 day', 1120.50),
  (CURRENT_DATE - INTERVAL '6 day', 980.00),
  (CURRENT_DATE - INTERVAL '5 day', 1450.25),
  (CURRENT_DATE - INTERVAL '4 day', 1325.75),
  (CURRENT_DATE - INTERVAL '3 day', 1190.00),
  (CURRENT_DATE - INTERVAL '2 day', 980.00),
  (CURRENT_DATE - INTERVAL '1 day', 1250.00),
  (CURRENT_DATE, 1425.30)
ON CONFLICT (date) DO NOTHING;

-- Example attendance log (generated id uses epoch)
-- Attendance logs (few samples)
INSERT INTO attendance_logs (id, employee_id, action, timestamp, shift, note) VALUES
  ('att-' || (FLOOR(EXTRACT(EPOCH FROM NOW())) - 1000)::bigint, 'emp-5', 'in', NOW() - INTERVAL '8 hours', 'morning', 'Started early'),
  ('att-' || (FLOOR(EXTRACT(EPOCH FROM NOW())) - 900)::bigint, 'emp-4', 'in', NOW() - INTERVAL '7 hours 30 minutes', 'morning', 'Barista shift'),
  ('att-' || (FLOOR(EXTRACT(EPOCH FROM NOW())) - 800)::bigint, 'emp-2', 'in', NOW() - INTERVAL '6 hours 45 minutes', 'morning', 'Cashier present')
ON CONFLICT (id) DO NOTHING;

-- Inventory usage / metrics
INSERT INTO inventory_usage (label, used) VALUES
  ('flour_weekly', 120),
  ('butter_weekly', 48),
  ('sugar_weekly', 75),
  ('milk_weekly', 190)
ON CONFLICT (label) DO NOTHING;

-- Performance scores (example)
INSERT INTO performance_scores (employee_id, rating, completed_orders) VALUES
  ('emp-1', 4.8, 320),
  ('emp-2', 4.2, 210),
  ('emp-3', 4.6, 280),
  ('emp-4', 4.3, 240),
  ('emp-5', 4.5, 260)
ON CONFLICT (employee_id) DO NOTHING;

-- Stock trends
INSERT INTO stock_trends (item, turnover) VALUES
  ('Chocolate Mousse Slice', 45),
  ('Butter Croissant', 210),
  ('Espresso Shot (single)', 600),
  ('Assorted Macarons (box of 6)', 38),
  ('Sourdough Loaf', 26)
ON CONFLICT (item) DO NOTHING;
