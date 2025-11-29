function renderUserPermissions() {
  const tbody = document.getElementById("user-permissions-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!appState.users || appState.users.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="4" style="text-align: center;">No users found</td>';
    tbody.appendChild(row);
    return;
  }

  appState.users.forEach((user) => {
    const row = document.createElement("tr");

    const permissionLabel = (user.permission || "kitchen_staff").replace(
      "_",
      " "
    );
    const permissionClass =
      user.permission === "admin" ? "chip-primary" : "chip";

    row.innerHTML = `
      <td><strong>${user.name}</strong></td>
      <td>${user.email}</td>
      <td><span class="${permissionClass}">${permissionLabel}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editUserPermissions('${
          user.id
        }')" ${
      !isAdmin() ? "disabled" : ""
    } style="margin-right: 0.5rem;">Edit</button>
        <button class="btn btn-outline btn-sm" onclick="saveUserRole('${
          user.id
        }')" ${
      !isAdmin() ? "disabled" : ""
    } style="display: none;">Save</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.editUserPermissions = function (userId) {
  const user = appState.users.find((u) => u.id === userId);
  if (!user) {
    alert("User not found");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3>Edit User: ${user.name}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <form id="edit-user-permissions-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label>Name</label>
            <input type="text" name="name" value="${user.name}" required>
          </div>
          <div>
            <label>Email</label>
            <input type="email" name="email" value="${user.email}" required>
          </div>
          <div>
            <label>Phone</label>
            <input type="text" name="phone" value="${user.phone || ""}">
          </div>
          <div>
            <label>Password</label>
            <input type="password" name="password" value="${
              user.password
            }" required>
          </div>
          <div>
            <label>Role (Job Title)</label>
            <input type="text" name="role" value="${user.role}" required>
          </div>
          <div>
            <label>Permission Level</label>
            <select name="permission" required>
              <option value="admin" ${
                user.permission === "admin" ? "selected" : ""
              }>Admin - Full Access</option>
              <option value="kitchen_staff" ${
                user.permission === "kitchen_staff" ? "selected" : ""
              }>Kitchen Staff</option>
              <option value="front_staff" ${
                user.permission === "front_staff" ? "selected" : ""
              }>Front Staff</option>
              <option value="delivery_staff" ${
                user.permission === "delivery_staff" ? "selected" : ""
              }>Delivery Staff</option>
            </select>
          </div>
          <div>
            <label>Shift Start</label>
            <input type="time" name="shiftStart" value="${
              user.shiftStart || ""
            }">
            <small class="meta">Leave empty for admin users</small>
          </div>
          <div>
            <label>Hire Date</label>
            <input type="date" name="hireDate" value="${
              user.hireDate
                ? new Date(user.hireDate).toISOString().split("T")[0]
                : ""
            }">
          </div>
          <div style="grid-column: 1 / -1;">
            <label>Status</label>
            <select name="status" required>
              <option value="active" ${
                user.status === "active" ? "selected" : ""
              }>Active</option>
              <option value="inactive" ${
                user.status === "inactive" ? "selected" : ""
              }>Inactive</option>
            </select>
          </div>
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#edit-user-permissions-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    // Update user object
    user.name = formData.get("name");
    user.email = formData.get("email");
    user.phone = formData.get("phone");
    user.password = formData.get("password");
    user.role = formData.get("role");
    user.permission = formData.get("permission");
    user.shiftStart = formData.get("shiftStart") || null;
    user.hireDate = formData.get("hireDate");
    user.status = formData.get("status");

    // If user is admin, clear shift start
    if (user.permission === "admin") {
      user.shiftStart = null;
    }

    saveState();
    modal.remove();
    renderUserPermissions();
    renderEmployees();
    alert("User updated successfully!");
  });
};

window.saveUserRole = function (userId) {
  const select = document.querySelector(
    `.permission-select[data-user-id="${userId}"]`
  );
  if (!select) return;

  const newPermission = select.value;
  const user = appState.users.find((u) => u.id === userId);

  if (!user) {
    alert("User not found");
    return;
  }

  user.permission = newPermission;
  saveState();
  alert(`Permission updated to ${newPermission.replace("_", " ")}`);
};

function renderEmployees() {
  // Render user permissions table
  renderUserPermissions();

  const form = document.getElementById("employee-form");
  const roleSelect = document.getElementById("employee-role");
  const customRoleField = document.getElementById("custom-role-field");
  const customRoleInput = document.getElementById("employee-role-custom");
  const totalNode = document.getElementById("employee-total");
  const rolesNode = document.getElementById("employee-roles");
  const earliestNode = document.getElementById("employee-earliest");
  const roleList = document.getElementById("employee-role-list");
  const rosterBody = document.querySelector("#employee-table tbody");

  const uniqueRoles = () =>
    [...new Set(appState.users.map((emp) => emp.role).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );

  const populateRoleOptions = () => {
    if (!roleSelect) return;
    const currentValue = roleSelect.value;
    roleSelect.innerHTML = "<option value=''>Select role</option>";
    uniqueRoles().forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      roleSelect.appendChild(option);
    });
    const customOption = document.createElement("option");
    customOption.value = "__custom";
    customOption.textContent = "Custom role";
    roleSelect.appendChild(customOption);
    if (currentValue) {
      const hasValue = [...roleSelect.options].some(
        (option) => option.value === currentValue
      );
      roleSelect.value = hasValue ? currentValue : "";
    }
    if (roleSelect.value === "__custom" && customRoleField) {
      customRoleField.classList.remove("hidden");
      if (customRoleInput) customRoleInput.required = true;
    }
  };

  populateRoleOptions();

  if (roleSelect && !roleSelect.dataset.bound) {
    roleSelect.dataset.bound = "true";
    roleSelect.addEventListener("change", () => {
      const useCustom = roleSelect.value === "__custom";
      if (customRoleField)
        customRoleField.classList.toggle("hidden", !useCustom);
      if (customRoleInput) {
        customRoleInput.required = useCustom;
        if (!useCustom) customRoleInput.value = "";
      }
    });
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isAdmin()) {
        alert("Only administrators can add employees.");
        return;
      }
      const data = new FormData(form);
      const name = data.get("name")?.trim();
      let role = data.get("role")?.trim();
      if (role === "__custom") role = data.get("customRole")?.trim();
      const shiftStart = data.get("shiftStart") || "08:00";
      if (!name || !role) return;
      appState.users.push({
        id: `user-${Date.now()}`,
        name,
        role,
        shiftStart,
      });
      saveState();
      form.reset();
      const shiftField = form.querySelector("[name=shiftStart]");
      if (shiftField) shiftField.value = "08:00";
      if (roleSelect) roleSelect.value = "";
      if (customRoleField) customRoleField.classList.add("hidden");
      if (customRoleInput) {
        customRoleInput.required = false;
        customRoleInput.value = "";
      }
      populateRoleOptions();
      renderEmployees();
    });
  }

  const totalStaff = appState.users.length;
  const roles = uniqueRoles();
  const earliestShift = appState.users.reduce((min, emp) => {
    if (!emp.shiftStart) return min;
    if (!min) return emp.shiftStart;
    return emp.shiftStart < min ? emp.shiftStart : min;
  }, "");

  // Update new compact team overview
  updateTeamOverview();

  if (rosterBody) {
    rosterBody.innerHTML = "";
    const sorted = [...appState.users].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    if (!sorted.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="9" class="empty-state">No employees registered yet.</td>`;
      rosterBody.appendChild(row);
    } else {
      sorted.forEach((employee) => {
        const row = document.createElement("tr");
        const hireDate = employee.hireDate
          ? new Date(employee.hireDate).toLocaleDateString()
          : "--";
        const permissionLabel = (
          employee.permission || "kitchen_staff"
        ).replace("_", " ");
        row.innerHTML = `
        <td><strong>${employee.name}</strong></td>
        <td>${employee.email || "--"}</td>
        <td>${employee.phone || "--"}</td>
        <td>${employee.role}</td>
        <td><span class="chip">${permissionLabel}</span></td>
        <td>${employee.shiftStart || "--"}</td>
        <td>${hireDate}</td>
        <td><span class="chip ${
          employee.status === "active" ? "chip-success" : "chip-warning"
        }">${employee.status || "active"}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openEditEmployeeModal('${
            employee.id
          }')" data-role="admin" style="margin-right: 0.5rem;">Edit</button>
          <button class="btn btn-outline btn-sm" onclick="confirmDeleteEmployee('${
            employee.id
          }')" data-role="admin">Remove</button>
        </td>
      `;
        rosterBody.appendChild(row);
      });
    }
  }

  const attachRemovalHandlers = () => {
    document.querySelectorAll("[data-delete-employee]").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        if (!isAdmin()) {
          alert("Only administrators can remove employees.");
          return;
        }
        const id = button.dataset.deleteEmployee;
        const target = appState.users.find((emp) => emp.id === id);
        if (!target) return;
        const confirmed = confirm(`Remove ${target.name} from the roster?`);
        if (!confirmed) return;
        appState.users = appState.users.filter((emp) => emp.id !== id);
        saveState();
        renderEmployees();
      });
    });

    // Add edit button handlers
    document.querySelectorAll("[data-edit-employee]").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        if (!isAdmin()) {
          alert("Only administrators can edit employees.");
          return;
        }
        const id = button.dataset.editEmployee;
        openEditModal(id);
      });
    });
  };

  const openEditModal = (userId) => {
    const user = appState.users.find((u) => u.id === userId);
    if (!user) return;

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Edit Employee: ${user.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        <form id="edit-employee-form">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label>Name</label>
              <input type="text" name="name" value="${user.name}" required>
            </div>
            <div>
              <label>Email</label>
              <input type="email" name="email" value="${user.email}" required>
            </div>
            <div>
              <label>Phone</label>
              <input type="text" name="phone" value="${user.phone || ""}">
            </div>
            <div>
              <label>Role</label>
              <input type="text" name="role" value="${user.role}" required>
            </div>
            <div>
              <label>Permission</label>
              <select name="permission" required>
                <option value="admin" ${
                  user.permission === "admin" ? "selected" : ""
                }>Admin</option>
                <option value="kitchen_staff" ${
                  user.permission === "kitchen_staff" ? "selected" : ""
                }>Kitchen Staff</option>
                <option value="front_staff" ${
                  user.permission === "front_staff" ? "selected" : ""
                }>Front Staff</option>
                <option value="delivery_staff" ${
                  user.permission === "delivery_staff" ? "selected" : ""
                }>Delivery Staff</option>
              </select>
            </div>
            <div>
              <label>Shift Start</label>
              <input type="time" name="shiftStart" value="${
                user.shiftStart || ""
              }">
            </div>
            <div>
              <label>Hire Date</label>
              <input type="date" name="hireDate" value="${
                user.hireDate
                  ? new Date(user.hireDate).toISOString().split("T")[0]
                  : ""
              }">
            </div>
            <div>
              <label>Status</label>
              <select name="status" required>
                <option value="active" ${
                  user.status === "active" ? "selected" : ""
                }>Active</option>
                <option value="inactive" ${
                  user.status === "inactive" ? "selected" : ""
                }>Inactive</option>
              </select>
            </div>
          </div>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector("#edit-employee-form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      user.name = formData.get("name");
      user.email = formData.get("email");
      user.phone = formData.get("phone");
      user.role = formData.get("role");
      user.permission = formData.get("permission");
      user.shiftStart = formData.get("shiftStart");
      user.hireDate = formData.get("hireDate");
      user.status = formData.get("status");

      saveState();
      modal.remove();
      renderEmployees();
      alert("Employee updated successfully!");
    });
  };

  attachRemovalHandlers();
  updateQuickMetrics();
  attachQuickActionHandlers();
}

// Update team overview with permission distribution and stats
function updateTeamOverview() {
  const users = appState.users || [];
  const total = users.length;

  if (total === 0) return;

  // Count by permission
  const permissionCounts = {
    admin: users.filter((u) => u.permission === "admin").length,
    kitchen_staff: users.filter((u) => u.permission === "kitchen_staff").length,
    front_staff: users.filter((u) => u.permission === "front_staff").length,
    delivery_staff: users.filter((u) => u.permission === "delivery_staff")
      .length,
  };

  // Update permission bar widths and labels
  const adminBar = document.getElementById("permission-bar-admin");
  const kitchenBar = document.getElementById("permission-bar-kitchen");
  const frontBar = document.getElementById("permission-bar-front");
  const deliveryBar = document.getElementById("permission-bar-delivery");

  const adminPct = (permissionCounts.admin / total) * 100;
  const kitchenPct = (permissionCounts.kitchen_staff / total) * 100;
  const frontPct = (permissionCounts.front_staff / total) * 100;
  const deliveryPct = (permissionCounts.delivery_staff / total) * 100;

  if (adminBar) {
    adminBar.style.width = `${adminPct}%`;
    adminBar.textContent =
      permissionCounts.admin > 0 ? permissionCounts.admin : "";
    adminBar.style.display = adminPct === 0 ? "none" : "flex";
  }
  if (kitchenBar) {
    kitchenBar.style.width = `${kitchenPct}%`;
    kitchenBar.textContent =
      permissionCounts.kitchen_staff > 0 ? permissionCounts.kitchen_staff : "";
    kitchenBar.style.display = kitchenPct === 0 ? "none" : "flex";
  }
  if (frontBar) {
    frontBar.style.width = `${frontPct}%`;
    frontBar.textContent =
      permissionCounts.front_staff > 0 ? permissionCounts.front_staff : "";
    frontBar.style.display = frontPct === 0 ? "none" : "flex";
  }
  if (deliveryBar) {
    deliveryBar.style.width = `${deliveryPct}%`;
    deliveryBar.textContent =
      permissionCounts.delivery_staff > 0
        ? permissionCounts.delivery_staff
        : "";
    deliveryBar.style.display = deliveryPct === 0 ? "none" : "flex";
  }

  // Update legend
  const adminLegend = document.getElementById("permission-legend-admin");
  const kitchenLegend = document.getElementById("permission-legend-kitchen");
  const frontLegend = document.getElementById("permission-legend-front");
  const deliveryLegend = document.getElementById("permission-legend-delivery");

  if (adminLegend) adminLegend.textContent = `${permissionCounts.admin} Admin`;
  if (kitchenLegend)
    kitchenLegend.textContent = `${permissionCounts.kitchen_staff} Kitchen`;
  if (frontLegend)
    frontLegend.textContent = `${permissionCounts.front_staff} Front`;
  if (deliveryLegend)
    deliveryLegend.textContent = `${permissionCounts.delivery_staff} Delivery`;

  // Calculate active rate
  const activeCount = users.filter((u) => u.status === "active").length;
  const activeRate = total > 0 ? Math.round((activeCount / total) * 100) : 0;
  const activeRateEl = document.getElementById("active-rate");
  if (activeRateEl) activeRateEl.textContent = `${activeRate}%`;

  // Find newest hire
  const usersWithHireDate = users.filter((u) => u.hireDate);
  const newestHireEl = document.getElementById("newest-hire");
  if (newestHireEl) {
    if (usersWithHireDate.length > 0) {
      const newest = usersWithHireDate.reduce((latest, user) => {
        return new Date(user.hireDate) > new Date(latest.hireDate)
          ? user
          : latest;
      });
      const hireDate = new Date(newest.hireDate);
      const formattedDate = hireDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      newestHireEl.textContent = `${newest.name} (${formattedDate})`;
    } else {
      newestHireEl.textContent = "--";
    }
  }

  // Calculate average tenure
  const averageTenureEl = document.getElementById("average-tenure");
  if (averageTenureEl) {
    if (usersWithHireDate.length > 0) {
      const now = new Date();
      const totalMonths = usersWithHireDate.reduce((sum, user) => {
        const hireDate = new Date(user.hireDate);
        const months =
          (now.getFullYear() - hireDate.getFullYear()) * 12 +
          (now.getMonth() - hireDate.getMonth());
        return sum + Math.max(0, months);
      }, 0);
      const avgMonths = Math.round(totalMonths / usersWithHireDate.length);
      if (avgMonths < 12) {
        averageTenureEl.textContent = `${avgMonths} month${
          avgMonths !== 1 ? "s" : ""
        }`;
      } else {
        const years = Math.floor(avgMonths / 12);
        const remainingMonths = avgMonths % 12;
        averageTenureEl.textContent =
          remainingMonths > 0
            ? `${years}y ${remainingMonths}m`
            : `${years} year${years !== 1 ? "s" : ""}`;
      }
    } else {
      averageTenureEl.textContent = "--";
    }
  }
}

// Update live metrics in quick actions bar
function updateQuickMetrics() {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const activeUsers = appState.users.filter((u) => u.status === "active");
  const inactiveUsers = appState.users.filter((u) => u.status === "inactive");

  const onShiftUsers = activeUsers.filter((u) => {
    if (!u.shiftStart) return false;
    const [hours, minutes] = u.shiftStart.split(":").map(Number);
    const shiftTime = hours * 60 + minutes;
    return currentTime >= shiftTime;
  });

  const offShiftUsers = activeUsers.filter((u) => {
    if (!u.shiftStart) return false;
    const [hours, minutes] = u.shiftStart.split(":").map(Number);
    const shiftTime = hours * 60 + minutes;
    return currentTime < shiftTime;
  });

  // For absent and on leave, you can add logic based on attendance data
  // For now, using placeholder counts of 0
  const absentCount = 0;
  const onLeaveCount = 0;

  const activeTodayEl = document.getElementById("active-today-count");
  const onShiftEl = document.getElementById("on-shift-count");
  const quickTotalEl = document.getElementById("quick-total-staff");
  const inactiveEl = document.getElementById("inactive-count");
  const offShiftEl = document.getElementById("off-shift-count");
  const absentEl = document.getElementById("absent-count");
  const onLeaveEl = document.getElementById("on-leave-count");

  if (quickTotalEl) quickTotalEl.textContent = appState.users.length;
  if (activeTodayEl) activeTodayEl.textContent = activeUsers.length;
  if (inactiveEl) inactiveEl.textContent = inactiveUsers.length;
  if (onShiftEl) onShiftEl.textContent = onShiftUsers.length;
  if (offShiftEl) offShiftEl.textContent = offShiftUsers.length;
  if (absentEl) absentEl.textContent = absentCount;
  if (onLeaveEl) onLeaveEl.textContent = onLeaveCount;
}

// Attach handlers for search, filters, and add employee button
function attachQuickActionHandlers() {
  const searchInput = document.getElementById("staff-search");
  const permissionFilter = document.getElementById("permission-filter");
  const statusFilter = document.getElementById("status-filter");
  const addEmployeeBtn = document.getElementById("add-employee-btn");

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", filterEmployeeRoster);
  }

  if (permissionFilter && !permissionFilter.dataset.bound) {
    permissionFilter.dataset.bound = "true";
    permissionFilter.addEventListener("change", filterEmployeeRoster);
  }

  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.dataset.bound = "true";
    statusFilter.addEventListener("change", filterEmployeeRoster);
  }

  if (addEmployeeBtn && !addEmployeeBtn.dataset.bound) {
    addEmployeeBtn.dataset.bound = "true";
    addEmployeeBtn.addEventListener("click", openAddEmployeeModal);
  }
}

// Filter employee roster based on search and filters
function filterEmployeeRoster() {
  const searchInput = document.getElementById("staff-search");
  const permissionFilter = document.getElementById("permission-filter");
  const statusFilter = document.getElementById("status-filter");

  const searchTerm = searchInput?.value.toLowerCase() || "";
  const permissionValue = permissionFilter?.value || "";
  const statusValue = statusFilter?.value || "";

  const rosterBody = document
    .getElementById("employee-table")
    ?.querySelector("tbody");
  if (!rosterBody) return;

  const rows = rosterBody.querySelectorAll("tr");

  rows.forEach((row) => {
    const name = row.cells[0]?.textContent.toLowerCase() || "";
    const email = row.cells[1]?.textContent.toLowerCase() || "";
    const role = row.cells[3]?.textContent.toLowerCase() || "";
    const permission = row.cells[4]?.textContent.toLowerCase() || "";
    const status = row.cells[7]?.textContent.toLowerCase() || "";

    const matchesSearch =
      !searchTerm ||
      name.includes(searchTerm) ||
      email.includes(searchTerm) ||
      role.includes(searchTerm);

    const matchesPermission =
      !permissionValue ||
      permission.includes(permissionValue.toLowerCase().replace("_", " "));

    const matchesStatus =
      !statusValue || status.includes(statusValue.toLowerCase());

    row.style.display =
      matchesSearch && matchesPermission && matchesStatus ? "" : "none";
  });
}

// Open modal to add new employee
function openAddEmployeeModal() {
  if (!isAdmin()) {
    alert("Only administrators can add employees.");
    return;
  }

  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0; font-size: 1.5rem; color: #333;">Add New Employee</h3>
        <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #666; line-height: 1;">&times;</button>
      </div>
      <form id="add-employee-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Name *</label>
            <input type="text" name="name" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Email *</label>
            <input type="email" name="email" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Phone</label>
            <input type="text" name="phone" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Password *</label>
            <input type="password" name="password" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Role (Job Title) *</label>
            <input type="text" name="role" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Permission Level *</label>
            <select name="permission" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
              <option value="">Select Permission</option>
              <option value="admin">Admin - Full Access</option>
              <option value="front_staff" selected>Front Staff (Default)</option>
              <option value="kitchen_staff">Kitchen Staff</option>
              <option value="delivery_staff">Delivery Staff</option>
              <option value="inventory_manager">Inventory Manager</option>
            </select>
          </div>
          <div style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Shift Start</label>
            <input type="time" name="shiftStart" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
            <small style="color: #888; font-size: 0.875rem;">Leave empty for admins. Hire date will be set to today automatically.</small>
          </div>
          <div style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Status *</label>
            <select name="status" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="padding: 0.625rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 1rem;">Cancel</button>
          <button type="submit" style="padding: 0.625rem 1.5rem; background: #f6c343; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1rem;">Add Employee</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#add-employee-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const newEmployee = {
      id: "user-" + Date.now(),
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      password: formData.get("password"),
      role: formData.get("role"),
      permission: formData.get("permission"),
      shiftStart: formData.get("shiftStart") || null,
      hireDate: new Date().toISOString().split("T")[0], // Auto-set to today
      status: formData.get("status"),
      createdAt: new Date().toISOString(),
      requirePasswordReset: true,
    };

    if (newEmployee.permission === "admin") {
      newEmployee.shiftStart = null;
    }

    appState.users = appState.users || [];
    appState.users.push(newEmployee);
    saveState();
    modal.remove();
    renderEmployees();

    const toast = document.createElement("div");
    toast.style.cssText =
      "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
    toast.textContent = "Employee added successfully!";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  });

  // Render leave approval list
  renderLeaveApprovals();
}

function renderLeaveApprovals() {
  const leaveList = document.getElementById("leave-approval-list");
  if (!leaveList) return;

  const pendingLeaves = (appState.leaveRequests || []).filter(
    (leave) => leave.status === "pending"
  );

  if (pendingLeaves.length === 0) {
    leaveList.innerHTML =
      '<p style="color: #888; font-size: 0.875rem; text-align: center; padding: 1rem;">No pending requests</p>';
    return;
  }

  leaveList.innerHTML = pendingLeaves
    .map((leave) => {
      const employee = appState.users.find((u) => u.id === leave.employeeId);
      const employeeName = employee ? employee.name : "Unknown";

      return `
      <div style="padding: 0.75rem; border: 1px solid #eee; border-radius: 4px; margin-bottom: 0.5rem; background: white;">
        <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem;">${employeeName}</div>
        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.5rem;">${leave.startDate} to ${leave.endDate}</div>
        ${
          leave.reason
            ? `<div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem; font-style: italic;">"${leave.reason}"</div>`
            : ""
        }
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="approveLeave('${leave.id}')" style="flex: 1; padding: 0.375rem; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">✓ Approve</button>
          <button onclick="rejectLeave('${leave.id}')" style="flex: 1; padding: 0.375rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">✗ Reject</button>
        </div>
      </div>
    `;
    })
    .join("");
}

window.approveLeave = function (leaveId) {
  if (!isAdmin()) {
    alert("Only administrators can approve leave requests.");
    return;
  }

  const leave = appState.leaveRequests.find((l) => l.id === leaveId);
  if (!leave) return;

  const currentUser = getCurrentUser();
  leave.status = "approved";
  leave.approvedBy = currentUser.id;
  leave.approvedAt = new Date().toISOString();

  saveState();
  renderEmployees();
  alert("Leave request approved!");
};

window.rejectLeave = function (leaveId) {
  if (!isAdmin()) {
    alert("Only administrators can reject leave requests.");
    return;
  }

  const leave = appState.leaveRequests.find((l) => l.id === leaveId);
  if (!leave) return;

  const currentUser = getCurrentUser();
  leave.status = "rejected";
  leave.approvedBy = currentUser.id;
  leave.approvedAt = new Date().toISOString();

  saveState();
  renderEmployees();
  alert("Leave request rejected.");
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["employees"] = renderEmployees;

// Edit employee modal with inline styles and permission editing
window.openEditEmployeeModal = function (userId) {
  const user = appState.users.find((u) => u.id === userId);
  if (!user) return;

  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0; font-size: 1.5rem; color: #333;">Edit Employee: ${
          user.name
        }</h3>
        <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #666; line-height: 1;">&times;</button>
      </div>
      <form id="edit-employee-form-${user.id}">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Name *</label>
            <input type="text" name="name" value="${
              user.name
            }" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Email *</label>
            <input type="email" name="email" value="${
              user.email
            }" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Phone</label>
            <input type="text" name="phone" value="${
              user.phone || ""
            }" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Password *</label>
            <input type="password" name="password" value="${
              user.password
            }" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Role (Job Title) *</label>
            <input type="text" name="role" value="${
              user.role
            }" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Permission Level *</label>
            <select name="permission" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
              <option value="admin" ${
                user.permission === "admin" ? "selected" : ""
              }>Admin - Full Access</option>
              <option value="kitchen_staff" ${
                user.permission === "kitchen_staff" ? "selected" : ""
              }>Kitchen Staff</option>
              <option value="front_staff" ${
                user.permission === "front_staff" ? "selected" : ""
              }>Front Staff</option>
              <option value="delivery_staff" ${
                user.permission === "delivery_staff" ? "selected" : ""
              }>Delivery Staff</option>
            </select>
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Shift Start</label>
            <input type="time" name="shiftStart" value="${
              user.shiftStart || ""
            }" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
            <small style="color: #888; font-size: 0.875rem;">Leave empty for admins</small>
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Hire Date</label>
            <input type="date" name="hireDate" value="${
              user.hireDate
                ? new Date(user.hireDate).toISOString().split("T")[0]
                : ""
            }" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Status *</label>
            <select name="status" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
              <option value="active" ${
                user.status === "active" ? "selected" : ""
              }>Active</option>
              <option value="inactive" ${
                user.status === "inactive" ? "selected" : ""
              }>Inactive</option>
            </select>
          </div>
        </div>
        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="padding: 0.625rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 1rem;">Cancel</button>
          <button type="submit" style="padding: 0.625rem 1.5rem; background: #f6c343; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1rem;">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector(`#edit-employee-form-${user.id}`);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    user.name = formData.get("name");
    user.email = formData.get("email");
    user.phone = formData.get("phone");
    user.password = formData.get("password");
    user.role = formData.get("role");
    user.permission = formData.get("permission");
    user.shiftStart = formData.get("shiftStart") || null;
    user.hireDate = formData.get("hireDate");
    user.status = formData.get("status");

    if (user.permission === "admin") {
      user.shiftStart = null;
    }

    saveState();
    modal.remove();
    renderEmployees();

    const toast = document.createElement("div");
    toast.style.cssText =
      "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
    toast.textContent = "Employee updated successfully!";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  });
};

// Custom delete confirmation modal
window.confirmDeleteEmployee = function (userId) {
  const user = appState.users.find((u) => u.id === userId);
  if (!user) return;

  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 60px; height: 60px; background: #ffebee; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center;">
          <span style="color: #f44336; font-size: 2rem;">⚠</span>
        </div>
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Remove Employee?</h3>
        <p style="margin: 0; color: #666; font-size: 1rem;">Are you sure you want to remove <strong>${user.name}</strong> from the roster? This action cannot be undone.</p>
      </div>
      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="padding: 0.625rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 1rem; min-width: 100px;">Cancel</button>
        <button onclick="deleteEmployee('${userId}')" style="padding: 0.625rem 1.5rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1rem; min-width: 100px;">Remove</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

window.deleteEmployee = function (userId) {
  appState.users = appState.users.filter((u) => u.id !== userId);
  saveState();
  const modals = document.querySelectorAll("[style*='position: fixed']");
  modals.forEach((m) => m.remove());
  renderEmployees();

  const toast = document.createElement("div");
  toast.style.cssText =
    "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
  toast.textContent = "Employee removed successfully!";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};
