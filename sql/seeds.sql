-- seeds.sql
-- Sample INSERT statements (pre-made data). Run this after `schema.sql`.
-- 1 week simulation for small bakery business

-- Users (admin + staff)
INSERT INTO users (id, name, role, pin, created_at) VALUES
  ('admin-1', 'Sofia Morales', 'admin', '4321', NOW()),
  ('staff-1', 'Front Desk', 'inventory_manager', '1111', NOW()),
  ('staff-2', 'Counter Staff', 'staff', '2222', NOW())
ON CONFLICT (id) DO NOTHING;

-- Employees
INSERT INTO employees (id, name, role, shift_start, created_at) VALUES
  ('emp-1', 'Sofia Morales', 'manager', '08:00', NOW()),
  ('emp-2', 'Juan Dela Cruz', 'cashier', '09:00', NOW()),
  ('emp-3', 'Maria Santos', 'baker', '06:00', NOW()),
  ('emp-4', 'Luis Navarro', 'barista', '07:00', NOW()),
  ('emp-5', 'Anne Lopez', 'cook', '05:30', NOW()),
  ('emp-6', 'Lair Broz Timothy Balmes', 'barista', '07:30', NOW()),
  ('emp-7', 'John Paulo Claveria', 'cook', '05:30', NOW()),
  ('emp-8', 'Carmen Reyes', 'cashier', '09:00', NOW()),
  ('emp-9', 'Pedro Gonzales', 'delivery_staff', '10:00', NOW()),
  ('emp-10', 'Elena Cruz', 'baker', '06:30', NOW())
ON CONFLICT (id) DO NOTHING;

-- Inventory (small business - 4 categories: cakes & pastries, beverages, ingredients, supplies)
INSERT INTO inventory (id, category, name, quantity, unit, reorder_point, cost, created_at) VALUES
  -- Cakes & Pastries (ready to sell items)
  ('inv-1', 'cakes & pastries', 'Chocolate Mousse Slice', 15, 'pcs', 5, 120.00, NOW()),
  ('inv-2', 'cakes & pastries', 'Classic Cheesecake (whole)', 5, 'pcs', 2, 850.00, NOW()),
  ('inv-3', 'cakes & pastries', 'Butter Croissant', 30, 'pcs', 10, 35.00, NOW()),
  ('inv-4', 'cakes & pastries', 'Almond Danish', 25, 'pcs', 8, 45.00, NOW()),
  ('inv-5', 'cakes & pastries', 'Red Velvet Slice', 12, 'pcs', 5, 110.00, NOW()),
  ('inv-6', 'cakes & pastries', 'Cinnamon Roll', 20, 'pcs', 8, 50.00, NOW()),
  ('inv-7', 'cakes & pastries', 'Assorted Macarons (box of 6)', 18, 'box', 5, 220.00, NOW()),
  ('inv-8', 'cakes & pastries', 'Blueberry Muffin', 24, 'pcs', 10, 55.00, NOW()),
  
  -- Beverages (only bottled/canned - ready to serve)
  ('inv-9', 'beverages', 'Bottled Water 500ml', 48, 'btl', 20, 15.00, NOW()),
  ('inv-10', 'beverages', 'Iced Tea 350ml', 36, 'btl', 15, 45.00, NOW()),
  ('inv-11', 'beverages', 'Canned Soda 330ml', 42, 'can', 20, 30.00, NOW()),
  ('inv-12', 'beverages', 'Orange Juice 250ml', 30, 'btl', 12, 40.00, NOW()),
  ('inv-13', 'beverages', 'Canned Coffee 240ml', 24, 'can', 10, 55.00, NOW()),
  
  -- Ingredients (baking supplies)
  ('inv-14', 'ingredients', 'All-purpose Flour', 25.00, 'kg', 10, 40.00, NOW()),
  ('inv-15', 'ingredients', 'Granulated Sugar', 20.00, 'kg', 8, 35.00, NOW()),
  ('inv-16', 'ingredients', 'Unsalted Butter', 15.00, 'kg', 5, 180.00, NOW()),
  ('inv-17', 'ingredients', 'Whole Milk', 30.00, 'L', 10, 45.00, NOW()),
  ('inv-18', 'ingredients', 'Cocoa Powder', 8.00, 'kg', 3, 120.00, NOW()),
  ('inv-19', 'ingredients', 'Vanilla Extract', 2.50, 'L', 1, 850.00, NOW()),
  ('inv-20', 'ingredients', 'Eggs', 15.00, 'dozen', 5, 120.00, NOW()),
  
  -- Supplies (packaging & serving materials)
  ('inv-21', 'supplies', 'Cake Box (small)', 50, 'pcs', 20, 8.00, NOW()),
  ('inv-22', 'supplies', 'Cake Box (medium)', 40, 'pcs', 15, 12.00, NOW()),
  ('inv-23', 'supplies', 'Cake Box (large)', 30, 'pcs', 10, 18.00, NOW()),
  ('inv-24', 'supplies', 'Plastic Cups 16oz', 200, 'pcs', 50, 2.50, NOW()),
  ('inv-25', 'supplies', 'Paper Bags (small)', 150, 'pcs', 50, 1.50, NOW()),
  ('inv-26', 'supplies', 'Paper Bags (large)', 100, 'pcs', 30, 3.00, NOW()),
  ('inv-27', 'supplies', 'Plastic Forks', 300, 'pcs', 100, 0.50, NOW()),
  ('inv-28', 'supplies', 'Napkins (pack of 100)', 20, 'pack', 5, 45.00, NOW()),
  ('inv-29', 'supplies', 'Plastic Food Containers', 80, 'pcs', 25, 5.00, NOW()),
  ('inv-30', 'supplies', 'Aluminum Foil Roll', 5, 'roll', 2, 120.00, NOW())
ON CONFLICT (id) DO NOTHING;

-- Orders (1 week simulation - small bakery business)
INSERT INTO orders (id, customer, items, total, status, type, timestamp, served_at) VALUES
  -- Day 1 (7 days ago)
  ('ord-100', 'Walk-in Customer', '[{"name":"Butter Croissant","qty":2},{"name":"Bottled Water 500ml","qty":1}]', 85.00, 'served', 'takeaway', NOW() - INTERVAL '7 days' + INTERVAL '8 hours', NOW() - INTERVAL '7 days' + INTERVAL '8 hours 5 minutes'),
  ('ord-101', 'Maria Santos', '[{"name":"Classic Cheesecake (whole)","qty":1}]', 850.00, 'served', 'pickup', NOW() - INTERVAL '7 days' + INTERVAL '10 hours', NOW() - INTERVAL '7 days' + INTERVAL '10 hours 15 minutes'),
  ('ord-102', 'Table 2', '[{"name":"Chocolate Mousse Slice","qty":2},{"name":"Iced Tea 350ml","qty":2}]', 330.00, 'served', 'dine-in', NOW() - INTERVAL '7 days' + INTERVAL '14 hours', NOW() - INTERVAL '7 days' + INTERVAL '14 hours 20 minutes'),
  ('ord-103', 'Delivery #101', '[{"name":"Assorted Macarons (box of 6)","qty":2},{"name":"Cinnamon Roll","qty":4}]', 640.00, 'served', 'delivery', NOW() - INTERVAL '7 days' + INTERVAL '16 hours', NOW() - INTERVAL '7 days' + INTERVAL '17 hours'),
  
  -- Day 2 (6 days ago)
  ('ord-104', 'Walk-in Customer', '[{"name":"Almond Danish","qty":3},{"name":"Canned Coffee 240ml","qty":2}]', 245.00, 'served', 'takeaway', NOW() - INTERVAL '6 days' + INTERVAL '9 hours', NOW() - INTERVAL '6 days' + INTERVAL '9 hours 8 minutes'),
  ('ord-105', 'Table 5', '[{"name":"Red Velvet Slice","qty":2},{"name":"Canned Soda 330ml","qty":2}]', 280.00, 'served', 'dine-in', NOW() - INTERVAL '6 days' + INTERVAL '12 hours', NOW() - INTERVAL '6 days' + INTERVAL '12 hours 18 minutes'),
  ('ord-106', 'John Reyes', '[{"name":"Blueberry Muffin","qty":6}]', 330.00, 'served', 'pickup', NOW() - INTERVAL '6 days' + INTERVAL '15 hours', NOW() - INTERVAL '6 days' + INTERVAL '15 hours 10 minutes'),
  
  -- Day 3 (5 days ago)
  ('ord-107', 'Table 1', '[{"name":"Butter Croissant","qty":4},{"name":"Orange Juice 250ml","qty":2}]', 220.00, 'served', 'dine-in', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', NOW() - INTERVAL '5 days' + INTERVAL '8 hours 15 minutes'),
  ('ord-108', 'Walk-in Customer', '[{"name":"Chocolate Mousse Slice","qty":1},{"name":"Bottled Water 500ml","qty":1}]', 135.00, 'served', 'takeaway', NOW() - INTERVAL '5 days' + INTERVAL '11 hours', NOW() - INTERVAL '5 days' + INTERVAL '11 hours 6 minutes'),
  ('ord-109', 'Delivery #102', '[{"name":"Classic Cheesecake (whole)","qty":1},{"name":"Assorted Macarons (box of 6)","qty":1}]', 1070.00, 'served', 'delivery', NOW() - INTERVAL '5 days' + INTERVAL '13 hours', NOW() - INTERVAL '5 days' + INTERVAL '14 hours'),
  ('ord-110', 'Table 3', '[{"name":"Cinnamon Roll","qty":3},{"name":"Iced Tea 350ml","qty":3}]', 285.00, 'served', 'dine-in', NOW() - INTERVAL '5 days' + INTERVAL '17 hours', NOW() - INTERVAL '5 days' + INTERVAL '17 hours 22 minutes'),
  
  -- Day 4 (4 days ago)
  ('ord-111', 'Walk-in Customer', '[{"name":"Almond Danish","qty":2},{"name":"Canned Coffee 240ml","qty":1}]', 145.00, 'served', 'takeaway', NOW() - INTERVAL '4 days' + INTERVAL '7 hours', NOW() - INTERVAL '4 days' + INTERVAL '7 hours 7 minutes'),
  ('ord-112', 'Anna Cruz', '[{"name":"Red Velvet Slice","qty":4}]', 440.00, 'served', 'pickup', NOW() - INTERVAL '4 days' + INTERVAL '10 hours', NOW() - INTERVAL '4 days' + INTERVAL '10 hours 12 minutes'),
  ('ord-113', 'Table 4', '[{"name":"Blueberry Muffin","qty":2},{"name":"Orange Juice 250ml","qty":2}]', 190.00, 'served', 'dine-in', NOW() - INTERVAL '4 days' + INTERVAL '13 hours', NOW() - INTERVAL '4 days' + INTERVAL '13 hours 16 minutes'),
  ('ord-114', 'Delivery #103', '[{"name":"Butter Croissant","qty":6},{"name":"Bottled Water 500ml","qty":4}]', 270.00, 'served', 'delivery', NOW() - INTERVAL '4 days' + INTERVAL '15 hours', NOW() - INTERVAL '4 days' + INTERVAL '16 hours'),
  
  -- Day 5 (3 days ago)
  ('ord-115', 'Table 2', '[{"name":"Chocolate Mousse Slice","qty":3},{"name":"Canned Soda 330ml","qty":2}]', 420.00, 'served', 'dine-in', NOW() - INTERVAL '3 days' + INTERVAL '9 hours', NOW() - INTERVAL '3 days' + INTERVAL '9 hours 19 minutes'),
  ('ord-116', 'Walk-in Customer', '[{"name":"Assorted Macarons (box of 6)","qty":1},{"name":"Iced Tea 350ml","qty":1}]', 265.00, 'served', 'takeaway', NOW() - INTERVAL '3 days' + INTERVAL '12 hours', NOW() - INTERVAL '3 days' + INTERVAL '12 hours 8 minutes'),
  ('ord-117', 'Corporate Order', '[{"name":"Classic Cheesecake (whole)","qty":2},{"name":"Assorted Macarons (box of 6)","qty":3}]', 2360.00, 'served', 'delivery', NOW() - INTERVAL '3 days' + INTERVAL '14 hours', NOW() - INTERVAL '3 days' + INTERVAL '15 hours'),
  
  -- Day 6 (2 days ago)
  ('ord-118', 'Walk-in Customer', '[{"name":"Cinnamon Roll","qty":2},{"name":"Canned Coffee 240ml","qty":2}]', 210.00, 'served', 'takeaway', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', NOW() - INTERVAL '2 days' + INTERVAL '8 hours 6 minutes'),
  ('ord-119', 'Table 1', '[{"name":"Red Velvet Slice","qty":2},{"name":"Butter Croissant","qty":2},{"name":"Orange Juice 250ml","qty":2}]', 370.00, 'served', 'dine-in', NOW() - INTERVAL '2 days' + INTERVAL '11 hours', NOW() - INTERVAL '2 days' + INTERVAL '11 hours 17 minutes'),
  ('ord-120', 'Luis Martinez', '[{"name":"Blueberry Muffin","qty":4}]', 220.00, 'served', 'pickup', NOW() - INTERVAL '2 days' + INTERVAL '14 hours', NOW() - INTERVAL '2 days' + INTERVAL '14 hours 9 minutes'),
  ('ord-121', 'Delivery #104', '[{"name":"Almond Danish","qty":4},{"name":"Bottled Water 500ml","qty":3}]', 225.00, 'served', 'delivery', NOW() - INTERVAL '2 days' + INTERVAL '16 hours', NOW() - INTERVAL '2 days' + INTERVAL '17 hours'),
  
  -- Day 7 (yesterday)
  ('ord-122', 'Table 3', '[{"name":"Chocolate Mousse Slice","qty":2},{"name":"Iced Tea 350ml","qty":2}]', 330.00, 'served', 'dine-in', NOW() - INTERVAL '1 day' + INTERVAL '10 hours', NOW() - INTERVAL '1 day' + INTERVAL '10 hours 21 minutes'),
  ('ord-123', 'Walk-in Customer', '[{"name":"Butter Croissant","qty":3},{"name":"Canned Soda 330ml","qty":1}]', 135.00, 'served', 'takeaway', NOW() - INTERVAL '1 day' + INTERVAL '13 hours', NOW() - INTERVAL '1 day' + INTERVAL '13 hours 7 minutes'),
  ('ord-124', 'Sarah Johnson', '[{"name":"Classic Cheesecake (whole)","qty":1}]', 850.00, 'served', 'pickup', NOW() - INTERVAL '1 day' + INTERVAL '15 hours', NOW() - INTERVAL '1 day' + INTERVAL '15 hours 14 minutes'),
  ('ord-125', 'Table 5', '[{"name":"Assorted Macarons (box of 6)","qty":2},{"name":"Cinnamon Roll","qty":2}]', 540.00, 'served', 'dine-in', NOW() - INTERVAL '1 day' + INTERVAL '18 hours', NOW() - INTERVAL '1 day' + INTERVAL '18 hours 23 minutes'),
  
  -- Today (current orders)
  ('ord-126', 'Walk-in Customer', '[{"name":"Almond Danish","qty":2},{"name":"Orange Juice 250ml","qty":1}]', 130.00, 'served', 'takeaway', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 55 minutes'),
  ('ord-127', 'Table 2', '[{"name":"Red Velvet Slice","qty":1},{"name":"Canned Coffee 240ml","qty":1}]', 165.00, 'served', 'dine-in', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 48 minutes'),
  ('ord-128', 'Delivery #105', '[{"name":"Blueberry Muffin","qty":6},{"name":"Bottled Water 500ml","qty":4}]', 390.00, 'pending', 'delivery', NOW() - INTERVAL '30 minutes', NULL)
ON CONFLICT (id) DO NOTHING;

-- Sales history (1 week - calculated from orders above)
INSERT INTO sales_history (id, date, total, orders_count) VALUES
  ('sales-7', CURRENT_DATE - INTERVAL '7 day', 2105.00, 4),
  ('sales-6', CURRENT_DATE - INTERVAL '6 day', 855.00, 3),
  ('sales-5', CURRENT_DATE - INTERVAL '5 day', 1710.00, 4),
  ('sales-4', CURRENT_DATE - INTERVAL '4 day', 1045.00, 4),
  ('sales-3', CURRENT_DATE - INTERVAL '3 day', 3045.00, 3),
  ('sales-2', CURRENT_DATE - INTERVAL '2 day', 1025.00, 4),
  ('sales-1', CURRENT_DATE - INTERVAL '1 day', 1855.00, 4),
  ('sales-0', CURRENT_DATE, 685.00, 3)
ON CONFLICT (id) DO NOTHING;

-- Attendance logs (1 week simulation)
INSERT INTO attendance_logs (id, employee_id, action, timestamp, shift, note) VALUES
  -- Day 1 (7 days ago)
  ('att-1001', 'emp-3', 'in', NOW() - INTERVAL '7 days' + INTERVAL '6 hours', 'morning', 'Early shift'),
  ('att-1002', 'emp-4', 'in', NOW() - INTERVAL '7 days' + INTERVAL '7 hours', 'morning', 'On time'),
  ('att-1003', 'emp-1', 'in', NOW() - INTERVAL '7 days' + INTERVAL '8 hours', 'morning', 'Manager arrived'),
  ('att-1004', 'emp-2', 'in', NOW() - INTERVAL '7 days' + INTERVAL '9 hours', 'morning', 'Cashier shift'),
  
  -- Day 2 (6 days ago)
  ('att-1005', 'emp-5', 'in', NOW() - INTERVAL '6 days' + INTERVAL '5 hours 30 minutes', 'morning', 'Cook early start'),
  ('att-1006', 'emp-10', 'in', NOW() - INTERVAL '6 days' + INTERVAL '6 hours 30 minutes', 'morning', 'Baker shift'),
  ('att-1007', 'emp-6', 'in', NOW() - INTERVAL '6 days' + INTERVAL '7 hours 30 minutes', 'morning', 'Barista ready'),
  ('att-1008', 'emp-8', 'in', NOW() - INTERVAL '6 days' + INTERVAL '9 hours', 'morning', 'Counter staff'),
  
  -- Day 3 (5 days ago)
  ('att-1009', 'emp-3', 'in', NOW() - INTERVAL '5 days' + INTERVAL '6 hours', 'morning', 'Baker present'),
  ('att-1010', 'emp-4', 'in', NOW() - INTERVAL '5 days' + INTERVAL '7 hours', 'morning', 'Barista shift'),
  ('att-1011', 'emp-1', 'in', NOW() - INTERVAL '5 days' + INTERVAL '8 hours', 'morning', 'Manager on duty'),
  ('att-1012', 'emp-9', 'in', NOW() - INTERVAL '5 days' + INTERVAL '10 hours', 'morning', 'Delivery staff'),
  
  -- Day 4 (4 days ago)
  ('att-1013', 'emp-7', 'in', NOW() - INTERVAL '4 days' + INTERVAL '5 hours 30 minutes', 'morning', 'Cook arrived'),
  ('att-1014', 'emp-10', 'in', NOW() - INTERVAL '4 days' + INTERVAL '6 hours 30 minutes', 'morning', 'Baker ready'),
  ('att-1015', 'emp-2', 'in', NOW() - INTERVAL '4 days' + INTERVAL '9 hours', 'morning', 'Cashier present'),
  
  -- Day 5 (3 days ago)
  ('att-1016', 'emp-3', 'in', NOW() - INTERVAL '3 days' + INTERVAL '6 hours', 'morning', 'On time'),
  ('att-1017', 'emp-6', 'in', NOW() - INTERVAL '3 days' + INTERVAL '7 hours 30 minutes', 'morning', 'Barista shift'),
  ('att-1018', 'emp-1', 'in', NOW() - INTERVAL '3 days' + INTERVAL '8 hours', 'morning', 'Manager arrived'),
  ('att-1019', 'emp-8', 'in', NOW() - INTERVAL '3 days' + INTERVAL '9 hours', 'morning', 'Cashier ready'),
  
  -- Day 6 (2 days ago)
  ('att-1020', 'emp-5', 'in', NOW() - INTERVAL '2 days' + INTERVAL '5 hours 30 minutes', 'morning', 'Cook early'),
  ('att-1021', 'emp-3', 'in', NOW() - INTERVAL '2 days' + INTERVAL '6 hours', 'morning', 'Baker present'),
  ('att-1022', 'emp-4', 'in', NOW() - INTERVAL '2 days' + INTERVAL '7 hours', 'morning', 'Barista on time'),
  ('att-1023', 'emp-9', 'in', NOW() - INTERVAL '2 days' + INTERVAL '10 hours', 'morning', 'Delivery ready'),
  
  -- Day 7 (yesterday)
  ('att-1024', 'emp-10', 'in', NOW() - INTERVAL '1 day' + INTERVAL '6 hours 30 minutes', 'morning', 'Baker shift'),
  ('att-1025', 'emp-6', 'in', NOW() - INTERVAL '1 day' + INTERVAL '7 hours 30 minutes', 'morning', 'Barista arrived'),
  ('att-1026', 'emp-1', 'in', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 'morning', 'Manager present'),
  ('att-1027', 'emp-2', 'in', NOW() - INTERVAL '1 day' + INTERVAL '9 hours', 'morning', 'Cashier shift'),
  
  -- Today
  ('att-1028', 'emp-3', 'in', NOW() - INTERVAL '6 hours', 'morning', 'Baker early'),
  ('att-1029', 'emp-5', 'in', NOW() - INTERVAL '5 hours 30 minutes', 'morning', 'Cook ready'),
  ('att-1030', 'emp-4', 'in', NOW() - INTERVAL '4 hours', 'morning', 'Barista present'),
  ('att-1031', 'emp-1', 'in', NOW() - INTERVAL '3 hours', 'morning', 'Manager arrived')
ON CONFLICT (id) DO NOTHING;

-- Inventory usage (1 week consumption - small business)
INSERT INTO inventory_usage (label, used) VALUES
  ('flour_weekly', 18),
  ('butter_weekly', 8),
  ('sugar_weekly', 12),
  ('milk_weekly', 15),
  ('cocoa_weekly', 3),
  ('eggs_weekly', 6),
  ('cake_boxes_weekly', 25),
  ('cups_weekly', 45),
  ('bags_weekly', 60),
  ('napkins_weekly', 3)
ON CONFLICT (label) DO NOTHING;

-- End of seeds.sql
