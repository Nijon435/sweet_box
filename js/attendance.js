// Pagination state for attendance logs
let attendanceCurrentPage = 1;
const attendanceItemsPerPage = 20;

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
      // Recalculate lastLog with fresh data
      const freshLogs = appState.attendanceLogs
        .filter(
          (log) =>
            log.employeeId === currentUser.id &&
            log.timestamp.startsWith(todayKey())
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const currentLastLog =
        freshLogs.length > 0 ? freshLogs[freshLogs.length - 1] : null;

      if (currentLastLog && currentLastLog.action === "out") {
        showAlreadyClockedOutModal();
        return;
      }

      if (currentLastLog && currentLastLog.action === "in") {
        showAlreadyClockedInModal();
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

      // Show styled success message
      const toast = document.createElement("div");
      toast.style.cssText =
        "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; font-weight: 500;";
      toast.textContent = isLate
        ? "✓ Clocked in (Late)"
        : "✓ Clocked in successfully!";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      renderAttendance();
    });
  }

  // Clock Out Handler
  if (clockOutBtn && !clockOutBtn.dataset.bound) {
    clockOutBtn.dataset.bound = "true";
    clockOutBtn.addEventListener("click", async () => {
      // Recalculate lastLog with fresh data
      const freshLogs = appState.attendanceLogs
        .filter(
          (log) =>
            log.employeeId === currentUser.id &&
            log.timestamp.startsWith(todayKey())
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const currentLastLog =
        freshLogs.length > 0 ? freshLogs[freshLogs.length - 1] : null;

      if (!currentLastLog || currentLastLog.action === "out") {
        showNeedToClockInModal();
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

      // Show styled success message
      const toast = document.createElement("div");
      toast.style.cssText =
        "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; font-weight: 500;";
      toast.textContent = "✓ Clocked out successfully!";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      // Force refresh attendance display
      renderAttendance();

      // Also update dashboard if we're on that page
      if (typeof updateDashboardAttendance === "function") {
        updateDashboardAttendance();
      }
    });
  }

  // Show need to clock in modal
  function showNeedToClockInModal() {
    const modal = document.createElement("div");
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);";

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
            <span style="color: white; font-size: 2rem;">⚠️</span>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Not Clocked In</h3>
          <p style="margin: 0; color: #666; font-size: 0.95rem;">You need to clock in first before clocking out.</p>
          <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 8px;">
            <div style="font-size: 0.875rem; color: #92400e;">Please use the Clock In button first.</div>
          </div>
        </div>
        <div style="display: flex; justify-content: center;">
          <button id="got-it-need-clock-in-btn" style="padding: 0.75rem 2rem; background: linear-gradient(135deg, #f6c343 0%, #f59e0b 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">Got it</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const gotItBtn = document.getElementById("got-it-need-clock-in-btn");
    gotItBtn.addEventListener("click", () => {
      modal.remove();
    });
  }

  // Show already clocked out modal
  function showAlreadyClockedOutModal() {
    const modal = document.createElement("div");
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);";

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);">
            <span style="color: white; font-size: 2rem;">✓</span>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Already Clocked Out</h3>
          <p style="margin: 0; color: #666; font-size: 0.95rem;">You've already clocked out for the day.</p>
          <div style="margin-top: 1rem; padding: 0.75rem; background: #f3f4f6; border-radius: 8px;">
            <div style="font-size: 0.875rem; color: #6b7280;">Your shift has ended. See you tomorrow!</div>
          </div>
        </div>
        <div style="display: flex; justify-content: center;">
          <button id="got-it-clocked-out-btn" style="padding: 0.75rem 2rem; background: linear-gradient(135deg, #f6c343 0%, #f59e0b 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">Got it</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const gotItBtn = document.getElementById("got-it-clocked-out-btn");
    gotItBtn.addEventListener("click", () => {
      modal.remove();
    });
  }

  // Show already clocked in modal
  function showAlreadyClockedInModal() {
    const modal = document.createElement("div");
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);";

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
            <span style="color: white; font-size: 2rem;">ℹ️</span>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Already Clocked In</h3>
          <p style="margin: 0; color: #666; font-size: 0.95rem;">You've already clocked in today.</p>
          <div style="margin-top: 1rem; padding: 0.75rem; background: #f3f4f6; border-radius: 8px;">
            <div style="font-size: 0.875rem; color: #6b7280;">Please clock out before clocking in again.</div>
          </div>
        </div>
        <div style="display: flex; justify-content: center;">
          <button id="got-it-clocked-in-btn" style="padding: 0.75rem 2rem; background: linear-gradient(135deg, #f6c343 0%, #f59e0b 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">Got it</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const gotItBtn = document.getElementById("got-it-clocked-in-btn");
    gotItBtn.addEventListener("click", () => {
      modal.remove();
    });
  }

  // Show late note dialog
  function showLateNoteDialog() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText =
        "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);";

      modal.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);">
              <span style="color: white; font-size: 2rem;">⚠️</span>
            </div>
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Late Arrival</h3>
            <p style="margin: 0; color: #666; font-size: 0.95rem;">You're arriving late. Please provide a reason.</p>
          </div>
          <textarea id="late-note-input" placeholder="Reason for late arrival..." style="width: 100%; padding: 0.875rem; border: 2px solid #e5e7eb; border-radius: 8px; min-height: 100px; margin-bottom: 1.5rem; font-size: 1rem; font-family: inherit; resize: vertical; transition: border-color 0.2s;" onfocus="this.style.borderColor='#f6c343'"></textarea>
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="cancel-late-btn" style="padding: 0.75rem 1.5rem; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 500; color: #6b7280;">Cancel</button>
            <button id="skip-note-btn" style="padding: 0.75rem 1.5rem; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Skip Note</button>
            <button id="submit-note-btn" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #f6c343 0%, #f59e0b 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">Clock In</button>
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
    logFilter.addEventListener("change", () => {
      attendanceCurrentPage = 1; // Reset to first page on filter change
      renderAttendance();
    });
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
    { present: 0, late: 0, absent: 0, "on-leave": 0, "clocked-out": 0 }
  );

  [
    "attendance-present",
    "attendance-late",
    "attendance-absent",
    "attendance-on-leave",
  ].forEach((id, idx) => {
    const value = [
      summary.present,
      summary.late,
      summary.absent,
      summary["on-leave"],
    ][idx];
    const node = document.getElementById(id);
    if (node) node.textContent = `${value} staff`;
  });

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
    // Get ALL logs from appState, not just today's
    const allLogs = (appState.attendanceLogs || [])
      .filter((log) => {
        if (logFilterValue === "all") return true;
        const shift = (log.shift || "").toLowerCase();
        if (!shift) return false;
        return logFilterValue === "morning"
          ? shift.includes("morning")
          : shift.includes("afternoon");
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Calculate pagination
    const totalPages = Math.ceil(allLogs.length / attendanceItemsPerPage);
    const startIdx = (attendanceCurrentPage - 1) * attendanceItemsPerPage;
    const endIdx = startIdx + attendanceItemsPerPage;
    const pageLogs = allLogs.slice(startIdx, endIdx);

    // Update pagination UI
    updateAttendancePaginationControls(totalPages);

    pageLogs.forEach((log) => {
      const employee = getEmployee(log.employeeId);
      const actionMeta = getAttendanceActionMeta(log.action);
      const row = document.createElement("tr");
      // Show both shift and note if available
      let detailsText = log.shift || "";
      if (log.note) {
        detailsText += detailsText ? ` — ${log.note}` : log.note;
      }
      row.innerHTML = `
        <td>${employee?.name || "Unknown"}</td>
        <td><span class="status ${actionMeta.badge}">${
        actionMeta.label
      }</span></td>
        <td>${formatTime(log.timestamp)}</td>
        <td>${detailsText || ""}</td>
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

  // Request Leave Button Handler
  const requestLeaveBtn = document.getElementById("request-leave-btn");
  if (requestLeaveBtn && !requestLeaveBtn.dataset.bound) {
    requestLeaveBtn.dataset.bound = "true";
    requestLeaveBtn.addEventListener("click", () => {
      openRequestLeaveModal(currentUser);
    });
  }
}

function openRequestLeaveModal(user) {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

  const today = new Date().toISOString().split("T")[0];

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <h3 style="margin: 0 0 1.5rem 0; font-size: 1.5rem; color: #333;">Request Leave</h3>
      <form id="leave-request-form">
        <div style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.875rem;">Start Date</label>
          <input type="date" id="leave-start-date" min="${today}" required style="width: 100%; padding: 0.625rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;" />
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.875rem;">End Date</label>
          <input type="date" id="leave-end-date" min="${today}" required style="width: 100%; padding: 0.625rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;" />
        </div>
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.875rem;">Reason</label>
          <textarea id="leave-reason" rows="3" placeholder="Enter reason for leave..." style="width: 100%; padding: 0.625rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; font-family: inherit; resize: vertical;"></textarea>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="padding: 0.625rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 1rem;">Cancel</button>
          <button type="submit" style="padding: 0.625rem 1.5rem; background: #f6c343; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1rem;">Submit Request</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = document.getElementById("leave-request-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const startDate = document.getElementById("leave-start-date").value;
    const endDate = document.getElementById("leave-end-date").value;
    const reason = document.getElementById("leave-reason").value;

    if (startDate > endDate) {
      alert("End date must be after start date");
      return;
    }

    const newLeaveRequest = {
      id: `leave-${Date.now()}`,
      employeeId: user.id,
      requestType: "leave",
      startDate,
      endDate,
      reason,
      status: "pending",
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
    };

    appState.requests = appState.requests || [];
    appState.requests.push(newLeaveRequest);
    console.log("📝 Leave request created:", newLeaveRequest);
    console.log("📋 Total requests:", appState.requests.length);

    // Save to database via API
    const baseUrl = window.APP_STATE_ENDPOINT
      ? window.APP_STATE_ENDPOINT.replace("/api/state", "")
      : "";
    fetch(`${baseUrl}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLeaveRequest),
    })
      .then((res) => res.json())
      .then(() => {
        saveState();
        modal.remove();
        alert("Leave request submitted successfully! Awaiting admin approval.");
      })
      .catch((error) => {
        console.error("Error saving request:", error);
        alert("Failed to save request. Please try again.");
      });
  });
}

// Pagination functions for attendance logs
function updateAttendancePaginationControls(totalPages) {
  const currentPageEl = document.getElementById("attendance-current-page");
  const totalPagesEl = document.getElementById("attendance-total-pages");
  const prevBtn = document.getElementById("attendance-prev-btn");
  const nextBtn = document.getElementById("attendance-next-btn");
  const pagination = document.getElementById("attendance-pagination");

  if (!currentPageEl || !totalPagesEl || !prevBtn || !nextBtn) return;

  // Hide pagination if only one page or no logs
  if (totalPages <= 1) {
    pagination.style.display = "none";
    return;
  } else {
    pagination.style.display = "flex";
  }

  currentPageEl.textContent = attendanceCurrentPage;
  totalPagesEl.textContent = totalPages;

  // Enable/disable buttons
  prevBtn.disabled = attendanceCurrentPage === 1;
  nextBtn.disabled = attendanceCurrentPage >= totalPages;
}

function attendancePreviousPage() {
  if (attendanceCurrentPage > 1) {
    attendanceCurrentPage--;
    renderAttendance();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function attendanceNextPage() {
  const logFilterValue =
    document.getElementById("attendance-log-filter")?.value || "all";
  const filteredLogs = getTodaysLogs().filter((log) => {
    if (logFilterValue === "all") return true;
    const shift = (log.shift || "").toLowerCase();
    if (!shift) return false;
    return logFilterValue === "morning"
      ? shift.includes("morning")
      : shift.includes("afternoon");
  });

  const totalPages = Math.ceil(filteredLogs.length / attendanceItemsPerPage);
  if (attendanceCurrentPage < totalPages) {
    attendanceCurrentPage++;
    renderAttendance();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["attendance"] = renderAttendance;
