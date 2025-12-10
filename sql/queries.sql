-- queries.sql
-- SELECT / UPDATE / INSERT examples used to fetch and return data from the PostgreSQL DB.
-- Use these as prepared queries or to build API endpoints.

-- 1) Get latest attendance per employee
SELECT u.id, u.name, al.action, al.timestamp
FROM users u
LEFT JOIN attendance_logs al ON al.employee_id = u.id
  AND al.timestamp = (
    SELECT MAX(timestamp) FROM attendance_logs WHERE employee_id = u.id
  )
ORDER BY u.name;

-- 2) Low stock items (quantity <= reorder_point)
SELECT id, category, name, quantity, unit, reorder_point
FROM inventory
WHERE quantity <= reorder_point
ORDER BY quantity ASC;

-- 3) Recent orders (last 100)
SELECT id, customer, items_json, total, type, timestamp
FROM orders
WHERE archived = false
ORDER BY timestamp DESC
LIMIT 100;

-- 4) Total sales in a date range
SELECT SUM(total) AS total_sales
FROM sales_history
WHERE date BETWEEN $1 AND $2; -- use parameterized dates

-- 5) Average ticket (last 30 days)
SELECT (SUM(o.total) / GREATEST(COUNT(o.id),1)) AS avg_ticket
FROM orders o
WHERE o.timestamp >= NOW() - INTERVAL '30 days';

-- 6) Archive an order
UPDATE orders
SET archived = true, archived_at = NOW(), archived_by = $1
WHERE id = $2; -- $1 = user_id, $2 = order_id

-- 7) Decrease inventory based on usage (example)
UPDATE inventory
SET quantity = quantity - $1
WHERE id = $2 AND quantity > 0; -- $1 = qty used, $2 = inventory id

-- 8) Add an attendance log (example)
INSERT INTO attendance_logs (id, employee_id, action, timestamp, note)
VALUES ('att-' || FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint, $1, $2, NOW(), $3);

-- 9) Active employees list
SELECT id, name, email, role, permission, status, hire_date
FROM users
WHERE archived = false AND status = 'active'
ORDER BY name;

-- 10) Inventory value summary
SELECT SUM(quantity * cost) AS inventory_value FROM inventory;

-- End of queries
