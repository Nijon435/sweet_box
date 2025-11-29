-- seeds.sql
-- Sample INSERT statements (pre-made data). Run this after `schema.sql`.
-- 1 week simulation for small bakery business

-- Users (merged with employees) - with email, password, phone, and permission
INSERT INTO users (id, name, email, password, phone, role, permission, shift_start, hire_date, status, created_at) VALUES
  ('user-1', 'John Paul Arvesu', 'arvesujohnpaul@gmail.com', 'april435', '0992 867 0457', 'manager', 'admin', NULL, NOW()::DATE, 'active', NOW()),
  ('user-2', 'Sofia Morales', 'admin@sweetbox.com', 'admin123', '0917 123 4567', 'manager', 'admin', NULL, NOW()::DATE, 'active', NOW()),
  ('user-3', 'Juan Dela Cruz', 'juan@sweetbox.com', 'cashier123', '0918 234 5678', 'cashier', 'front_staff', '09:00', NOW()::DATE - INTERVAL '2 years', 'active', NOW()),
  ('user-4', 'Maria Santos', 'maria@sweetbox.com', 'baker123', '0919 345 6789', 'baker', 'kitchen_staff', '06:00', NOW()::DATE - INTERVAL '3 years', 'active', NOW()),
  ('user-5', 'Luis Navarro', 'luis@sweetbox.com', 'barista123', '0920 456 7890', 'barista', 'kitchen_staff', '07:00', NOW()::DATE - INTERVAL '1 year', 'active', NOW()),
  ('user-6', 'Anne Lopez', 'anne@sweetbox.com', 'cook123', '0921 567 8901', 'cook', 'kitchen_staff', '05:30', NOW()::DATE - INTERVAL '4 years', 'active', NOW()),
  ('user-7', 'Lair Broz Timothy Balmes', 'lair@sweetbox.com', 'barista123', '0922 678 9012', 'barista', 'kitchen_staff', '07:30', NOW()::DATE - INTERVAL '6 months', 'active', NOW()),
  ('user-8', 'John Paulo Claveria', 'johnpaulo@sweetbox.com', 'cook123', '0923 789 0123', 'cook', 'kitchen_staff', '05:30', NOW()::DATE - INTERVAL '1 year', 'active', NOW()),
  ('user-9', 'Carmen Reyes', 'carmen@sweetbox.com', 'cashier123', '0924 890 1234', 'cashier', 'front_staff', '09:00', NOW()::DATE - INTERVAL '8 months', 'active', NOW()),
  ('user-10', 'Pedro Gonzales', 'pedro@sweetbox.com', 'delivery123', '0925 901 2345', 'delivery_staff', 'delivery_staff', '10:00', NOW()::DATE - INTERVAL '5 months', 'active', NOW()),
  ('user-11', 'Elena Cruz', 'elena@sweetbox.com', 'baker123', '0926 012 3456', 'baker', 'kitchen_staff', '06:30', NOW()::DATE - INTERVAL '2 years', 'active', NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  permission = EXCLUDED.permission,
  shift_start = EXCLUDED.shift_start,
  hire_date = EXCLUDED.hire_date,
  status = EXCLUDED.status;

-- Inventory (small business - 4 categories: cakes & pastries, beverages, ingredients, supplies)
-- Note: removed unit and reorder_point columns
INSERT INTO inventory (id, category, name, quantity, cost, created_at) VALUES
  -- Cakes & Pastries (ready to sell items)
  ('inv-1', 'cakes & pastries', 'Chocolate Mousse Slice', 15, 120.00, NOW()),
  ('inv-2', 'cakes & pastries', 'Classic Cheesecake (whole)', 5, 850.00, NOW()),
  ('inv-3', 'cakes & pastries', 'Butter Croissant', 30, 35.00, NOW()),
  ('inv-4', 'cakes & pastries', 'Almond Danish', 25, 45.00, NOW()),
  ('inv-5', 'cakes & pastries', 'Red Velvet Slice', 12, 110.00, NOW()),
  ('inv-6', 'cakes & pastries', 'Cinnamon Roll', 20, 50.00, NOW()),
  ('inv-7', 'cakes & pastries', 'Assorted Macarons (box of 6)', 18, 220.00, NOW()),
  ('inv-8', 'cakes & pastries', 'Blueberry Muffin', 24, 55.00, NOW()),
  
  -- Beverages (only bottled/canned - ready to serve)
  ('inv-9', 'beverages', 'Bottled Water 500ml', 48, 15.00, NOW()),
  ('inv-10', 'beverages', 'Iced Tea 350ml', 36, 45.00, NOW()),
  ('inv-11', 'beverages', 'Canned Soda 330ml', 42, 30.00, NOW()),
  ('inv-12', 'beverages', 'Orange Juice 250ml', 30, 40.00, NOW()),
  ('inv-13', 'beverages', 'Canned Coffee 240ml', 24, 55.00, NOW()),
  
  -- Ingredients (baking supplies)
  ('inv-14', 'ingredients', 'All-purpose Flour', 25.00, 40.00, NOW()),
  ('inv-15', 'ingredients', 'Granulated Sugar', 20.00, 35.00, NOW()),
  ('inv-16', 'ingredients', 'Unsalted Butter', 15.00, 180.00, NOW()),
  ('inv-17', 'ingredients', 'Whole Milk', 30.00, 45.00, NOW()),
  ('inv-18', 'ingredients', 'Cocoa Powder', 8.00, 120.00, NOW()),
  ('inv-19', 'ingredients', 'Vanilla Extract', 2.50, 850.00, NOW()),
  ('inv-20', 'ingredients', 'Eggs', 15.00, 120.00, NOW()),
  
  -- Supplies (packaging & serving materials)
  ('inv-21', 'supplies', 'Cake Box (small)', 50, 8.00, NOW()),
  ('inv-22', 'supplies', 'Cake Box (medium)', 40, 12.00, NOW()),
  ('inv-23', 'supplies', 'Cake Box (large)', 30, 18.00, NOW()),
  ('inv-24', 'supplies', 'Plastic Cups 16oz', 200, 2.50, NOW()),
  ('inv-25', 'supplies', 'Paper Bags (small)', 150, 1.50, NOW()),
  ('inv-26', 'supplies', 'Paper Bags (large)', 100, 3.00, NOW()),
  ('inv-27', 'supplies', 'Plastic Forks', 300, 0.50, NOW()),
  ('inv-28', 'supplies', 'Napkins (pack of 100)', 20, 45.00, NOW()),
  ('inv-29', 'supplies', 'Plastic Food Containers', 80, 5.00, NOW()),
  ('inv-30', 'supplies', 'Aluminum Foil Roll', 5, 120.00, NOW())
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
  ('ord-107', 'Table 8', '[{"name":"Chocolate Mousse Slice","qty":1},{"name":"Butter Croissant","qty":2}]', 190.00, 'served', 'dine-in', NOW() - INTERVAL '5 days' + INTERVAL '11 hours', NOW() - INTERVAL '5 days' + INTERVAL '11 hours 12 minutes'),
  ('ord-108', 'Walk-in Customer', '[{"name":"Cinnamon Roll","qty":3},{"name":"Orange Juice 250ml","qty":2}]', 230.00, 'served', 'takeaway', NOW() - INTERVAL '5 days' + INTERVAL '13 hours', NOW() - INTERVAL '5 days' + INTERVAL '13 hours 7 minutes'),
  ('ord-109', 'Delivery #102', '[{"name":"Classic Cheesecake (whole)","qty":1},{"name":"Assorted Macarons (box of 6)","qty":1}]', 1070.00, 'served', 'delivery', NOW() - INTERVAL '5 days' + INTERVAL '15 hours', NOW() - INTERVAL '5 days' + INTERVAL '16 hours'),
  
  -- Day 4 (4 days ago)
  ('ord-110', 'Walk-in Customer', '[{"name":"Almond Danish","qty":2},{"name":"Iced Tea 350ml","qty":1}]', 135.00, 'served', 'takeaway', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', NOW() - INTERVAL '4 days' + INTERVAL '8 hours 6 minutes'),
  ('ord-111', 'Table 3', '[{"name":"Red Velvet Slice","qty":3},{"name":"Bottled Water 500ml","qty":3}]', 375.00, 'served', 'dine-in', NOW() - INTERVAL '4 days' + INTERVAL '12 hours', NOW() - INTERVAL '4 days' + INTERVAL '12 hours 25 minutes'),
  ('ord-112', 'Peter Tan', '[{"name":"Blueberry Muffin","qty":12}]', 660.00, 'served', 'pickup', NOW() - INTERVAL '4 days' + INTERVAL '16 hours', NOW() - INTERVAL '4 days' + INTERVAL '16 hours 10 minutes'),
  ('ord-113', 'Walk-in Customer', '[{"name":"Butter Croissant","qty":4}]', 140.00, 'served', 'takeaway', NOW() - INTERVAL '4 days' + INTERVAL '17 hours', NOW() - INTERVAL '4 days' + INTERVAL '17 hours 5 minutes'),
  
  -- Day 5 (3 days ago)
  ('ord-114', 'Delivery #103', '[{"name":"Assorted Macarons (box of 6)","qty":3}]', 660.00, 'served', 'delivery', NOW() - INTERVAL '3 days' + INTERVAL '10 hours', NOW() - INTERVAL '3 days' + INTERVAL '11 hours'),
  ('ord-115', 'Table 6', '[{"name":"Chocolate Mousse Slice","qty":2},{"name":"Canned Coffee 240ml","qty":2}]', 350.00, 'served', 'dine-in', NOW() - INTERVAL '3 days' + INTERVAL '13 hours', NOW() - INTERVAL '3 days' + INTERVAL '13 hours 15 minutes'),
  ('ord-116', 'Walk-in Customer', '[{"name":"Cinnamon Roll","qty":2},{"name":"Canned Soda 330ml","qty":2}]', 160.00, 'served', 'takeaway', NOW() - INTERVAL '3 days' + INTERVAL '14 hours', NOW() - INTERVAL '3 days' + INTERVAL '14 hours 8 minutes'),
  ('ord-117', 'Anna Cruz', '[{"name":"Classic Cheesecake (whole)","qty":1}]', 850.00, 'served', 'pickup', NOW() - INTERVAL '3 days' + INTERVAL '16 hours', NOW() - INTERVAL '3 days' + INTERVAL '16 hours 12 minutes'),
  
  -- Day 6 (2 days ago)
  ('ord-118', 'Walk-in Customer', '[{"name":"Almond Danish","qty":3},{"name":"Orange Juice 250ml","qty":2}]', 215.00, 'served', 'takeaway', NOW() - INTERVAL '2 days' + INTERVAL '9 hours', NOW() - INTERVAL '2 days' + INTERVAL '9 hours 7 minutes'),
  ('ord-119', 'Table 1', '[{"name":"Red Velvet Slice","qty":2},{"name":"Iced Tea 350ml","qty":2}]', 310.00, 'served', 'dine-in', NOW() - INTERVAL '2 days' + INTERVAL '11 hours', NOW() - INTERVAL '2 days' + INTERVAL '11 hours 18 minutes'),
  ('ord-120', 'Walk-in Customer', '[{"name":"Butter Croissant","qty":5}]', 175.00, 'served', 'takeaway', NOW() - INTERVAL '2 days' + INTERVAL '15 hours', NOW() - INTERVAL '2 days' + INTERVAL '15 hours 6 minutes'),
  ('ord-121', 'Delivery #104', '[{"name":"Blueberry Muffin","qty":10}]', 550.00, 'served', 'delivery', NOW() - INTERVAL '2 days' + INTERVAL '16 hours', NOW() - INTERVAL '2 days' + INTERVAL '17 hours'),
  
  -- Day 7 (yesterday)
  ('ord-122', 'Table 4', '[{"name":"Chocolate Mousse Slice","qty":3},{"name":"Bottled Water 500ml","qty":3}]', 405.00, 'served', 'dine-in', NOW() - INTERVAL '1 day' + INTERVAL '10 hours', NOW() - INTERVAL '1 day' + INTERVAL '10 hours 22 minutes'),
  ('ord-123', 'Walk-in Customer', '[{"name":"Cinnamon Roll","qty":4},{"name":"Canned Coffee 240ml","qty":2}]', 310.00, 'served', 'takeaway', NOW() - INTERVAL '1 day' + INTERVAL '12 hours', NOW() - INTERVAL '1 day' + INTERVAL '12 hours 8 minutes'),
  ('ord-124', 'Mike Johnson', '[{"name":"Assorted Macarons (box of 6)","qty":2}]', 440.00, 'served', 'pickup', NOW() - INTERVAL '1 day' + INTERVAL '14 hours', NOW() - INTERVAL '1 day' + INTERVAL '14 hours 10 minutes'),
  ('ord-125', 'Table 7', '[{"name":"Red Velvet Slice","qty":1},{"name":"Almond Danish","qty":2},{"name":"Iced Tea 350ml","qty":2}]', 290.00, 'served', 'dine-in', NOW() - INTERVAL '1 day' + INTERVAL '16 hours', NOW() - INTERVAL '1 day' + INTERVAL '16 hours 20 minutes'),
  ('ord-126', 'Walk-in Customer', '[{"name":"Blueberry Muffin","qty":4}]', 220.00, 'served', 'takeaway', NOW() - INTERVAL '1 day' + INTERVAL '17 hours', NOW() - INTERVAL '1 day' + INTERVAL '17 hours 6 minutes'),
  
  -- Today (pending orders)
  ('ord-127', 'Table 2', '[{"name":"Chocolate Mousse Slice","qty":2},{"name":"Canned Soda 330ml","qty":2}]', 300.00, 'pending', 'dine-in', NOW() - INTERVAL '30 minutes', NULL),
  ('ord-128', 'Walk-in Customer', '[{"name":"Butter Croissant","qty":3}]', 105.00, 'preparing', 'takeaway', NOW() - INTERVAL '15 minutes', NULL)
ON CONFLICT (id) DO NOTHING;

-- Sales history (daily totals for past week)
INSERT INTO sales_history (id, date, total, orders_count) VALUES
  ('sh-1', CURRENT_DATE - INTERVAL '7 days', 1905.00, 4),
  ('sh-2', CURRENT_DATE - INTERVAL '6 days', 855.00, 3),
  ('sh-3', CURRENT_DATE - INTERVAL '5 days', 1490.00, 3),
  ('sh-4', CURRENT_DATE - INTERVAL '4 days', 1310.00, 4),
  ('sh-5', CURRENT_DATE - INTERVAL '3 days', 2020.00, 4),
  ('sh-6', CURRENT_DATE - INTERVAL '2 days', 1250.00, 4),
  ('sh-7', CURRENT_DATE - INTERVAL '1 day', 1665.00, 5),
  ('sh-8', CURRENT_DATE, 405.00, 2)
ON CONFLICT (id) DO NOTHING;

-- Attendance logs (7 days, 31 entries)
-- Attendance logs (exclude admin users - only track non-admin staff)
INSERT INTO attendance_logs (id, employee_id, action, timestamp, shift, note) VALUES
  ('att-1', 'user-3', 'in', NOW() - INTERVAL '7 days' + INTERVAL '9 hours', 'morning', NULL),
  ('att-2', 'user-4', 'in', NOW() - INTERVAL '7 days' + INTERVAL '6 hours', 'morning', NULL),
  ('att-3', 'user-3', 'out', NOW() - INTERVAL '7 days' + INTERVAL '18 hours', 'morning', NULL),
  ('att-4', 'user-5', 'in', NOW() - INTERVAL '6 days' + INTERVAL '7 hours', 'morning', NULL),
  ('att-5', 'user-6', 'in', NOW() - INTERVAL '6 days' + INTERVAL '5 hours 30 minutes', 'morning', NULL),
  ('att-6', 'user-7', 'in', NOW() - INTERVAL '6 days' + INTERVAL '7 hours 30 minutes', 'morning', NULL),
  ('att-7', 'user-5', 'out', NOW() - INTERVAL '6 days' + INTERVAL '16 hours', 'morning', NULL),
  ('att-8', 'user-8', 'in', NOW() - INTERVAL '5 days' + INTERVAL '5 hours 30 minutes', 'morning', NULL),
  ('att-9', 'user-9', 'in', NOW() - INTERVAL '5 days' + INTERVAL '9 hours', 'morning', NULL),
  ('att-10', 'user-3', 'in', NOW() - INTERVAL '5 days' + INTERVAL '9 hours', 'morning', NULL),
  ('att-11', 'user-3', 'out', NOW() - INTERVAL '5 days' + INTERVAL '17 hours', 'morning', NULL),
  ('att-12', 'user-10', 'in', NOW() - INTERVAL '4 days' + INTERVAL '10 hours', 'morning', NULL),
  ('att-13', 'user-11', 'in', NOW() - INTERVAL '4 days' + INTERVAL '6 hours 30 minutes', 'morning', NULL),
  ('att-14', 'user-3', 'in', NOW() - INTERVAL '4 days' + INTERVAL '9 hours', 'morning', NULL),
  ('att-15', 'user-10', 'out', NOW() - INTERVAL '4 days' + INTERVAL '18 hours', 'morning', NULL),
  ('att-16', 'user-4', 'in', NOW() - INTERVAL '3 days' + INTERVAL '6 hours', 'morning', NULL),
  ('att-17', 'user-5', 'in', NOW() - INTERVAL '3 days' + INTERVAL '7 hours', 'morning', NULL),
  ('att-18', 'user-3', 'in', NOW() - INTERVAL '3 days' + INTERVAL '9 hours', 'morning', NULL),
  ('att-19', 'user-4', 'out', NOW() - INTERVAL '3 days' + INTERVAL '15 hours', 'morning', NULL),
  ('att-20', 'user-6', 'in', NOW() - INTERVAL '2 days' + INTERVAL '5 hours 30 minutes', 'morning', NULL),
  ('att-21', 'user-7', 'in', NOW() - INTERVAL '2 days' + INTERVAL '7 hours 30 minutes', 'morning', NULL),
  ('att-22', 'user-9', 'in', NOW() - INTERVAL '2 days' + INTERVAL '9 hours', 'morning', NULL),
  ('att-23', 'user-6', 'out', NOW() - INTERVAL '2 days' + INTERVAL '14 hours', 'morning', NULL),
  ('att-24', 'user-8', 'in', NOW() - INTERVAL '1 day' + INTERVAL '5 hours 30 minutes', 'morning', NULL),
  ('att-25', 'user-11', 'in', NOW() - INTERVAL '1 day' + INTERVAL '6 hours 30 minutes', 'morning', NULL),
  ('att-26', 'user-3', 'in', NOW() - INTERVAL '1 day' + INTERVAL '9 hours', 'morning', NULL),
  ('att-27', 'user-3', 'in', NOW() - INTERVAL '4 hours', 'morning', NULL),
  ('att-28', 'user-4', 'in', NOW() - INTERVAL '6 hours', 'morning', NULL),
  ('att-29', 'user-5', 'in', NOW() - INTERVAL '5 hours', 'morning', NULL)
ON CONFLICT (id) DO NOTHING;

-- Inventory usage (sample weekly metrics)
INSERT INTO inventory_usage (label, used) VALUES
  ('Chocolate Mousse Slice', 18),
  ('Butter Croissant', 32),
  ('Blueberry Muffin', 42),
  ('Cinnamon Roll', 28),
  ('Red Velvet Slice', 15),
  ('Almond Danish', 22),
  ('Assorted Macarons (box of 6)', 12),
  ('Classic Cheesecake (whole)', 4),
  ('Bottled Water 500ml', 25),
  ('Iced Tea 350ml', 18)
ON CONFLICT (label) DO NOTHING;

-- End of seeds
