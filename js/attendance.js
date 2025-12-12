// Pagination state for attendance logs
let attendanceCurrentPage = 1;
const attendanceItemsPerPage = 20;

// Refresh attendance logs from server
async function refreshAttendanceLogs() {
  try {
    let baseUrl = "";
    if (typeof window !== "undefined" && window.APP_STATE_ENDPOINT) {
      const urlObj = new URL(window.APP_STATE_ENDPOINT);
      baseUrl = urlObj.origin;
    }

    const url = baseUrl + "/api/attendance-logs";
    console.log("🔄 Fetching attendance logs from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (response.ok) {
      const freshLogs = await response.json();
      console.log("✅ Received", freshLogs.length, "logs from server");

      // Log sample to verify structure
      if (freshLogs.length > 0) {
        console.log("📋 Sample log:", freshLogs[0]);
        console.log("   - Has employeeId?", "employeeId" in freshLogs[0]);
        console.log("   - Has employee_id?", "employee_id" in freshLogs[0]);
      }

      // Update appState with fresh data from server
      appState.attendanceLogs = freshLogs;
      console.log(
        "✅ Updated appState.attendanceLogs:",
        appState.attendanceLogs.length
      );
    } else {
      console.error(
        "❌ Failed to fetch logs:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("❌ Error refreshing attendance logs:", error);
    // Don't throw - continue with local data if refresh fails
  }
}

// Refresh users from server (needed for employee names)
async function refreshUsers() {
  try {
    let baseUrl = "";
    if (typeof window !== "undefined" && window.APP_STATE_ENDPOINT) {
      const urlObj = new URL(window.APP_STATE_ENDPOINT);
      baseUrl = urlObj.origin;
    }

    const url = baseUrl + "/api/users";
    console.log("🔄 Fetching users from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (response.ok) {
      const freshUsers = await response.json();
      console.log("✅ Received", freshUsers.length, "users from server");
      appState.users = freshUsers;
      console.log("✅ Updated appState.users:", appState.users.length);
    } else {
      console.error(
        "❌ Failed to fetch users:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("❌ Error refreshing users:", error);
  }
}

// Save attendance log directly to database
async function saveAttendanceLog(log) {
  try {
    // Get the base API URL from window.APP_STATE_ENDPOINT or use default
    let baseUrl = "";
    if (typeof window !== "undefined" && window.APP_STATE_ENDPOINT) {
      // Extract base URL (e.g., "https://sweetbox-backend.onrender.com" from full endpoint)
      const urlObj = new URL(window.APP_STATE_ENDPOINT);
      baseUrl = urlObj.origin;
    }

    const url = baseUrl + "/api/attendance-logs";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(log),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Failed to save attendance log:",
        response.status,
        response.statusText,
        errorText
      );
      throw new Error(`Failed to save attendance log: ${errorText}`);
    }

    console.log("Attendance log saved successfully");
    return await response.json();
  } catch (error) {
    console.error("Error saving attendance log:", error);
    throw error;
  }
}

// Show need to clock in modal
function showNeedToClockInModal() {
  // Remove any existing modals first
  document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-icon warning">
          <span class="modal-icon-emoji">⚠️</span>
        </div>
        <h3 class="modal-title">Not Clocked In</h3>
        <p class="modal-message">You need to clock in first before clocking out.</p>
        <div class="modal-info-box">
          <div class="modal-info-value">Please use the Clock In button first.</div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="got-it-need-clock-in-btn" class="modal-btn primary">Got it</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Add active class to show modal (required by modal.css)
  setTimeout(() => modal.classList.add("active"), 10);

  const gotItBtn = document.getElementById("got-it-need-clock-in-btn");
  gotItBtn.addEventListener("click", () => {
    modal.remove();
  });
}

// Show already clocked out modal
function showAlreadyClockedOutModal() {
  // Remove any existing modals first
  document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-icon success">
          <span class="modal-icon-emoji">✓</span>
        </div>
        <h3 class="modal-title">Already Clocked Out</h3>
        <p class="modal-message">You've already clocked out for the day.</p>
        <div class="modal-info-box">
          <div class="modal-info-value">Your shift has ended. See you tomorrow!</div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="got-it-clocked-out-btn" class="modal-btn primary">Got it</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Add active class to show modal (required by modal.css)
  setTimeout(() => modal.classList.add("active"), 10);

  const gotItBtn = document.getElementById("got-it-clocked-out-btn");
  gotItBtn.addEventListener("click", () => {
    modal.remove();
  });
}

// Show already clocked in modal
function showAlreadyClockedInModal() {
  // Remove any existing modals first
  document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-icon info">
          <span class="modal-icon-emoji">ℹ️</span>
        </div>
        <h3 class="modal-title">Already Clocked In</h3>
        <p class="modal-message">You've already clocked in today.</p>
        <div class="modal-info-box">
          <div class="modal-info-value">Please clock out before clocking in again.</div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="got-it-clocked-in-btn" class="modal-btn primary">Got it</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Add active class to show modal (required by modal.css)
  setTimeout(() => modal.classList.add("active"), 10);

  const gotItBtn = document.getElementById("got-it-clocked-in-btn");
  gotItBtn.addEventListener("click", () => {
    modal.remove();
  });
}

// Show late note dialog
function showLateNoteDialog() {
  return new Promise((resolve) => {
    // Remove any existing modals first
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());

    const modal = document.createElement("div");
    modal.className = "modal-overlay";

    modal.innerHTML = `
      <div class="modal-content medium">
        <div class="modal-header">
          <div class="modal-icon warning">
            <span class="modal-icon-emoji">⚠️</span>
          </div>
          <h3 class="modal-title">Late Arrival</h3>
          <p class="modal-message">You're arriving late. Please provide a reason.</p>
        </div>
        <textarea id="late-note-input" placeholder="Reason for late arrival..." style="width: 100%; padding: 0.875rem; border: 2px solid #e5e7eb; border-radius: 8px; min-height: 100px; margin-bottom: 1.5rem; font-size: 1rem; font-family: inherit; resize: vertical; transition: border-color 0.2s;" onfocus="this.style.borderColor='#f6c343'"></textarea>
        <div class="modal-actions" style="justify-content: flex-end;">
          <button id="cancel-late-btn" class="modal-btn cancel">Cancel</button>
          <button id="skip-note-btn" class="modal-btn cancel" style="background: #6b7280; color: white;">Skip Note</button>
          <button id="submit-note-btn" class="modal-btn primary">Clock In</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    // Add active class to show modal (required by modal.css)
    setTimeout(() => modal.classList.add("active"), 10);

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

function renderAttendance() {
  const currentUser = getCurrentUser();
  const clockInBtn = document.getElementById("clock-in-btn");
  const clockOutBtn = document.getElementById("clock-out-btn");
  const currentUserName = document.getElementById("current-user-name");
  const lastActionDisplay = document.getElementById("last-action-display");
  const statusFilter = document.getElementById("attendance-status-filter");

  // Display current user
  if (currentUserName && currentUser) {
    currentUserName.textContent = `${currentUser.name} (${formatRole(
      currentUser.permission || currentUser.role
    )})`;
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
      // Disable button to prevent double-clicks
      clockInBtn.disabled = true;

      try {
        // Fetch fresh data from server BEFORE validation to prevent stale data issues
        console.log("🔍 Fetching fresh data before clock-in validation...");
        await refreshAttendanceLogs();

        // NOW validate with fresh data from server
        console.log("🔍 Debug - currentUser.id:", currentUser.id);
        console.log("🔍 Debug - todayKey():", todayKey());
        console.log(
          "🔍 Debug - Total logs in appState:",
          appState.attendanceLogs.length
        );

        const freshLogs = appState.attendanceLogs
          .filter(
            (log) =>
              log.employeeId === currentUser.id &&
              log.timestamp.startsWith(todayKey())
          )
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log(
          "🔍 Debug - Filtered logs for current user today:",
          freshLogs.length
        );
        if (freshLogs.length > 0) {
          console.log("🔍 Debug - Sample filtered log:", freshLogs[0]);
        }

        const currentLastLog =
          freshLogs.length > 0 ? freshLogs[freshLogs.length - 1] : null;

        console.log("📊 Clock-in validation - Last log:", currentLastLog);

        // Prevent clocking in if already clocked in (last action was "in")
        if (currentLastLog && currentLastLog.action === "in") {
          console.log("⚠️ Already clocked in - showing modal");
          showAlreadyClockedInModal();
          clockInBtn.disabled = false;
          return;
        }

        // Allow clock-in if no previous logs OR if last action was "out"

        const isLate = isUserLate(currentUser);
        let note = "";

        // Show note popup if late
        if (isLate) {
          note = await showLateNoteDialog();
          if (note === null) {
            clockInBtn.disabled = false;
            return; // User cancelled
          }
        }

        // Calculate late duration if late
        let lateInfo = "";
        if (isLate && currentUser.shiftStart) {
          const now = new Date();
          const [hours, minutes] = currentUser.shiftStart.split(":");
          const shiftTime = new Date();
          shiftTime.setHours(parseInt(hours), parseInt(minutes), 0);

          const lateMinutes = Math.floor((now - shiftTime) / 60000);
          if (lateMinutes >= 60) {
            const lateHours = Math.floor(lateMinutes / 60);
            const remainingMinutes = lateMinutes % 60;
            lateInfo =
              remainingMinutes > 0
                ? `Late by ${lateHours}h ${remainingMinutes}m`
                : `Late by ${lateHours}h`;
          } else {
            lateInfo = `Late by ${lateMinutes}m`;
          }

          // Combine late info with user's note
          if (note) {
            note = `${lateInfo} - ${note}`;
          } else {
            note = lateInfo;
          }
        }

        // Create attendance log with local timestamp
        const newLog = {
          id: `att-${Date.now()}`,
          employeeId: currentUser.id,
          action: "in",
          timestamp: getLocalTimestamp(),
          note: note || null,
        };

        // Save to local state first
        appState.attendanceLogs.push(newLog);

        // Save directly to database
        await saveAttendanceLog(newLog);

        // Refresh data from server to ensure consistency
        console.log("🔄 Refreshing data after clock-in...");
        await Promise.all([refreshAttendanceLogs(), refreshUsers()]);
        console.log("✅ Data refresh complete");
        console.log(
          "   - appState.attendanceLogs:",
          appState.attendanceLogs?.length
        );
        console.log("   - appState.users:", appState.users?.length);

        createToast(
          isLate ? "✓ Clocked in (Late)" : "✓ Clocked in successfully!",
          "success"
        );

        renderAttendance();
      } catch (error) {
        console.error("Clock-in error:", error);

        // Remove from local state if save failed - use optional chaining for safety
        if (typeof newLog !== "undefined") {
          const index = appState.attendanceLogs.findIndex(
            (log) => log.id === newLog.id
          );
          if (index > -1) {
            appState.attendanceLogs.splice(index, 1);
          }
        }

        createToast("✗ Failed to clock in. Please try again.", "error");
      } finally {
        // Re-enable button
        clockInBtn.disabled = false;
      }
    });
  }

  // Clock Out Handler
  if (clockOutBtn && !clockOutBtn.dataset.bound) {
    clockOutBtn.dataset.bound = "true";
    clockOutBtn.addEventListener("click", async () => {
      // Disable button to prevent double-clicks
      clockOutBtn.disabled = true;

      try {
        // Fetch fresh data from server BEFORE validation
        console.log("🔍 Fetching fresh data before clock-out validation...");
        await refreshAttendanceLogs();

        // NOW validate with fresh data from server
        console.log("🔍 Debug - currentUser.id:", currentUser.id);
        console.log("🔍 Debug - todayKey():", todayKey());
        console.log(
          "🔍 Debug - Total logs in appState:",
          appState.attendanceLogs.length
        );

        const freshLogs = appState.attendanceLogs
          .filter(
            (log) =>
              log.employeeId === currentUser.id &&
              log.timestamp.startsWith(todayKey())
          )
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log(
          "🔍 Debug - Filtered logs for current user today:",
          freshLogs.length
        );
        if (freshLogs.length > 0) {
          console.log("🔍 Debug - Sample filtered log:", freshLogs[0]);
        }

        const currentLastLog =
          freshLogs.length > 0 ? freshLogs[freshLogs.length - 1] : null;

        console.log("📊 Clock-out validation - Last log:", currentLastLog);

        // Prevent clocking out if:
        // 1. No logs today (haven't clocked in yet)
        // 2. Last action was "out" (already clocked out)
        if (!currentLastLog || currentLastLog.action === "out") {
          console.log("⚠️ Need to clock in first - showing modal");
          showNeedToClockInModal();
          clockOutBtn.disabled = false;
          return;
        }

        // Allow clock-out only if last action was "in"

        // Create attendance log with local timestamp
        const newLog = {
          id: `att-${Date.now()}`,
          employeeId: currentUser.id,
          action: "out",
          timestamp: getLocalTimestamp(),
          note: null,
        };

        // Save to local state first
        appState.attendanceLogs.push(newLog);

        // Save directly to database
        await saveAttendanceLog(newLog);

        // Refresh data from server to ensure consistency
        console.log("🔄 Refreshing data after clock-out...");
        await Promise.all([refreshAttendanceLogs(), refreshUsers()]);
        console.log("✅ Data refresh complete");

        createToast("✓ Clocked out successfully!", "success");

        // Force refresh attendance display
        renderAttendance();

        // Also update dashboard if we're on that page
        if (typeof updateDashboardAttendance === "function") {
          updateDashboardAttendance();
        }
      } catch (error) {
        console.error("Clock-out error:", error);

        // Remove from local state if save failed
        const index = appState.attendanceLogs.findIndex(
          (log) => log.id === newLog?.id
        );
        if (index > -1) {
          appState.attendanceLogs.splice(index, 1);
        }

        createToast("✗ Failed to clock out. Please try again.", "error");
      } finally {
        // Re-enable button
        clockOutBtn.disabled = false;
      }
    });
  }

  // isUserLate and modal functions are now defined globally above renderAttendance()

  // Status filter handler
  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.dataset.bound = "true";
    statusFilter.addEventListener("change", () => {
      attendanceCurrentPage = 1; // Reset to first page on filter change
      renderAttendance();
    });
  }

  const statusFilterValue = statusFilter?.value || "all";

  const employeeSnapshots = appState.users
    .filter((user) => user.permission !== "admin")
    .map((employee) => {
      const snapshot = computeEmployeeStatus(employee);
      const todaysLogs = appState.attendanceLogs
        .filter(
          (log) =>
            log.employeeId === employee.id &&
            log.timestamp.startsWith(todayKey()) &&
            !log.archived // Exclude archived logs
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
    "attendance-clocked-out",
  ].forEach((id, idx) => {
    const value = [
      summary.present,
      summary.late,
      summary.absent,
      summary["on-leave"],
      summary["clocked-out"],
    ][idx];
    const node = document.getElementById(id);
    if (node) node.textContent = `${value} staff`;
  });

  const boardBody = document.querySelector("#attendance-status-table tbody");
  if (boardBody) {
    // Check if mobile view
    if (window.isMobileView && window.isMobileView()) {
      // Render mobile-friendly version
      const container = boardBody.closest("table").parentElement;
      container.innerHTML = '<div id="mobile-attendance-board"></div>';
      const mobileContainer = document.getElementById(
        "mobile-attendance-board"
      );

      const fields = [
        { key: "employee", label: "Employee", format: (emp) => emp.name },
        {
          key: "status",
          label: "Status",
          format: (status, item) => {
            let displayLabel = "";
            if (item.latestAction === "in") {
              displayLabel = "Clocked in";
              if (status === "late") displayLabel += " — Late";
            } else if (item.latestAction === "out") {
              displayLabel = "Clocked out";
            } else {
              displayLabel = status.charAt(0).toUpperCase() + status.slice(1);
            }
            return displayLabel;
          },
        },
        { key: "employee", label: "Role", format: (emp) => emp.role },
        { key: "timestamp", label: "Time", format: (ts) => ts },
      ];

      if (window.renderMobileTable) {
        window.renderMobileTable(employeeSnapshots, fields, mobileContainer);
      }
    } else {
      // Desktop table rendering
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
  }

  const logBody = document.querySelector("#attendance-log-table tbody");
  if (logBody) {
    logBody.innerHTML = "";
    // Get ALL logs from appState, not just today's, but exclude archived logs
    const allLogs = (appState.attendanceLogs || [])
      .filter((log) => {
        // Filter out archived logs
        if (log.archived) return false;

        // Apply status filter
        if (statusFilterValue !== "all" && log.action !== statusFilterValue) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Calculate pagination
    const totalPages = Math.ceil(allLogs.length / attendanceItemsPerPage);
    const startIdx = (attendanceCurrentPage - 1) * attendanceItemsPerPage;
    const endIdx = startIdx + attendanceItemsPerPage;
    const pageLogs = allLogs.slice(startIdx, endIdx);

    // Update pagination UI
    updateAttendancePaginationControls(totalPages);

    // Check if current user is admin or manager
    const currentUser = getCurrentUser();
    const canArchive =
      currentUser &&
      (currentUser.permission === "admin" ||
        currentUser.permission === "manager");

    // Check if mobile view
    if (window.isMobileView && window.isMobileView()) {
      // Render mobile-friendly version
      const container = logBody.closest("table").parentElement;
      container.innerHTML = '<div id="mobile-attendance-logs"></div>';
      const mobileContainer = document.getElementById("mobile-attendance-logs");

      const fields = [
        {
          key: "employeeName",
          label: "Employee",
          format: (name) => name || "Unknown",
        },
        {
          key: "action",
          label: "Action",
          format: (action) => {
            const meta = getAttendanceActionMeta(action);
            return meta.label;
          },
        },
        { key: "timestamp", label: "Time", format: (ts) => formatTime(ts) },
        { key: "note", label: "Details", format: (note) => note || "N/A" },
      ];

      // Add employee name to each log for easier rendering
      const logsWithNames = pageLogs.map((log) => ({
        ...log,
        employeeName: getEmployee(log.employeeId)?.name || "Unknown",
      }));

      if (window.renderMobileTable) {
        window.renderMobileTable(
          logsWithNames,
          fields,
          mobileContainer,
          (item) => {
            // Custom detail modal with archive button
            const meta = getAttendanceActionMeta(item.action);
            const modalFields = [
              ...fields,
              ...(canArchive
                ? [
                    {
                      key: "id",
                      label: "Actions",
                      format: (id) =>
                        `<button class="btn btn-warning btn-sm" onclick="archiveAttendanceLog('${id}')">Archive Log</button>`,
                    },
                  ]
                : []),
            ];
            window.showMobileDetailModal(item, modalFields);
          }
        );
      }
    } else {
      // Desktop table rendering
      pageLogs.forEach((log) => {
        const employee = getEmployee(log.employeeId);
        const actionMeta = getAttendanceActionMeta(log.action);
        const row = document.createElement("tr");
        // Show note if available
        const detailsText = log.note || "";

        row.innerHTML = `
          <td>${employee?.name || "Unknown"}</td>
          <td><span class="status ${actionMeta.badge}">${
          actionMeta.label
        }</span></td>
          <td>${formatTime(log.timestamp)}</td>
          <td>${detailsText || ""}</td>
          ${
            canArchive
              ? `<td style="text-align: center;">
                  <button class="btn btn-warning btn-sm" data-archive-log="${log.id}" title="Archive this log">Archive</button>
                </td>`
              : ""
          }
        `;
        logBody.appendChild(row);
      });

      if (!logBody.children.length) {
        const row = document.createElement("tr");
        row.innerHTML = `<td colspan="4" class="empty-state">No logs recorded for today yet.</td>`;
        logBody.appendChild(row);
      }

      // Attach archive button event listeners
      document.querySelectorAll("[data-archive-log]").forEach((btn) => {
        btn.addEventListener("click", () => {
          archiveAttendanceLog(btn.dataset.archiveLog);
        });
      });
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
  // Remove any existing modals first
  document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const today = new Date().toISOString().split("T")[0];

  modal.innerHTML = `
    <div class="modal-content medium">
      <h3 style="margin: 0 0 1.5rem 0; font-size: 1.5rem; color: #333;">Request Leave</h3>
      <form id="leave-request-form">
        <div style="margin-bottom: 1rem;">
          <label for="leave-start-date" style="display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.875rem;">Start Date</label>
          <input type="date" id="leave-start-date" name="leave-start-date" autocomplete="off" min="${today}" required style="width: 100%; padding: 0.625rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;" />
        </div>
        <div style="margin-bottom: 1rem;">
          <label for="leave-end-date" style="display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.875rem;">End Date</label>
          <input type="date" id="leave-end-date" name="leave-end-date" autocomplete="off" min="${today}" required style="width: 100%; padding: 0.625rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem;" />
        </div>
        <div style="margin-bottom: 1.5rem;">
          <label for="leave-reason" style="display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.875rem;">Reason</label>
          <textarea id="leave-reason" name="leave-reason" autocomplete="off" rows="3" placeholder="Enter reason for leave..." style="width: 100%; padding: 0.625rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; font-family: inherit; resize: vertical;"></textarea>
        </div>
        <div class="modal-actions" style="justify-content: flex-end;">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="modal-btn cancel">Cancel</button>
          <button type="submit" class="modal-btn primary">Submit Request</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  // Add active class to show modal (required by modal.css)
  setTimeout(() => modal.classList.add("active"), 10);

  const form = document.getElementById("leave-request-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const startDate = document.getElementById("leave-start-date").value;
    const endDate = document.getElementById("leave-end-date").value;
    const reason = document.getElementById("leave-reason").value;

    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start < today) {
      alert(
        "Start date cannot be in the past. Please select a current or future date."
      );
      return;
    }

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

        createToast(
          "✓ Leave request submitted successfully! Awaiting admin approval.",
          "success",
          4000
        );
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
    // Scroll to the Timestamp Log section
    const logSection = document
      .querySelector("#attendance-log-table")
      ?.closest(".table-wrapper");
    if (logSection) {
      logSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function attendanceNextPage() {
  const statusFilterValue =
    document.getElementById("attendance-status-filter")?.value || "all";

  // Use the same filter logic as renderAttendance
  const filteredLogs = (appState.attendanceLogs || []).filter((log) => {
    // Filter out archived logs
    if (log.archived) return false;

    // Apply status filter
    if (statusFilterValue !== "all" && log.action !== statusFilterValue) {
      return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / attendanceItemsPerPage);
  if (attendanceCurrentPage < totalPages) {
    attendanceCurrentPage++;
    renderAttendance();
    // Scroll to the Timestamp Log section
    const logSection = document
      .querySelector("#attendance-log-table")
      ?.closest(".table-wrapper");
    if (logSection) {
      logSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

// Archive attendance log function
function archiveAttendanceLog(logId) {
  const log = appState.attendanceLogs.find((l) => l.id === logId);
  if (!log) return;

  showConfirm(
    `Are you sure you want to archive this attendance log?\n\nEmployee: ${
      getEmployee(log.employeeId)?.name || "Unknown"
    }\nAction: ${log.action}\nTimestamp: ${formatTime(log.timestamp)}`,
    async () => {
      showLoading("Archiving attendance log...");

      try {
        const currentUser = getCurrentUser();

        // Mark the log as archived
        log.archived = true;
        log.archivedAt = getLocalTimestamp();
        log.archivedBy = currentUser?.id || null;

        // Save to database using dedicated API endpoint
        const endpoint = `${
          window.API_BASE_URL || ""
        }/api/attendance-logs/${logId}`;
        const response = await fetch(endpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(log),
        });

        if (!response.ok) {
          throw new Error(`Failed to archive: ${response.statusText}`);
        }

        hideLoading();
        renderAttendance();
      } catch (error) {
        hideLoading();
        console.error("Error archiving attendance log:", error);
        alert("Failed to archive attendance log. Please try again.");
        // Revert the changes
        log.archived = false;
        log.archivedAt = null;
        log.archivedBy = null;
      }
    }
  );
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["attendance"] = renderAttendance;

// Make archiveAttendanceLog globally accessible for mobile modals
window.archiveAttendanceLog = archiveAttendanceLog;

// Re-render on window resize to handle mobile/desktop switch
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.body.dataset.page === "attendance") {
      renderAttendance();
    }
  }, 250);
});
