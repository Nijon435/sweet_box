# Database Migration: Users & Employees Consolidation

## Overview

This migration consolidates the `users` and `employees` tables into a single `users` table, removes PIN-based authentication, and adds phone numbers and permission management.

## Changes Made

### Database Schema

- **Merged Tables**: Combined `users` and `employees` into single `users` table
- **New Fields**:
  - `phone` (VARCHAR(32)) - User phone numbers
  - `permission` (VARCHAR(32)) - Access level (admin, kitchen_staff, front_staff, delivery_staff)
- **Removed Fields**:
  - `pin` - No longer using PIN authentication
- **Foreign Keys**: Updated `attendance_logs.employee_id` to reference `users(id)`

### Authentication System

- **Email/Password Login**: Replaced PIN dropdown with email and password inputs
- **Account Registration**: Users can create accounts (default permission: kitchen_staff)
- **Session Management**: Sessions clear on window close for security

### Permission Levels

1. **admin** - Full access to all features, excluded from attendance tracking
2. **kitchen_staff** - Kitchen operations access
3. **front_staff** - Front-of-house operations access
4. **delivery_staff** - Delivery operations access

### Admin Users

- Admin users have `shift_start = NULL`
- Admin users are excluded from attendance tracking and charts
- Only admins can change user permissions

## Migration Steps

### 1. Backup Current Database

```powershell
pg_dump -U postgres -d sweetbox > backup_before_migration.sql
```

### 2. Run Migration Script

```powershell
psql -U postgres -d sweetbox -f sql/migrate_to_users.sql
```

Or run manually:

```powershell
cd "c:\Users\Nitro V 15\Documents\CODES 3rd yr\sweet_box"
psql -U postgres -d sweetbox
```

Then execute:

```sql
-- Drop old employees table
DROP TABLE IF EXISTS employees CASCADE;

-- Load new schema
\i sql/schema.sql

-- Load seed data
\i sql/seeds.sql
```

### 3. Verify Migration

Check user count and structure:

```sql
SELECT COUNT(*) FROM users;
SELECT name, email, role, permission, shift_start FROM users;
```

Check attendance logs reference correct users:

```sql
SELECT al.id, u.name, al.action, al.timestamp
FROM attendance_logs al
JOIN users u ON al.employee_id = u.id
LIMIT 10;
```

### 4. Clear Browser Data

Users should clear localStorage to remove old data:

```javascript
// Open browser console (F12) and run:
localStorage.clear();
location.reload();
```

## Updated Files

### Backend

- `backend/main.py`
  - Updated TABLES list (removed employees, kept users)
  - Updated save_state() to handle users table with new fields
  - Updated camelCase conversion for users table
  - Updated /api/state endpoint to return users instead of employees

### Frontend JavaScript

- `js/common.js`
  - Updated getEmptyData() to use users instead of employees
  - Updated getEmployee() to use appState.users
  - Session management already uses appState.users
- `js/attendance.js`
  - Updated to use appState.users
  - Filters out admin users from attendance tracking
- `js/dashboard.js`
  - Updated to use appState.users
  - Filters out admin users from staff coverage calculations
- `js/employees.js`
  - Added renderUserPermissions() function for permission management
  - Updated all references from appState.employees to appState.users
  - Filters out admin users from employee roster display

### Database

- `sql/schema.sql` - New unified users table structure
- `sql/seeds.sql` - 11 users including John Paul Arvesu (user-1, admin)
- `sql/migrate_to_users.sql` - Migration script

### HTML

- `login.html` - New email/password login and registration forms
- `employees.html` - Now displays user permissions table

## Seed Data

### Admin Users (2)

1. **John Paul Arvesu** (user-1)

   - Email: arvesujohnpaul@gmail.com
   - Password: april435
   - Phone: 0992 867 0457
   - Permission: admin

2. **Sofia Morales** (user-2)
   - Email: admin@sweetbox.com
   - Password: admin123
   - Phone: 0917 123 4567
   - Permission: admin

### Staff Users (9)

- user-3 through user-11 with various roles and permissions
- All have shift_start times and hire_date values

## Testing Checklist

- [ ] Login with John Paul's credentials
- [ ] Verify admin can access all pages
- [ ] Check Team page shows all 11 users
- [ ] Verify attendance page excludes admins
- [ ] Test account registration
- [ ] Confirm permission changes save correctly
- [ ] Test session clears on tab close
- [ ] Verify attendance logs reference correct user IDs
- [ ] Check dashboard staff coverage excludes admins
- [ ] Test inventory, orders, and analytics functionality

## Rollback Plan

If issues occur, restore from backup:

```powershell
psql -U postgres -d sweetbox < backup_before_migration.sql
```

Then revert code changes using git:

```powershell
git checkout HEAD -- backend/main.py js/*.js sql/*.sql
```

## Notes

- **Role vs Permission**: "role" is job title (manager, cashier, etc.), "permission" is access level
- **Admin Exclusion**: Admins don't have shift times and shouldn't appear in attendance systems
- **ID Format**: User IDs changed from `emp-X` to `user-X` format
- **Attendance Logs**: Updated to reference user-3 through user-11 (skipping two admin users)
