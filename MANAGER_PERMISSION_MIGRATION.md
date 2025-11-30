# Manager Permission and Requests Table Migration Guide

This guide walks through deploying the new manager permission level and the renamed requests table (formerly leave_requests).

## What Changed

### 1. Database Changes

- **Renamed Table**: `leave_requests` → `requests`
- **New Fields in requests table**:
  - `request_type` VARCHAR(32): 'leave' or 'profile_edit'
  - `requested_changes` JSONB: Stores profile edit data
  - `reviewed_by` (renamed from `approved_by`)
  - `reviewed_at` (renamed from `approved_at`)

### 2. New Permission Level

- Added `manager` permission level
- Managers can:
  - View and manage employee data
  - Add/edit/remove employees
  - Approve/reject leave requests
  - View attendance logs
- Managers CANNOT:
  - Manage inventory (admin only)
  - Reset demo data (admin only)

### 3. Code Changes

- Backend: Updated `main.py` TABLES list and field conversions
- Frontend: Updated all `leaveRequests` → `requests`
- Added `isManager()` and `isAdminOrManager()` functions
- Updated permission checks throughout employee management

## Deployment Steps

### Step 1: Backup Current Database

```bash
# For production (Render)
pg_dump -h dpg-d4jhnmkhg0os73bqhhl0-a.singapore-postgres.render.com -U sweetbox_bxzd_user -d sweetbox_bxzd > backup_$(date +%Y%m%d).sql

# For local
pg_dump -h localhost -U postgres -d sweetbox > backup_local_$(date +%Y%m%d).sql
```

### Step 2: Run Database Migrations

**IMPORTANT**: Run migrations in this exact order:

#### 2a. Migrate leave_requests to requests table

```bash
# Production
psql -h dpg-d4jhnmkhg0os73bqhhl0-a.singapore-postgres.render.com -U sweetbox_bxzd_user -d sweetbox_bxzd -f sql/migrate_leave_to_requests.sql

# Local
psql -h localhost -U postgres -d sweetbox -f sql/migrate_leave_to_requests.sql
```

This script will:

1. Create the new `requests` table
2. Copy all data from `leave_requests` with `request_type = 'leave'`
3. Show verification counts
4. **NOT drop the old table yet** (for safety)

#### 2b. Verify the migration

```sql
-- Check that all data was copied
SELECT
    (SELECT COUNT(*) FROM leave_requests) as old_count,
    (SELECT COUNT(*) FROM requests WHERE request_type = 'leave') as new_count;

-- Spot check a few records
SELECT id, employee_id, start_date, end_date, status, request_type
FROM requests
LIMIT 5;
```

#### 2c. Add manager permission (optional - can also do this via UI)

```bash
# Production
psql -h dpg-d4jhnmkhg0os73bqhhl0-a.singapore-postgres.render.com -U sweetbox_bxzd_user -d sweetbox_bxzd -f sql/add_manager_permission.sql

# Local
psql -h localhost -U postgres -d sweetbox -f sql/add_manager_permission.sql
```

### Step 3: Deploy Backend Changes

```bash
# Commit and push changes
git add .
git commit -m "feat: add manager permission and rename leave_requests to requests"
git push origin main
```

Render will auto-deploy. Monitor the deployment logs at:
https://dashboard.render.com/web/srv-your-service-id

### Step 4: Test the Deployment

1. **Test leave request display**:

   - Log in as any user
   - Go to Attendance page
   - Check if existing leave requests appear correctly
   - Open browser console and look for "📋 Total requests:" log

2. **Test manager permissions**:

   - Log in as the new manager user (manager@sweetbox.com / manager123)
   - Verify access to:
     - Employees page ✓
     - Can add/edit/remove employees ✓
     - Can approve/reject leave requests ✓
   - Verify NO access to:
     - Inventory management (buttons should be disabled)
     - Reset data button

3. **Test leave request submission**:
   - Log in as a regular employee
   - Go to Attendance page
   - Submit a new leave request
   - Check if it appears in the manager/admin's approval list

### Step 5: Clean Up Old Table (After Verification)

**ONLY after confirming everything works:**

```sql
-- Drop the old leave_requests table
DROP TABLE IF EXISTS leave_requests CASCADE;
```

## Rollback Plan

If something goes wrong:

### Option 1: Quick Rollback (if old table still exists)

```sql
-- Restore the old table reference in backend
-- Revert the TABLES list in main.py to use "leave_requests"
-- Redeploy backend
```

### Option 2: Full Rollback from Backup

```bash
# Restore production database
psql -h dpg-d4jhnmkhg0os73bqhhl0-a.singapore-postgres.render.com -U sweetbox_bxzd_user -d sweetbox_bxzd < backup_YYYYMMDD.sql

# Restore local database
psql -h localhost -U postgres -d sweetbox < backup_local_YYYYMMDD.sql

# Revert code changes
git revert HEAD
git push origin main
```

## Testing Checklist

- [ ] Backend deploys successfully
- [ ] Frontend loads without console errors
- [ ] Existing leave requests appear correctly
- [ ] Can submit new leave requests
- [ ] Manager can view Employees page
- [ ] Manager can add/edit/remove employees
- [ ] Manager can approve/reject leave requests
- [ ] Manager CANNOT manage inventory
- [ ] Admin retains all previous permissions
- [ ] Regular staff permissions unchanged

## Future: Profile Edit Requests

The new `requests` table structure supports profile edit requests. To implement:

1. Create a "Request Profile Edit" UI in the profile modal
2. Save edits with `request_type: 'profile_edit'` and `requested_changes: {...}`
3. Add approval UI in the Employees page to review profile changes
4. Update the `renderRequests()` function to handle both leave and profile edit types

## Troubleshooting

### "Relation leave_requests does not exist"

- The backend is looking for the old table
- Verify migration ran successfully
- Check backend code was deployed

### Leave requests not showing

- Check browser console for errors
- Verify `appState.requests` exists (not `appState.leaveRequests`)
- Check network tab for /api/state response

### Manager permission not working

- Verify user's permission field is set to 'manager'
- Check `isManager()` function is defined in common.js
- Clear browser cache and reload

### Database connection issues

- Verify environment variables are correct
- Check Render dashboard for database status
- Ensure IP allowlist includes your connection source

## Files Modified

### Backend

- `backend/main.py`: TABLES list, fetch_table(), save_state()

### Frontend

- `js/common.js`: Added isManager(), isAdminOrManager(), updated appState
- `js/employees.js`: Updated permission checks, requests array usage
- `js/attendance.js`: Updated requests array usage

### Database

- `sql/schema.sql`: Replaced leave_requests with requests table
- `sql/migrate_leave_to_requests.sql`: Migration script (NEW)
- `sql/add_manager_permission.sql`: Manager user setup (NEW)

## Support

If issues arise during deployment:

1. Check Render logs: `https://dashboard.render.com/`
2. Check browser console for frontend errors
3. Verify database connection with: `psql -h <host> -U <user> -d <database> -c "SELECT 1"`
4. Review recent commits: `git log --oneline -10`
