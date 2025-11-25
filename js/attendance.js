function renderAttendance() {
  const form = document.getElementById("attendance-form");
  const employeeSelect = document.getElementById("attendance-employee");
  const logFilter = document.getElementById("attendance-log-filter");
  const actionSelect = document.getElementById("attendance-action");
  const shiftField = document.getElementById("attendance-shift");
  const shiftGroup = document.getElementById("attendance-shift-group");
  const reasonGroup = document.getElementById("attendance-reason-group");
  const reasonField = document.getElementById("attendance-reason");

  const syncAttendanceFormFields = (actionValue) => {
    const needsReason = attendanceActionRequiresReason(actionValue);
    if (shiftGroup) shiftGroup.classList.toggle("hidden", needsReason);
    if (shiftField) {
      shiftField.disabled = needsReason;
      shiftField.required = !needsReason;
      if (needsReason) shiftField.value = "";
    }
    if (reasonGroup) reasonGroup.classList.toggle("hidden", !needsReason);
    if (reasonField) {
      reasonField.disabled = !needsReason;
      reasonField.required = needsReason;
      if (!needsReason) reasonField.value = "";
    }
  };

  if (actionSelect && !actionSelect.dataset.bound) {
    actionSelect.dataset.bound = "true";
    actionSelect.addEventListener("change", () =>
      syncAttendanceFormFields(actionSelect.value)
    );
  }
  syncAttendanceFormFields(actionSelect?.value || "");
  if (employeeSelect) {
    employeeSelect.innerHTML = "<option value=''>Select employee</option>";
    appState.employees.forEach((employee) => {
      const option = document.createElement("option");
      option.value = employee.id;
      option.textContent = `${employee.name} – ${employee.role}`;
      employeeSelect.appendChild(option);
    });
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isAdmin()) {
        alert("Only administrators can update attendance records.");
        return;
      }
      const data = new FormData(form);
      const employeeId = data.get("employee");
      const action = data.get("action");
      const shift = data.get("shift");
      const reason = (data.get("reason") || "").trim();
      const requiresReason = attendanceActionRequiresReason(action);
      if (!employeeId || !action || (requiresReason ? !reason : !shift)) return;
      appState.attendanceLogs.push({
        id: `att-${Date.now()}`,
        employeeId,
        action,
        timestamp: new Date().toISOString(),
        shift: requiresReason ? "" : shift,
        note: requiresReason ? reason : "",
      });
      saveState();
      form.reset();
      syncAttendanceFormFields(actionSelect?.value || "");
      renderAttendance();
    });
  }

  if (logFilter && !logFilter.dataset.bound) {
    logFilter.dataset.bound = "true";
    logFilter.addEventListener("change", renderAttendance);
  }

  const logFilterValue = logFilter?.value || "all";

  const employeeSnapshots = appState.employees.map((employee) => {
    const snapshot = computeEmployeeStatus(employee);
    const todaysLogs = appState.attendanceLogs
      .filter(
        (log) =>
          log.employeeId === employee.id && log.timestamp.startsWith(todayKey())
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const latestLog = todaysLogs[todaysLogs.length - 1];
    const latestAction = latestLog ? latestLog.action : null;
    return {
      employee,
      status: snapshot.status,
      timestamp: snapshot.timestamp,
      latestAction,
    };
  });

  const summary = employeeSnapshots.reduce(
    (acc, snap) => {
      acc[snap.status] = (acc[snap.status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0 }
  );

  ["attendance-present", "attendance-late", "attendance-absent"].forEach(
    (id, idx) => {
      const value = [summary.present, summary.late, summary.absent][idx];
      const node = document.getElementById(id);
      if (node) node.textContent = `${value} staff`;
    }
  );

  const boardBody = document.querySelector("#attendance-status-table tbody");
  if (boardBody) {
    boardBody.innerHTML = "";
    employeeSnapshots.forEach(
      ({ employee, status, timestamp, latestAction }) => {
        const row = document.createElement("tr");
        let displayLabel = "";
        if (latestAction === "in") {
          displayLabel = "Clocked in";
          if (status === "late") displayLabel += " — Late";
        } else if (latestAction === "out") {
          displayLabel = "Clocked out";
        } else {
          displayLabel = status.charAt(0).toUpperCase() + status.slice(1);
        }
        const cssClass = status || "absent";
        row.innerHTML = `
        <td>
          <strong>${employee.name}</strong>
          <small>${employee.role}</small>
        </td>
        <td><span class="status ${cssClass}">${displayLabel}</span></td>
        <td>${timestamp}</td>
      `;
        boardBody.appendChild(row);
      }
    );
  }

  const logBody = document.querySelector("#attendance-log-table tbody");
  if (logBody) {
    logBody.innerHTML = "";
    const filteredLogs = getTodaysLogs()
      .filter((log) => {
        if (logFilterValue === "all") return true;
        const shift = (log.shift || "").toLowerCase();
        if (!shift) return false;
        return logFilterValue === "morning"
          ? shift.includes("morning")
          : shift.includes("afternoon");
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    filteredLogs.forEach((log) => {
      const employee = getEmployee(log.employeeId);
      const actionMeta = getAttendanceActionMeta(log.action);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${employee?.name || "Unknown"}</td>
        <td><span class="status ${actionMeta.badge}">${
        actionMeta.label
      }</span></td>
        <td>${formatTime(log.timestamp)}</td>
        <td>${log.shift || log.note || ""}</td>
      `;
      logBody.appendChild(row);
    });
    if (!logBody.children.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4" class="empty-state">No logs recorded for today yet.</td>`;
      logBody.appendChild(row);
    }
  }

  const alerts = document.getElementById("attendance-alerts");
  if (alerts) {
    alerts.innerHTML = "";
    const lateTeam = employeeSnapshots.filter((snap) => snap.status === "late");
    const absentTeam = employeeSnapshots.filter(
      (snap) => snap.status === "absent"
    );
    const alertEntries = [];
    if (lateTeam.length)
      alertEntries.push({
        title: `${lateTeam.length} late ${
          lateTeam.length === 1 ? "arrival" : "arrivals"
        }`,
        detail: `${lateTeam
          .slice(0, 3)
          .map((snap) => snap.employee.name)
          .join(", ")}${
          lateTeam.length > 3 ? ` +${lateTeam.length - 3} more` : ""
        }`,
        badge: "warning",
      });
    if (absentTeam.length)
      alertEntries.push({
        title: `${absentTeam.length} not clocked in`,
        detail: `${absentTeam
          .slice(0, 3)
          .map((snap) => `${snap.employee.name} (${snap.employee.shiftStart})`)
          .join(", ")}${
          absentTeam.length > 3 ? ` +${absentTeam.length - 3} more` : ""
        }`,
        badge: "alert",
      });
    if (!alertEntries.length)
      alertEntries.push({
        title: "All clear",
        detail: "Everyone is accounted for today.",
        badge: "good",
      });
    alertEntries.forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `
      <div>
        <strong>${entry.title}</strong>
        <p>${entry.detail}</p>
      </div>
      <span class="alert-badge ${entry.badge}">${
        entry.badge === "good"
          ? "Good"
          : entry.badge === "alert"
          ? "Alert"
          : "Watch"
      }</span>
    `;
      alerts.appendChild(li);
    });
  }
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["attendance"] = renderAttendance;
