function renderUserAccess() {
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

    const accessLabel = (user.permission || "kitchen_staff").replace("_", " ");
    const accessClass = user.permission === "admin" ? "chip-primary" : "chip";

    row.innerHTML = `
      <td><strong>${user.name}</strong></td>
      <td>${user.email}</td>
      <td><span class="${accessClass}">${accessLabel}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editUserAccess('${
          user.id
        }')" ${
      !isAdminOrManager() ? "disabled" : ""
    } style="margin-right: 0.5rem;">Edit</button>
        <button class="btn btn-outline btn-sm" onclick="saveUserRole('${
          user.id
        }')" ${
      !isAdminOrManager() ? "disabled" : ""
    } style="display: none;">Save</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.editUserAccess = function (userId) {
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
      <form id="edit-user-access-form">
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
            <label>Access Level</label>
            <select name="permission" required>
              <option value="admin" ${
                user.permission === "admin" ? "selected" : ""
              }>Admin - Full Access</option>
              <option value="manager" ${
                user.permission === "manager" ? "selected" : ""
              }>Manager - Employee Management</option>
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

  const form = modal.querySelector("#edit-user-access-form");
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

    // Save to database using individual endpoint
    (async () => {
      try {
        const apiBase = window.API_BASE_URL || "";
        let response = await fetch(`${apiBase}/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(user),
        });

        // Fallback to bulk save if individual endpoint not available
        if (response.status === 404) {
          const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(appState),
          });
        }

        if (!response.ok) {
          throw new Error("Failed to update user");
        }

        modal.remove();
        renderUserPermissions();
        renderEmployees();
        alert("User updated successfully!");
      } catch (error) {
        console.error("Error updating user:", error);
        alert("Failed to update user");
      }
    })();
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
  // Render user access table
  renderUserAccess();

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
      if (!isAdminOrManager()) {
        alert("Only administrators and managers can add employees.");
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
    const sorted = [...appState.users]
      .filter((u) => !u.archived)
      .sort((a, b) => a.name.localeCompare(b.name));
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
        const accessLabel = (employee.permission || "kitchen_staff").replace(
          "_",
          " "
        );
        row.innerHTML = `
        <td><strong>${employee.name}</strong></td>
        <td>${employee.email || "--"}</td>
        <td>${employee.phone || "--"}</td>
        <td>${employee.role}</td>
        <td><span class="chip">${accessLabel}</span></td>
        <td>${employee.shiftStart || "--"}</td>
        <td>${hireDate}</td>
        <td><span class="chip ${
          employee.status === "active" ? "chip-success" : "chip-warning"
        }">${employee.status || "active"}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openEditEmployeeModal('${
            employee.id
          }')" data-role="admin,manager" style="margin-right: 0.5rem;">Edit</button>
          <button class="btn btn-warning btn-sm" onclick="confirmArchiveEmployee('${
            employee.id
          }')" data-role="admin,manager">Archive</button>
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
        if (!isAdminOrManager()) {
          alert("Only administrators and managers can remove employees.");
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
        if (!isAdminOrManager()) {
          alert("Only administrators and managers can edit employees.");
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
              <label>Access</label>
              <select name="permission" required>
                <option value="admin" ${
                  user.permission === "admin" ? "selected" : ""
                }>Admin - Full Access</option>
                <option value="manager" ${
                  user.permission === "manager" ? "selected" : ""
                }>Manager</option>
                <option value="kitchen_staff" ${
                  user.permission === "kitchen_staff" ? "selected" : ""
                }>Kitchen Staff</option>
                <option value="staff" ${
                  user.permission === "staff" ||
                  user.permission === "front_staff" ||
                  user.permission === "delivery_staff"
                    ? "selected"
                    : ""
                }>Staff</option>
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
    form.addEventListener("submit", async (e) => {
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

      // Save to database immediately using individual endpoint
      try {
        const apiBase = window.API_BASE_URL || "";
        const response = await fetch(`${apiBase}/api/users/${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(user),
        });

        if (!response.ok) {
          throw new Error("Failed to save user");
        }
      } catch (error) {
        console.error("Error saving user to database:", error);
        alert("Failed to save changes");
        return;
      }

      modal.remove();
      renderEmployees();
      alert("Employee updated successfully!");
    });
  };

  attachRemovalHandlers();
  updateQuickMetrics();
  attachQuickActionHandlers();

  // Render leave/request approvals
  renderLeaveApprovals();
}

// Update team overview with access distribution and stats
function updateTeamOverview() {
  const users = appState.users || [];
  const total = users.length;

  if (total === 0) return;

  // Count by access level
  const accessCounts = {
    admin: users.filter((u) => u.permission === "admin").length,
    manager: users.filter((u) => u.permission === "manager").length,
    kitchen_staff: users.filter((u) => u.permission === "kitchen_staff").length,
    staff: users.filter(
      (u) =>
        u.permission === "staff" ||
        u.permission === "front_staff" ||
        u.permission === "delivery_staff"
    ).length,
  };

  // Update access bar widths and labels
  const adminBar = document.getElementById("access-bar-admin");
  const managerBar = document.getElementById("access-bar-manager");
  const kitchenBar = document.getElementById("access-bar-kitchen");
  const staffBar = document.getElementById("access-bar-staff");

  const adminPct = (accessCounts.admin / total) * 100;
  const managerPct = (accessCounts.manager / total) * 100;
  const kitchenPct = (accessCounts.kitchen_staff / total) * 100;
  const staffPct = (accessCounts.staff / total) * 100;

  if (adminBar) {
    adminBar.style.width = `${adminPct}%`;
    adminBar.textContent = accessCounts.admin > 0 ? accessCounts.admin : "";
    adminBar.style.display = adminPct === 0 ? "none" : "flex";
  }
  if (managerBar) {
    managerBar.style.width = `${managerPct}%`;
    managerBar.textContent =
      accessCounts.manager > 0 ? accessCounts.manager : "";
    managerBar.style.display = managerPct === 0 ? "none" : "flex";
  }
  if (kitchenBar) {
    kitchenBar.style.width = `${kitchenPct}%`;
    kitchenBar.textContent =
      accessCounts.kitchen_staff > 0 ? accessCounts.kitchen_staff : "";
    kitchenBar.style.display = kitchenPct === 0 ? "none" : "flex";
  }
  if (staffBar) {
    staffBar.style.width = `${staffPct}%`;
    staffBar.textContent = accessCounts.staff > 0 ? accessCounts.staff : "";
    staffBar.style.display = staffPct === 0 ? "none" : "flex";
  }

  // Update legend
  const adminLegend = document.getElementById("access-legend-admin");
  const managerLegend = document.getElementById("access-legend-manager");
  const kitchenLegend = document.getElementById("access-legend-kitchen");
  const staffLegend = document.getElementById("access-legend-staff");

  if (adminLegend) adminLegend.textContent = `${accessCounts.admin} Admin`;
  if (managerLegend)
    managerLegend.textContent = `${accessCounts.manager} Manager`;
  if (kitchenLegend)
    kitchenLegend.textContent = `${accessCounts.kitchen_staff} Kitchen`;
  if (staffLegend) staffLegend.textContent = `${accessCounts.staff} Staff`;

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

  const activeUsers = appState.users.filter(
    (u) => u.status === "active" && !u.archived
  );
  const inactiveUsers = appState.users.filter(
    (u) => u.status === "inactive" && !u.archived
  );

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

  // Count employees on leave today
  const onLeaveCount = activeUsers.filter((u) => {
    const status = computeEmployeeStatus(u);
    return status.status === "on-leave";
  }).length;

  // For absent count, use placeholder for now
  const absentCount = 0;

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
  const accessFilter = document.getElementById("access-filter");
  const statusFilter = document.getElementById("status-filter");
  const addEmployeeBtn = document.getElementById("add-employee-btn");

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", filterEmployeeRoster);
  }

  if (accessFilter && !accessFilter.dataset.bound) {
    accessFilter.dataset.bound = "true";
    accessFilter.addEventListener("change", filterEmployeeRoster);
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
  const accessFilter = document.getElementById("access-filter");
  const statusFilter = document.getElementById("status-filter");

  const searchTerm = searchInput?.value.toLowerCase() || "";
  const accessValue = accessFilter?.value || "";
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
    const access = row.cells[4]?.textContent.toLowerCase() || "";
    const status = row.cells[7]?.textContent.toLowerCase() || "";

    const matchesSearch =
      !searchTerm ||
      name.includes(searchTerm) ||
      email.includes(searchTerm) ||
      role.includes(searchTerm);

    const matchesAccess =
      !accessValue ||
      access.includes(accessValue.toLowerCase().replace("_", " "));

    const matchesStatus =
      !statusValue || status.includes(statusValue.toLowerCase());

    row.style.display =
      matchesSearch && matchesAccess && matchesStatus ? "" : "none";
  });
}

// Open modal to add new employee
function openAddEmployeeModal() {
  if (!isAdminOrManager()) {
    alert("Only administrators and managers can add employees.");
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
            <input type="text" name="phone" id="add-phone-input" placeholder="09XXXXXXXXX" maxlength="13" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
            <small style="color: #888; font-size: 0.875rem;">11 digits, spaces allowed (e.g., 09XX XXX XXXX)</small>
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
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Access Level *</label>
            <select name="permission" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
              <option value="">Select Access Level</option>
              <option value="admin">Admin - Full Access</option>
              <option value="manager">Manager</option>
              <option value="kitchen_staff">Kitchen Staff</option>
              <option value="staff" selected>Staff (Default)</option>
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

    // Validate phone number
    const phone = formData.get("phone");
    if (phone) {
      const digitsOnly = phone.replace(/\s/g, "");
      if (!/^\d+$/.test(digitsOnly)) {
        alert("Phone number must contain only digits and spaces");
        return;
      }
      if (digitsOnly.length !== 11) {
        alert("Phone number must be exactly 11 digits (excluding spaces)");
        return;
      }
    }

    const newEmployee = {
      id: "user-" + Date.now(),
      name: formData.get("name"),
      email: formData.get("email"),
      phone: phone,
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

    // Save to database using individual endpoint
    (async () => {
      try {
        const apiBase = window.API_BASE_URL || "";
        let response = await fetch(`${apiBase}/api/users/${newEmployee.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(newEmployee),
        });

        // Fallback to bulk save if individual endpoint not available
        if (response.status === 404) {
          const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(appState),
          });
        }

        if (!response.ok) {
          throw new Error("Failed to add employee");
        }

        modal.remove();
        renderEmployees();

        const toast = document.createElement("div");
        toast.style.cssText =
          "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
        toast.textContent = "Employee added successfully!";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } catch (error) {
        console.error("Error adding employee:", error);
        alert("Failed to add employee");
      }
    })();
  });
}

// Current request index for navigation
let currentRequestIndex = 0;

function renderLeaveApprovals() {
  const leaveList = document.getElementById("leave-approval-list");
  if (!leaveList) {
    console.log("❌ Leave approval list element not found");
    return;
  }

  console.log("📋 Total requests:", appState.requests?.length || 0);
  console.log("🔍 Requests data:", JSON.stringify(appState.requests, null, 2));

  const pendingRequests = (appState.requests || []).filter((request) => {
    console.log("Checking request:", request, "Status:", request.status);
    return request.status === "pending";
  });

  // Sort by oldest first (ascending by requestedAt date)
  pendingRequests.sort((a, b) => {
    const dateA = new Date(a.requestedAt || a.requested_at || 0);
    const dateB = new Date(b.requestedAt || b.requested_at || 0);
    return dateA - dateB;
  });

  console.log("⏳ Pending requests:", pendingRequests.length);
  console.log(
    "🔍 Pending requests data:",
    JSON.stringify(pendingRequests, null, 2)
  );

  if (pendingRequests.length === 0) {
    leaveList.innerHTML =
      '<p style="color: #888; font-size: 0.875rem; text-align: center; padding: 1rem;">No pending requests</p>';
    return;
  }

  // Ensure current index is within bounds
  if (currentRequestIndex >= pendingRequests.length) {
    currentRequestIndex = 0;
  }

  const request = pendingRequests[currentRequestIndex];
  const empId = request.employeeId || request.employee_id;
  const employee = appState.users.find((u) => u.id === empId);
  const employeeName = employee ? employee.name : "Unknown";
  const requestType = request.requestType || request.request_type || "leave";

  let requestContent = "";

  if (requestType === "profile_edit") {
    // Profile edit request
    let changes = request.requestedChanges || request.requested_changes || {};

    console.log("Raw requestedChanges:", changes);
    console.log("Type of requestedChanges:", typeof changes);

    // Handle double-encoded JSON strings
    if (typeof changes === "string") {
      try {
        changes = JSON.parse(changes);
        console.log("After first parse:", changes, typeof changes);

        // Check if it's still a string (double-encoded)
        if (typeof changes === "string") {
          changes = JSON.parse(changes);
          console.log("After second parse:", changes, typeof changes);
        }
      } catch (e) {
        console.error("Failed to parse requestedChanges:", e);
        console.error("Original value:", request.requestedChanges);
        changes = {};
      }
    }

    console.log("Final parsed changes:", changes);

    // Field label mapping for better display
    const fieldLabels = {
      name: "Name",
      email: "Email",
      phone: "Phone",
      role: "Role",
      shiftStart: "Shift Start",
    };

    const changesList = Object.entries(changes)
      .filter(([key, value]) => value && key !== "password")
      .map(([key, value]) => {
        const label =
          fieldLabels[key] ||
          key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");

        // Try different property name variations to find current value
        let currentValue = "N/A";
        if (employee) {
          const variants = [
            key,
            key.toLowerCase(),
            key.replace(/([A-Z])/g, "_$1").toLowerCase(),
            key === "shiftStart" ? "shift_start" : key,
          ];

          for (const variant of variants) {
            if (employee[variant] !== undefined && employee[variant] !== null) {
              currentValue = employee[variant];
              break;
            }
          }
        }

        return `<div style="font-size: 0.7rem; margin: 0.15rem 0; line-height: 1.3;"><strong style="font-size: 0.75rem;">${label}:</strong> ${currentValue} → ${value}</div>`;
      })
      .join("");

    requestContent = `
      <div style="padding: 0.75rem; border: 1px solid #2196F3; border-radius: 4px; background: #e3f2fd;">
        <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; color: #1565C0;">${employeeName} - Profile Edit</div>
        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.5rem;">
          ${changesList}
          ${
            changes.password
              ? '<div style="font-size: 0.75rem; margin: 0.25rem 0;"><strong>Password:</strong> [Updated]</div>'
              : ""
          }
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button data-profile-id="${
            request.id
          }" class="approve-profile-btn" style="flex: 1; padding: 0.375rem; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">✓ Approve</button>
          <button data-profile-id="${
            request.id
          }" class="reject-profile-btn" style="flex: 1; padding: 0.375rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">✗ Reject</button>
        </div>
      </div>
    `;
  } else {
    // Leave request
    const startDate = request.startDate || request.start_date;
    const endDate = request.endDate || request.end_date;
    const reason = (request.reason || "")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    requestContent = `
      <div style="padding: 0.75rem; border: 1px solid #eee; border-radius: 4px; background: white;">
        <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem;">${employeeName} - Leave</div>
        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.5rem;">${startDate} to ${endDate}</div>
        ${
          request.reason
            ? `<div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem; font-style: italic;">"${reason}"</div>`
            : ""
        }
        <div style="display: flex; gap: 0.5rem;">
          <button data-leave-id="${
            request.id
          }" class="approve-leave-btn" style="flex: 1; padding: 0.375rem; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">✓ Approve</button>
          <button data-leave-id="${
            request.id
          }" class="reject-leave-btn" style="flex: 1; padding: 0.375rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">✗ Reject</button>
        </div>
      </div>
    `;
  }

  // Add navigation controls
  const navigation =
    pendingRequests.length > 1
      ? `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px;">
      <button id="prev-request-btn" style="padding: 0.25rem 0.75rem; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem;" ${
        currentRequestIndex === 0
          ? 'disabled style="opacity: 0.5; cursor: not-allowed;"'
          : ""
      }>← Previous</button>
      <span style="font-size: 0.875rem; color: #666;">Request ${
        currentRequestIndex + 1
      } of ${pendingRequests.length}</span>
      <button id="next-request-btn" style="padding: 0.25rem 0.75rem; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem;" ${
        currentRequestIndex >= pendingRequests.length - 1
          ? 'disabled style="opacity: 0.5; cursor: not-allowed;"'
          : ""
      }>Next →</button>
    </div>
  `
      : "";

  leaveList.innerHTML = requestContent + navigation;

  // Add event listeners for buttons
  setTimeout(() => {
    // Leave request buttons
    document.querySelectorAll(".approve-leave-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        window.approveLeave(this.dataset.leaveId);
      });
    });
    document.querySelectorAll(".reject-leave-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        window.rejectLeave(this.dataset.leaveId);
      });
    });

    // Profile edit buttons
    document.querySelectorAll(".approve-profile-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        window.approveProfileEdit(this.dataset.profileId);
      });
    });
    document.querySelectorAll(".reject-profile-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        window.rejectProfileEdit(this.dataset.profileId);
      });
    });

    // Navigation buttons
    const prevBtn = document.getElementById("prev-request-btn");
    const nextBtn = document.getElementById("next-request-btn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentRequestIndex > 0) {
          currentRequestIndex--;
          renderLeaveApprovals();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (currentRequestIndex < pendingRequests.length - 1) {
          currentRequestIndex++;
          renderLeaveApprovals();
        }
      });
    }
  });
}

window.approveLeave = function (leaveId) {
  if (!isAdminOrManager()) {
    alert("Only administrators and managers can approve requests.");
    return;
  }

  const leave = appState.requests.find((l) => l.id === leaveId);
  if (!leave) return;

  const currentUser = getCurrentUser();
  leave.status = "approved";
  leave.reviewedBy = currentUser.id;
  leave.reviewedAt = new Date().toISOString();

  // Save to database
  const endpoint =
    window.APP_STATE_ENDPOINT || "http://localhost:5000/api/state";
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appState),
  })
    .then(() => {
      console.log("✅ Leave request approved and saved to database");
    })
    .catch((err) => {
      console.error("❌ Error saving to database:", err);
    });

  renderEmployees();

  // Show custom success popup
  const popup = document.createElement("div");
  popup.style.cssText =
    "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center; min-width: 300px;";
  popup.innerHTML = `
    <div style="font-size: 3rem; color: #4caf50; margin-bottom: 1rem;">✓</div>
    <h3 style="margin: 0 0 0.5rem 0; color: #333;">Request Approved!</h3>
    <p style="margin: 0; color: #666;">The request has been approved successfully.</p>
    <button class="popup-close-btn" style="margin-top: 1.5rem; padding: 0.5rem 2rem; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">OK</button>
  `;
  document.body.appendChild(popup);
  popup
    .querySelector(".popup-close-btn")
    .addEventListener("click", () => popup.remove());
  setTimeout(() => popup.remove(), 3000);
};

window.rejectLeave = function (leaveId) {
  if (!isAdminOrManager()) {
    alert("Only administrators and managers can reject requests.");
    return;
  }

  const leave = appState.requests.find((l) => l.id === leaveId);
  if (!leave) return;

  const currentUser = getCurrentUser();
  leave.status = "rejected";
  leave.reviewedBy = currentUser.id;
  leave.reviewedAt = new Date().toISOString();

  // Save to database
  const endpoint =
    window.APP_STATE_ENDPOINT || "http://localhost:5000/api/state";
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appState),
  })
    .then(() => {
      console.log("✅ Leave request rejected and saved to database");
    })
    .catch((err) => {
      console.error("❌ Error saving to database:", err);
    });

  renderEmployees();

  // Show custom rejection popup
  const popup = document.createElement("div");
  popup.style.cssText =
    "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center; min-width: 300px;";
  popup.innerHTML = `
    <div style="font-size: 3rem; color: #f44336; margin-bottom: 1rem;">✗</div>
    <h3 style="margin: 0 0 0.5rem 0; color: #333;">Request Rejected</h3>
    <p style="margin: 0; color: #666;">The request has been rejected.</p>
    <button class="popup-close-btn" style="margin-top: 1.5rem; padding: 0.5rem 2rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">OK</button>
  `;
  document.body.appendChild(popup);
  popup
    .querySelector(".popup-close-btn")
    .addEventListener("click", () => popup.remove());
  setTimeout(() => popup.remove(), 3000);
};

window.approveProfileEdit = function (requestId) {
  if (!isAdminOrManager()) {
    alert(
      "Only administrators and managers can approve profile edit requests."
    );
    return;
  }

  const request = appState.requests.find((r) => r.id === requestId);
  if (
    !request ||
    (request.requestType !== "profile_edit" &&
      request.request_type !== "profile_edit")
  ) {
    alert("Profile edit request not found.");
    return;
  }

  // Find the employee
  const empId = request.employeeId || request.employee_id;
  const employee = appState.users.find((u) => u.id === empId);
  if (!employee) {
    alert("Employee not found.");
    return;
  }

  // Apply the requested changes
  let changes = request.requestedChanges || request.requested_changes || {};

  // Handle double-encoded JSON strings
  if (typeof changes === "string") {
    try {
      changes = JSON.parse(changes);
      // Check if it's still a string (double-encoded)
      if (typeof changes === "string") {
        changes = JSON.parse(changes);
      }
    } catch (e) {
      console.error("Failed to parse requestedChanges:", e);
      alert("Error parsing profile changes. Please contact support.");
      return;
    }
  }

  if (changes.name) employee.name = changes.name;
  if (changes.email) employee.email = changes.email;
  if (changes.phone) employee.phone = changes.phone;
  if (changes.role) employee.role = changes.role;
  if (changes.shiftStart) employee.shiftStart = changes.shiftStart;
  if (changes.password) employee.password = changes.password;

  // Update the request status
  const currentUser = getCurrentUser();
  request.status = "approved";
  request.reviewedBy = currentUser.id;
  request.reviewedAt = new Date().toISOString();

  // Save employee changes to database
  const userEndpoint = `${window.API_BASE_URL || ""}/api/users/${employee.id}`;
  const requestEndpoint = `${window.API_BASE_URL || ""}/api/requests/${
    request.id
  }`;

  Promise.all([
    fetch(userEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(employee),
    }),
    fetch(requestEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(request),
    }),
  ])
    .then(() => {
      console.log("✅ Profile edit approved and saved to database");
      renderEmployees();

      // Show custom success popup
      const popup = document.createElement("div");
      popup.style.cssText =
        "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center; min-width: 300px;";
      popup.innerHTML = `
        <div style="font-size: 3rem; color: #4caf50; margin-bottom: 1rem;">✓</div>
        <h3 style="margin: 0 0 0.5rem 0; color: #333;">Profile Edit Approved!</h3>
        <p style="margin: 0; color: #666;">Profile changes have been applied successfully.</p>
        <button class="popup-close-btn" style="margin-top: 1.5rem; padding: 0.5rem 2rem; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">OK</button>
      `;
      document.body.appendChild(popup);
      popup
        .querySelector(".popup-close-btn")
        .addEventListener("click", () => popup.remove());
      setTimeout(() => popup.remove(), 3000);
    })
    .catch((err) => {
      console.error("❌ Error saving to database:", err);
      alert("Failed to save changes to database. Please try again.");
    });
};

window.rejectProfileEdit = function (requestId) {
  if (!isAdminOrManager()) {
    alert("Only administrators and managers can reject profile edit requests.");
    return;
  }

  const request = appState.requests.find((r) => r.id === requestId);
  if (
    !request ||
    (request.requestType !== "profile_edit" &&
      request.request_type !== "profile_edit")
  ) {
    alert("Profile edit request not found.");
    return;
  }

  // Mark request as rejected (no changes applied)
  const currentUser = getCurrentUser();
  request.status = "rejected";
  request.reviewedBy = currentUser.id;
  request.reviewedAt = new Date().toISOString();

  // Save to database
  const requestEndpoint = `${window.API_BASE_URL || ""}/api/requests/${
    request.id
  }`;
  fetch(requestEndpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  })
    .then(() => {
      console.log("✅ Profile edit rejected and saved to database");
      renderEmployees();

      // Show custom rejection popup
      const popup = document.createElement("div");
      popup.style.cssText =
        "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center; min-width: 300px;";
      popup.innerHTML = `
        <div style="font-size: 3rem; color: #f44336; margin-bottom: 1rem;">✗</div>
        <h3 style="margin: 0 0 0.5rem 0; color: #333;">Profile Edit Rejected</h3>
        <p style="margin: 0; color: #666;">The profile edit request has been rejected.</p>
        <button class="popup-close-btn" style="margin-top: 1.5rem; padding: 0.5rem 2rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;">OK</button>
      `;
      document.body.appendChild(popup);
      popup
        .querySelector(".popup-close-btn")
        .addEventListener("click", () => popup.remove());
      setTimeout(() => popup.remove(), 3000);
    })
    .catch((err) => {
      console.error("❌ Error saving to database:", err);
      alert("Failed to save rejection to database. Please try again.");
    });
};

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
            }" placeholder="09XXXXXXXXX" maxlength="13" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
            <small style="color: #888; font-size: 0.875rem;">11 digits, spaces allowed</small>
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
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Access Level *</label>
            <select name="permission" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
              <option value="admin" ${
                user.permission === "admin" ? "selected" : ""
              }>Admin - Full Access</option>
              <option value="manager" ${
                user.permission === "manager" ? "selected" : ""
              }>Manager</option>
              <option value="kitchen_staff" ${
                user.permission === "kitchen_staff" ? "selected" : ""
              }>Kitchen Staff</option>
              <option value="staff" ${
                user.permission === "staff" ||
                user.permission === "front_staff" ||
                user.permission === "delivery_staff"
                  ? "selected"
                  : ""
              }>Staff</option>
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
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    // Validate phone number
    const phone = formData.get("phone");
    if (phone) {
      const digitsOnly = phone.replace(/\s/g, "");
      if (!/^\d+$/.test(digitsOnly)) {
        alert("Phone number must contain only digits and spaces");
        return;
      }
      if (digitsOnly.length !== 11) {
        alert("Phone number must be exactly 11 digits (excluding spaces)");
        return;
      }
    }

    const password = formData.get("password");

    user.name = formData.get("name");
    user.email = formData.get("email");
    user.phone = phone;
    // Only update password if provided
    if (password && password.trim() !== "") {
      user.password = password;
    }
    user.role = formData.get("role");
    user.permission = formData.get("permission");
    user.shiftStart = formData.get("shiftStart") || null;
    user.hireDate = formData.get("hireDate");
    user.status = formData.get("status");

    if (user.permission === "admin") {
      user.shiftStart = null;
    }

    // Ensure createdAt exists for database
    if (!user.createdAt) {
      user.createdAt = new Date().toISOString();
    }

    // Save to database immediately using individual endpoint
    try {
      const apiBase = window.API_BASE_URL || "";
      const response = await fetch(`${apiBase}/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(user),
      });

      if (!response.ok) {
        throw new Error("Failed to save user");
      }
    } catch (error) {
      console.error("Error saving user to database:", error);
      alert("Failed to save changes");
      return;
    }

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

// Custom archive confirmation modal
window.confirmArchiveEmployee = async function (userId) {
  const user = appState.users.find((u) => u.id === userId);
  if (!user) return;

  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 60px; height: 60px; background: #fff3e0; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center;">
          <span style="color: #ff9800; font-size: 2rem;">📦</span>
        </div>
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Archive Employee?</h3>
        <p style="margin: 0; color: #666; font-size: 1rem;">Archive <strong>${user.name}</strong>? This will move them to the archive. They can be restored or permanently deleted from there.</p>
      </div>
      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="padding: 0.625rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 1rem; min-width: 100px;">Cancel</button>
        <button onclick="archiveEmployee('${userId}')" style="padding: 0.625rem 1.5rem; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1rem; min-width: 100px;">Archive</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

window.archiveEmployee = async function (userId) {
  const user = appState.users.find((u) => u.id === userId);
  if (!user) return;

  const currentUser = getCurrentUser();
  user.archived = true;
  user.archivedAt = new Date().toISOString();
  user.archivedBy = currentUser?.id || null;

  // Save to database using individual endpoint
  try {
    const apiBase = window.API_BASE_URL || "";
    let response = await fetch(`${apiBase}/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(user),
    });

    // If individual endpoint not available, fallback to bulk save
    if (response.status === 404) {
      const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(appState),
      });
    }

    if (!response.ok) {
      throw new Error("Failed to archive user");
    }
  } catch (error) {
    console.error("Error archiving employee:", error);
    alert("Failed to archive employee");
    return;
  }

  const modals = document.querySelectorAll("[style*='position: fixed']");
  modals.forEach((m) => m.remove());
  renderEmployees();

  const toast = document.createElement("div");
  toast.style.cssText =
    "position: fixed; top: 20px; right: 20px; background: #ff9800; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
  toast.textContent = "Employee archived successfully";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

// Legacy delete function (kept for backward compatibility)
window.confirmDeleteEmployee = function (userId) {
  confirmArchiveEmployee(userId);
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

// Add Access Modal Handler
document.addEventListener("DOMContentLoaded", () => {
  const addAccessBtn = document.getElementById("add-access-btn");
  const addAccessModal = document.getElementById("add-access-modal");
  const addAccessForm = document.getElementById("add-access-form");
  const addAccessClose = document.getElementById("add-access-close");
  const addAccessCancel = document.getElementById("add-access-cancel");

  if (addAccessBtn) {
    addAccessBtn.addEventListener("click", () => {
      if (!isAdmin()) {
        alert("Only administrators can create new access levels.");
        return;
      }
      addAccessModal.classList.add("active");
    });
  }

  // Close button handler
  if (addAccessClose) {
    addAccessClose.addEventListener("click", () => {
      addAccessModal.classList.remove("active");
      addAccessForm.reset();
    });
  }

  // Cancel button handler
  if (addAccessCancel) {
    addAccessCancel.addEventListener("click", () => {
      addAccessModal.classList.remove("active");
      addAccessForm.reset();
    });
  }

  if (addAccessForm) {
    addAccessForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(addAccessForm);

      const accessName = formData.get("accessName").trim();
      const description = formData.get("description").trim();
      const selectedPages = formData.getAll("pages");

      if (selectedPages.length === 0) {
        alert("Please select at least one page for this access level.");
        return;
      }

      // Store the new access level configuration
      if (!appState.accessLevels) {
        appState.accessLevels = [];
      }

      const newAccessLevel = {
        id: `access-${Date.now()}`,
        name: accessName,
        description: description,
        pages: selectedPages,
        createdAt: new Date().toISOString(),
      };

      appState.accessLevels.push(newAccessLevel);
      saveState();

      // Close modal and reset form
      addAccessModal.classList.remove("active");
      addAccessForm.reset();

      // Show success message
      const toast = document.createElement("div");
      toast.style.cssText =
        "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
      toast.textContent = `Access level "${accessName}" created successfully!`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      // Optionally refresh the view
      renderEmployees();
    });
  }
});
