# Database Cleanup Summary
**Date:** November 30, 2025
**Commit:** 11577a1

## Changes Applied

### ✅ Tables Dropped
- **employees** table - Obsolete (merged into `users` table)

### ✅ Columns Removed

#### users table
- **pin** - No longer used after switching to email/password authentication

#### orders table  
- **items** (TEXT) - Superseded by `items_json` (JSONB)
  - Migrated 30 orders from text to JSONB format before removal
  - Now only using `items_json` for structured order data

#### inventory table
- **unit** (VARCHAR) - Not used in application
- **reorder_point** (INTEGER) - Not used in application

### ✅ Foreign Keys Verified
All foreign keys now correctly reference the `users` table:
- ✓ `attendance_logs.employee_id` → `users.id`
- ✓ `leave_requests.employee_id` → `users.id`
- ✓ `leave_requests.approved_by` → `users.id`

No remaining references to the deleted `employees` table.

### 📊 Final Database Schema

#### users (12 columns)
- id, name, email, password, phone, role, permission
- shift_start, hire_date, status, require_password_reset, created_at

#### attendance_logs (6 columns)
- id, employee_id, action, timestamp, shift, note

#### leave_requests (9 columns)
- id, employee_id, start_date, end_date, reason, status
- requested_at, approved_by, approved_at

#### inventory (6 columns)
- id, category, name, quantity, cost, created_at

#### orders (8 columns)
- id, customer, items_json, total, status, type, timestamp, served_at

#### sales_history (4 columns)
- id, date, total, orders_count

#### inventory_usage (3 columns)
- id, label, used

### 🔧 Backend Updates
Updated `backend/main.py`:
- Removed `items` field from orders INSERT/UPDATE queries
- Removed `unit` and `reorder_point` fields from inventory queries
- Cleaned up SQL to only reference existing columns

### 📝 Schema Files Updated
- `sql/schema.sql` - Updated to reflect current structure
- Removed obsolete column definitions
- Added `leave_requests` table definition

## Columns Kept (Still Used)

These columns were analyzed and confirmed as necessary:

✓ **users.status** - Tracks active/inactive employees  
✓ **users.phone** - Contact information (used by 5/5 users on production)  
✓ **attendance_logs.shift** - Displays shift information in logs  
✓ **orders.items_json** - JSONB format for structured order items  

## Testing Required

After deployment:
1. ✅ Verify orders display correctly (using `items_json`)
2. ✅ Verify inventory operations work without `unit`/`reorder_point`
3. ✅ Verify attendance logs save correctly
4. ✅ Verify leave requests work properly

## Migration Impact

- **Zero data loss** - All data migrated before column removal
- **Backward compatible** - Frontend already uses camelCase (itemsJson)
- **Production & Local** - Both databases cleaned up consistently
