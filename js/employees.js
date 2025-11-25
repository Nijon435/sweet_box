function renderEmployees() {
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
    [
      ...new Set(appState.employees.map((emp) => emp.role).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

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
      appState.employees.push({
        id: `emp-${Date.now()}`,
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

  const totalStaff = appState.employees.length;
  const roles = uniqueRoles();
  const earliestShift = appState.employees.reduce((min, emp) => {
    if (!emp.shiftStart) return min;
    if (!min) return emp.shiftStart;
    return emp.shiftStart < min ? emp.shiftStart : min;
  }, "");
  if (totalNode) totalNode.textContent = totalStaff;
  if (rolesNode) rolesNode.textContent = roles.length;
  if (earliestNode) earliestNode.textContent = earliestShift || "--:--";
  if (roleList) {
    roleList.innerHTML = roles.length
      ? roles.map((role) => `<span class="chip">${role}</span>`).join("")
      : '<span class="chip">No roles yet</span>';
  }

  if (rosterBody) {
    rosterBody.innerHTML = "";
    const sorted = [...appState.employees].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    if (!sorted.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4" class="empty-state">No employees registered yet.</td>`;
      rosterBody.appendChild(row);
    } else {
      sorted.forEach((employee) => {
        const row = document.createElement("tr");
        row.innerHTML = `
        <td><strong>${employee.name}</strong></td>
        <td>${employee.role}</td>
        <td>${employee.shiftStart}</td>
        <td><button class="btn btn-outline" data-delete-employee="${employee.id}" data-role="admin">Remove</button></td>
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
        const target = appState.employees.find((emp) => emp.id === id);
        if (!target) return;
        const confirmed = confirm(`Remove ${target.name} from the roster?`);
        if (!confirmed) return;
        appState.employees = appState.employees.filter((emp) => emp.id !== id);
        saveState();
        renderEmployees();
      });
    });
  };

  attachRemovalHandlers();
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["employees"] = renderEmployees;
