-- queries.sql
-- SELECT / UPDATE / INSERT examples used to fetch and return data from the PostgreSQL DB.
-- Use these as prepared queries or to build API endpoints.

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

-- 3) Orders by status (replace 'pending' as needed)
SELECT id, customer, items, total, status, type, timestamp
FROM orders
WHERE status = 'pending'
ORDER BY timestamp DESC;

-- 4) Total sales in a date range
SELECT SUM(total) AS total_sales
FROM sales_history
WHERE date BETWEEN $1 AND $2; -- use parameterized dates

-- 5) Average ticket (last 30 days)
SELECT (SUM(o.total) / GREATEST(COUNT(o.id),1)) AS avg_ticket
FROM orders o
WHERE o.timestamp >= NOW() - INTERVAL '30 days';

-- 6) Mark an order served (update status and served_at)
UPDATE orders
SET status = 'served', served_at = NOW()
WHERE id = $1; -- parameterize order id

-- 7) Decrease inventory based on usage (example)
UPDATE inventory
SET quantity = quantity - $1
WHERE id = $2 AND quantity > 0; -- $1 = qty used, $2 = inventory id

-- 8) Add an attendance log (example)
INSERT INTO attendance_logs (id, employee_id, action, timestamp, note)
VALUES ('att-' || FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint, $1, $2, NOW(), $3);

-- 9) Performance leaderboard
SELECT p.employee_id, e.name, p.rating, p.completed_orders
FROM performance_scores p
JOIN employees e ON e.id = p.employee_id
ORDER BY p.rating DESC, p.completed_orders DESC;

-- 10) Inventory value summary
SELECT SUM(quantity * cost) AS inventory_value FROM inventory;

-- End of queries
