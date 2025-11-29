# URGENT: Database Schema Fix Required

## Problem

The deployed database `users` table is missing the `email` column, causing:

- 500 errors when creating new accounts
- Login showing `undefined` for all user emails
- Unable to authenticate users

## Console Errors Explained

```
POST https://sweetbox-backend.onrender.com/api/state 500 (Internal Server Error)
{"detail":"column \"email\" of relation \"users\" does not exist"}
```

```
Available user emails: (3) [undefined, undefined, undefined]
❌ Login failed for: arvesujohnpaul@gmail.com
```

## Immediate Fix Steps

### Step 1: Connect to Render Database

1. Go to Render Dashboard: https://dashboard.render.com
2. Click on your PostgreSQL database service
3. Click "Connect" → "External Connection" or use the Shell

### Step 2: Run the Fix Script

In the database console, run this SQL:

```sql
-- Option 1: If table exists but missing columns
DO $$
BEGIN
    -- Add email column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(255);
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;

    -- Add phone column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'phone'
    ) THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(32);
    END IF;

    -- Add password column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT 'changeme';
    END IF;
END $$;
```

### Step 3: Verify Table Structure

```sql
-- Check if email column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

Expected output should include:

- `id` (varchar)
- `name` (varchar)
- `email` (varchar)
- `password` (varchar)
- `phone` (varchar)
- `role` (varchar)
- `permission` (varchar)
- Other columns...

### Step 4: If Table Doesn't Exist, Create It

If the `users` table doesn't exist at all:

```sql
-- Drop old table if it exists with wrong schema
DROP TABLE IF EXISTS users CASCADE;

-- Create with correct schema
CREATE TABLE users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  role VARCHAR(128) NOT NULL,
  permission VARCHAR(32) NOT NULL DEFAULT 'kitchen_staff',
  shift_start TIME,
  hire_date DATE,
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 5: Test After Fix

1. Clear browser localStorage:

   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

2. Refresh the login page
3. Open browser console (F12)
4. Try to create a new account
5. Check console - should see:

   ```
   ✅ Loaded users from server: X
   Available user emails: ['user@example.com', ...]
   ```

6. Try to login with the new account

## Alternative: Re-run Full Schema

If you want to start fresh (⚠️ **This will delete all existing data**):

```sql
-- Run the complete schema.sql file
-- Copy contents from: sql/schema.sql
-- Or navigate to: sweet_box/sql/schema.sql
```

## Verify Backend is Working

After database fix:

1. **Test API endpoint:**

   ```
   GET https://sweetbox-backend.onrender.com/api/state
   ```

   Should return users with email addresses visible

2. **Check backend logs** in Render:
   - No more "column email does not exist" errors
   - Should see "Saved X users" messages

## If Issues Persist

### Check Current Database Schema

```sql
-- See what columns actually exist
\d users

-- Or:
SELECT * FROM information_schema.columns WHERE table_name = 'users';
```

### Check Existing Data

```sql
-- See if there are any users
SELECT COUNT(*) FROM users;

-- Try to see user data (may fail if columns missing)
SELECT id, name FROM users LIMIT 5;
```

### Backup Before Dropping

```sql
-- If you have data you want to keep
CREATE TABLE users_backup AS SELECT * FROM users;
```

## Files Included

- `sql/fix_users_table.sql` - Run this script in database
- `sql/schema.sql` - Full schema for reference

## Timeline

1. **Now**: Run database fix (5 minutes)
2. **Test**: Try login/signup (2 minutes)
3. **Deploy**: If all works, commit changes (optional)

## Expected Result

✅ Users can register with email and phone
✅ Users can login with email and password  
✅ Console shows proper email addresses
✅ No more 500 errors on signup
