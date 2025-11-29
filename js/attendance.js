function renderAttendance() {
  const currentUser = getCurrentUser();
  const clockInBtn = document.getElementById("clock-in-btn");
  const clockOutBtn = document.getElementById("clock-out-btn");
  const currentUserName = document.getElementById("current-user-name");
  const lastActionDisplay = document.getElementById("last-action-display");
  const logFilter = document.getElementById("attendance-log-filter");

  // Display current user
  if (currentUserName && currentUser) {
    currentUserName.textContent = `${currentUser.name} (${currentUser.role})`;
  }

  // Get today's logs for current user
  const userTodayLogs = getTodaysLogs().filter(
    (log) => log.employeeId === currentUser.id
  );
  const lastLog =
    userTodayLogs.length > 0 ? userTodayLogs[userTodayLogs.length - 1] : null;

  // Display last action
  if (lastActionDisplay && lastLog) {
    lastActionDisplay.textContent = `Last action: ${
      lastLog.action === "in" ? "Clocked In" : "Clocked Out"
    } at ${formatTime(lastLog.timestamp)}`;
  } else if (lastActionDisplay) {
    lastActionDisplay.textContent = "No clock actions today";
  }

  // Check if user is late (if they have a shift start time and haven't clocked in yet)
  function isUserLate(user) {
    if (!user.shiftStart) return false;

    const now = new Date();
    const [hours, minutes] = user.shiftStart.split(":");
    const shiftTime = new Date();
    shiftTime.setHours(parseInt(hours), parseInt(minutes), 0);

    // If current time is more than 15 minutes past shift start
    const lateThreshold = new Date(shiftTime.getTime() + 15 * 60000);
    return now > lateThreshold;
  }

  // Clock In Handler
  if (clockInBtn && !clockInBtn.dataset.bound) {
    clockInBtn.dataset.bound = "true";
    clockInBtn.addEventListener("click", async () => {
      if (lastLog && lastLog.action === "in") {
        alert("You've already clocked in today. Please clock out first.");
        return;
      }

      const isLate = isUserLate(currentUser);
      let note = "";

      // Show note popup if late
      if (isLate) {
        note = await showLateNoteDialog();
        if (note === null) return; // User cancelled
      }

      // Determine shift based on time
      const currentHour = new Date().getHours();
      const shift =
        currentHour < 12 ? "Morning (7AM–12PM)" : "Afternoon (12PM–5PM)";

      // Create attendance log
      const newLog = {
        id: `att-${Date.now()}`,
        employeeId: currentUser.id,
        action: "in",
        timestamp: new Date().toISOString(),
        shift: shift,
        note: note || null,
      };

      appState.attendanceLogs.push(newLog);
      await saveState();

      alert(
        isLate
          ? "Clocked in (Late) - Note recorded"
          : "Clocked in successfully!"
      );
      renderAttendance();
    });
  }

  // Clock Out Handler
  if (clockOutBtn && !clockOutBtn.dataset.bound) {
    clockOutBtn.dataset.bound = "true";
    clockOutBtn.addEventListener("click", async () => {
      if (!lastLog || lastLog.action === "out") {
        alert("You need to clock in first before clocking out.");
        return;
      }

      const currentHour = new Date().getHours();
      const shift =
        currentHour < 12 ? "Morning (7AM–12PM)" : "Afternoon (12PM–5PM)";

      // Create attendance log
      const newLog = {
        id: `att-${Date.now()}`,
        employeeId: currentUser.id,
        action: "out",
        timestamp: new Date().toISOString(),
        shift: shift,
        note: null,
      };

      appState.attendanceLogs.push(newLog);
      await saveState();

      alert("Clocked out successfully!");
      renderAttendance();
    });
  }

  // Show late note dialog
  function showLateNoteDialog() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText =
        "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

      modal.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
          <h3 style="margin: 0 0 1rem 0; color: #f59e0b;">⚠️ Late Arrival</h3>
          <p style="margin-bottom: 1rem; color: #666;">You're arriving late. Would you like to add a note explaining why?</p>
          <textarea id="late-note-input" placeholder="Optional: Reason for late arrival..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; min-height: 80px; margin-bottom: 1rem;"></textarea>
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="cancel-late-btn" style="padding: 0.625rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="skip-note-btn" style="padding: 0.625rem 1.5rem; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">Skip Note</button>
            <button id="submit-note-btn" style="padding: 0.625rem 1.5rem; background: #f6c343; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">Clock In</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const noteInput = modal.querySelector("#late-note-input");
      const cancelBtn = modal.querySelector("#cancel-late-btn");
      const skipBtn = modal.querySelector("#skip-note-btn");
      const submitBtn = modal.querySelector("#submit-note-btn");

      cancelBtn.onclick = () => {
        modal.remove();
        resolve(null);
      };

      skipBtn.onclick = () => {
        modal.remove();
        resolve("");
      };

      submitBtn.onclick = () => {
        const note = noteInput.value.trim();
        modal.remove();
        resolve(note);
      };
    });
  }

  // Log filter handler
  if (logFilter && !logFilter.dataset.bound) {
    logFilter.dataset.bound = "true";
    logFilter.addEventListener("change", renderAttendance);
  }

  const logFilterValue = logFilter?.value || "all";

  const employeeSnapshots = appState.users
    .filter((user) => user.permission !== "admin")
    .map((employee) => {
      const snapshot = computeEmployeeStatus(employee);
      const todaysLogs = appState.attendanceLogs
        .filter(
          (log) =>
            log.employeeId === employee.id &&
            log.timestamp.startsWith(todayKey())
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
