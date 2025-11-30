# Profile Edit Request System - Implementation Status

## Overview

This document tracks the implementation of the profile edit request system where regular employees can request profile changes that require manager/admin approval.

## ✅ Completed

### 1. Database Structure

- [x] Created `requests` table with dual-purpose design
- [x] Added `request_type` field ('leave' or 'profile_edit')
- [x] Added `requested_changes` JSONB field for storing profile edit data
- [x] Renamed `approved_by` → `reviewed_by` (more generic)
- [x] Renamed `approved_at` → `reviewed_at` (more generic)
- [x] Migration script created (`sql/migrate_leave_to_requests.sql`)

### 2. Backend Changes

- [x] Updated TABLES list: `leave_requests` → `requests`
- [x] Updated `fetch_table()` to convert all request fields to camelCase
- [x] Added conversion for `request_type` → `requestType`
- [x] Added conversion for `requested_changes` → `requestedChanges`
- [x] Added conversion for `reviewed_by` → `reviewedBy`
- [x] Added conversion for `reviewed_at` → `reviewedAt`
- [x] Updated `save_state()` to handle requests table with new fields
- [x] Updated `/api/state` endpoint to return `requests` instead of `leaveRequests`

### 3. Frontend - Core Updates

- [x] Renamed `appState.leaveRequests` → `appState.requests` throughout codebase
- [x] Updated `common.js` initialization
- [x] Updated `attendance.js` leave request submission
- [x] Updated `employees.js` request approval functions
- [x] Updated all debug logging references

### 4. Permission System

- [x] Added `manager` permission level
- [x] Created `isManager()` function
- [x] Created `isAdminOrManager()` helper function
- [x] Updated employee management permissions (add/edit/remove employees)
- [x] Updated leave approval permissions (approve/reject requests)
- [x] Updated landing page routing for manager role
- [x] SQL script to add manager users (`sql/add_manager_permission.sql`)

### 5. Documentation

- [x] Created comprehensive migration guide (`MANAGER_PERMISSION_MIGRATION.md`)
- [x] Created this status tracking document

## 🚧 Remaining Work

### 1. Profile Edit Request UI

#### 1a. Request Submission (User Side)

**Location**: `js/common.js` - `openEditProfileModal()` function

Current behavior: Profile edits save directly to `appState.users`

Needed changes:

```javascript
// Add a "Request Approval" mode for non-admin users
// When user clicks Save on profile edit:

if (!isAdminOrManager()) {
  // Create a profile edit request instead of direct edit
  const request = {
    id: generateId("req"),
    employeeId: currentUser.id,
    requestType: "profile_edit",
    requestedChanges: {
      name: newName,
      email: newEmail,
      phone: newPhone,
      role: newRole,
      shiftStart: newShiftStart,
    },
    status: "pending",
    requestedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
  };

  appState.requests = appState.requests || [];
  appState.requests.push(request);
  saveState();

  alert("Profile change request submitted for approval");
} else {
  // Admins/managers can edit directly (current behavior)
  // ... existing direct edit code
}
```

**Files to modify**:

- `js/common.js` - Update `openEditProfileModal()` around line 600-700

#### 1b. Request Review UI (Manager/Admin Side)

**Location**: `js/employees.js` - Need new function or update `renderLeaveApprovals()`

Current behavior: Only shows leave requests

Needed changes:

```javascript
// Rename renderLeaveApprovals() to renderRequests()
// Update to handle both leave and profile_edit types

function renderRequests() {
  const pendingRequests = (appState.requests || []).filter(
    (req) => req.status === "pending"
  );

  const leaveRequests = pendingRequests.filter(
    (req) => req.requestType === "leave"
  );

  const profileRequests = pendingRequests.filter(
    (req) => req.requestType === "profile_edit"
  );

  // Render leave requests section (existing code)
  renderLeaveRequests(leaveRequests);

  // Render NEW profile edit requests section
  renderProfileEditRequests(profileRequests);
}

function renderProfileEditRequests(requests) {
  // Show each profile edit request with:
  // - Employee name
  // - Current values vs requested changes (side-by-side comparison)
  // - Approve/Reject buttons
}
```

**UI Design for Profile Edit Requests**:

```html
<div class="request-card">
  <h4>John Dela Cruz - Profile Edit Request</h4>
  <div class="changes-comparison">
    <div class="current-values">
      <h5>Current</h5>
      <p>Name: John Dela Cruz</p>
      <p>Email: john@sweetbox.com</p>
      <p>Phone: 0918 234 5678</p>
      <p>Role: Cashier</p>
    </div>
    <div class="requested-values">
      <h5>Requested Changes</h5>
      <p>Name: John D. Cruz</p>
      <p>Email: johndcruz@sweetbox.com</p>
      <p>Phone: 0918 234 5678</p>
      <p>Role: Senior Cashier</p>
    </div>
  </div>
  <div class="request-actions">
    <button onclick="approveProfileEdit('req-123')">Approve</button>
    <button onclick="rejectProfileEdit('req-123')">Reject</button>
  </div>
</div>
```

#### 1c. Approval/Rejection Logic

**Location**: `js/employees.js`

Need new functions:

```javascript
window.approveProfileEdit = async function (requestId) {
  if (!isAdminOrManager()) {
    alert("Only administrators and managers can approve profile edits.");
    return;
  }

  const request = appState.requests.find((r) => r.id === requestId);
  if (!request || request.requestType !== "profile_edit") return;

  // Find the employee
  const employee = appState.users.find((u) => u.id === request.employeeId);
  if (!employee) return;

  // Apply the requested changes
  const changes = request.requestedChanges;
  if (changes.name) employee.name = changes.name;
  if (changes.email) employee.email = changes.email;
  if (changes.phone) employee.phone = changes.phone;
  if (changes.role) employee.role = changes.role;
  if (changes.shiftStart) employee.shiftStart = changes.shiftStart;

  // Mark request as approved
  const currentUser = getCurrentUser();
  request.status = "approved";
  request.reviewedBy = currentUser.id;
  request.reviewedAt = new Date().toISOString();

  saveState();
  renderEmployees();
  alert("Profile edit approved and applied!");
};

window.rejectProfileEdit = async function (requestId) {
  if (!isAdminOrManager()) {
    alert("Only administrators and managers can reject profile edits.");
    return;
  }

  const request = appState.requests.find((r) => r.id === requestId);
  if (!request || request.requestType !== "profile_edit") return;

  // Mark request as rejected (no changes applied)
  const currentUser = getCurrentUser();
  request.status = "rejected";
  request.reviewedBy = currentUser.id;
  request.reviewedAt = new Date().toISOString();

  saveState();
  renderEmployees();
  alert("Profile edit rejected.");
};
```

### 2. UI/UX Enhancements

#### 2a. Request Status Indicator

Show users the status of their pending requests:

- In the profile modal or attendance page
- "You have a pending profile change request"
- Show status: pending/approved/rejected

#### 2b. Request History

Add a section to view past requests (both leave and profile edits):

- Filter by: All / Leave / Profile Edit
- Filter by: Pending / Approved / Rejected
- Show timestamps and reviewer

#### 2c. Notification Badge

Add a badge/counter for pending requests:

- In the Employees page navigation
- Shows count of pending requests needing review

### 3. Testing Requirements

- [ ] Regular user can submit profile edit request
- [ ] Request appears in manager/admin approval queue
- [ ] Manager can see side-by-side comparison of changes
- [ ] Approve button applies changes and updates request status
- [ ] Reject button updates status without applying changes
- [ ] User receives feedback about request status
- [ ] Multiple simultaneous requests handled correctly
- [ ] Both leave and profile requests coexist in same table

### 4. Edge Cases to Handle

- [ ] User submits new request while previous one is pending
  - Solution: Block new requests or replace pending request
- [ ] User is deleted while their request is pending
  - Solution: CASCADE delete from requests table (already handled in schema)
- [ ] Manager/admin tries to edit their own profile
  - Solution: Allow direct edit (they can approve their own changes)
- [ ] Requested email conflicts with existing user
  - Solution: Validate during approval, show error, keep request pending

## Implementation Priority

**Phase 1** (Ready to implement now):

1. Update `openEditProfileModal()` to create profile edit requests for non-admin users
2. Add basic profile edit request review UI in Employees page
3. Implement `approveProfileEdit()` and `rejectProfileEdit()` functions
4. Test basic flow: submit → review → approve/reject

**Phase 2** (Polish):

1. Add side-by-side comparison UI for profile changes
2. Add request status indicator for users
3. Add pending request badge in navigation
4. Style the profile edit request cards

**Phase 3** (Optional enhancements):

1. Request history viewer
2. Email notifications for request status changes
3. Bulk approve/reject functionality
4. Request comments/notes field

## Files to Modify

- `js/common.js`: Update `openEditProfileModal()` (lines ~600-700)
- `js/employees.js`:
  - Rename `renderLeaveApprovals()` → `renderRequests()`
  - Add `renderProfileEditRequests()`
  - Add `approveProfileEdit()` and `rejectProfileEdit()`
- `employees.html`: Add section for profile edit requests (if needed)
- `design.css`: Style the profile edit request comparison UI

## Testing Checklist

- [ ] As regular user: Can submit profile edit request
- [ ] As regular user: Cannot directly edit profile
- [ ] As regular user: Can see pending request status
- [ ] As manager: Can see profile edit requests
- [ ] As manager: Can see current vs requested values
- [ ] As manager: Can approve profile edit (changes applied)
- [ ] As manager: Can reject profile edit (no changes)
- [ ] As admin: Retains direct edit capability
- [ ] Both types of requests appear in same queue
- [ ] Database saves requested_changes as JSONB correctly
- [ ] Backend properly converts snake_case ↔ camelCase

## Questions for Consideration

1. Should managers be able to edit their own profiles directly, or go through approval?

   - Recommendation: Direct edit (they have management privileges)

2. Should there be a limit on pending requests per user?

   - Recommendation: One pending profile edit at a time

3. Should rejected requests be deletable or kept for history?

   - Recommendation: Keep for audit trail, add "archive" feature later

4. Should email/phone changes require additional verification?
   - Recommendation: Phase 2 enhancement (email verification link)

## Related Documentation

- `MANAGER_PERMISSION_MIGRATION.md` - Deployment guide for current changes
- `sql/schema.sql` - Database schema with requests table
- `sql/migrate_leave_to_requests.sql` - Migration script
- `sql/add_manager_permission.sql` - Manager user setup
