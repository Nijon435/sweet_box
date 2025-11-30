-- Add manager permission level and create a sample manager user

-- Update one of the existing admin users to be a manager instead
UPDATE users 
SET permission = 'manager', 
    role = 'manager'
WHERE email = 'admin@sweetbox.com';

-- Or add a new manager user if preferred
INSERT INTO users (id, name, email, password, phone, role, permission, shift_start, hire_date, status, created_at) VALUES
  ('user-manager-1', 'Jessica Martinez', 'manager@sweetbox.com', 'manager123', '0927 123 4567', 'manager', 'manager', NULL, NOW()::DATE, 'active', NOW())
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

-- Verify the change
SELECT id, name, email, role, permission 
FROM users 
WHERE permission IN ('admin', 'manager')
ORDER BY permission, name;
