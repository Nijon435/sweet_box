// Archive page functionality

let currentTab = "orders";

function initializeArchive() {
  setupTabs();
  setupRefreshButton();
  setupDeleteAllButtons();
  renderArchive();
}

function setupTabs() {
  const tabs = document.querySelectorAll(".archive-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll(".archive-tab").forEach((tab) => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  // Update sections
  document.querySelectorAll(".archive-section").forEach((section) => {
    if (section.id === `${tabName}-archive`) {
      section.classList.add("active");
    } else {
      section.classList.remove("active");
    }
  });

  renderArchive();
}

function setupRefreshButton() {
  const refreshBtn = document.getElementById("refresh-archive");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      location.reload();
    });
  }
}

function setupDeleteAllButtons() {
  // Delete All Orders
  const deleteAllOrdersBtn = document.getElementById("delete-all-orders");
  if (deleteAllOrdersBtn) {
    deleteAllOrdersBtn.addEventListener("click", async () => {
      const archivedOrders = (appState.orders || []).filter((o) => o.archived);
      if (archivedOrders.length === 0) {
        showAlert("No archived orders to delete", "info");
        return;
      }
      await deleteAllArchived("orders", archivedOrders);
    });
  }

  // Delete All Inventory
  const deleteAllInventoryBtn = document.getElementById("delete-all-inventory");
  if (deleteAllInventoryBtn) {
    deleteAllInventoryBtn.addEventListener("click", async () => {
      const archivedInventory = (appState.inventory || []).filter(
        (i) => i.archived
      );
      if (archivedInventory.length === 0) {
        showAlert("No archived inventory to delete", "info");
        return;
      }
      await deleteAllArchived("inventory", archivedInventory);
    });
  }

  // Delete All Users
  const deleteAllUsersBtn = document.getElementById("delete-all-users");
  if (deleteAllUsersBtn) {
    deleteAllUsersBtn.addEventListener("click", async () => {
      const archivedUsers = (appState.users || []).filter((u) => u.archived);
      if (archivedUsers.length === 0) {
        showAlert("No archived users to delete", "info");
        return;
      }
      await deleteAllArchived("users", archivedUsers);
    });
  }

  // Delete All Attendance
  const deleteAllAttendanceBtn = document.getElementById(
    "delete-all-attendance"
  );
  if (deleteAllAttendanceBtn) {
    deleteAllAttendanceBtn.addEventListener("click", async () => {
      const archivedAttendance = (appState.attendanceLogs || []).filter(
        (a) => a.archived
      );
      if (archivedAttendance.length === 0) {
        showAlert("No archived attendance logs to delete", "info");
        return;
      }
      await deleteAllArchived("attendance-logs", archivedAttendance);
    });
  }

  // Delete All Usage Logs
  const deleteAllUsageLogsBtn = document.getElementById(
    "delete-all-usage-logs"
  );
  if (deleteAllUsageLogsBtn) {
    deleteAllUsageLogsBtn.addEventListener("click", async () => {
      const archivedUsageLogs = (appState.inventoryUsageLogs || []).filter(
        (l) => l.archived
      );
      if (archivedUsageLogs.length === 0) {
        showAlert("No archived usage logs to delete", "info");
        return;
      }
      await deleteAllArchived("inventory-usage-logs", archivedUsageLogs);
    });
  }
}

async function deleteAllArchived(type, items) {
  const confirmed = await showConfirmAlert(
    `Delete All Archived ${type.charAt(0).toUpperCase() + type.slice(1)}?`,
    `This will permanently delete ${items.length} archived item(s). This action cannot be undone.`
  );

  if (!confirmed) return;

  showLoading(`Deleting ${items.length} items...`);

  try {
    const deletePromises = items.map((item) =>
      fetch(`${window.API_BASE_URL || ""}/api/${type}/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      })
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter((res) => res.ok).length;

    hideLoading();

    if (successCount === items.length) {
      // Remove from appState
      if (type === "orders") {
        appState.orders = (appState.orders || []).filter((o) => !o.archived);
      } else if (type === "inventory") {
        appState.inventory = (appState.inventory || []).filter(
          (i) => !i.archived
        );
      } else if (type === "users") {
        appState.users = (appState.users || []).filter((u) => !u.archived);
      } else if (type === "attendance-logs") {
        appState.attendanceLogs = (appState.attendanceLogs || []).filter(
          (a) => !a.archived
        );
      } else if (type === "inventory-usage-logs") {
        appState.inventoryUsageLogs = (
          appState.inventoryUsageLogs || []
        ).filter((l) => !l.archived);
      }

      showAlert(`Successfully deleted ${successCount} item(s)`, "success");
      renderArchive();
    } else {
      showAlert(
        `Deleted ${successCount} of ${items.length} items. Some deletions failed.`,
        "warning"
      );
      renderArchive();
    }
  } catch (error) {
    hideLoading();
    console.error("Error deleting all archived items:", error);
    showAlert("Failed to delete archived items", "error");
  }
}

function renderArchive() {
  if (currentTab === "orders") {
    renderArchivedOrders();
  } else if (currentTab === "inventory") {
    renderArchivedInventory();
  } else if (currentTab === "users") {
    renderArchivedUsers();
  } else if (currentTab === "attendance") {
    renderArchivedAttendanceLogs();
  } else if (currentTab === "usage-logs") {
    renderArchivedUsageLogs();
  }
}

// Render Archived Orders
function renderArchivedOrders() {
  const tbody = document.querySelector("#archive-orders-table tbody");
  if (!tbody) return;

  const archivedOrders = (appState.orders || []).filter(
    (order) => order.archived
  );

  tbody.innerHTML = "";

  if (archivedOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-archive">
          <div class="empty-archive-icon">📦</div>
          <div>No archived orders</div>
        </td>
      </tr>
    `;
    return;
  }

  archivedOrders.forEach((order) => {
    // Get archived by user name
    let archivedByName = "--";
    const archivedById = order.archivedBy || order.archived_by;
    if (archivedById) {
      const archivedByUser = (appState.users || []).find(
        (u) => u.id === archivedById
      );
      archivedByName = archivedByUser ? archivedByUser.name : "Unknown";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${order.id}</strong></td>
      <td>${order.customer}</td>
      <td>${formatCurrency(order.total)}</td>
      <td>${formatTime(order.timestamp)}</td>
      <td>${archivedByName}</td>
      <td class="archive-actions">
        <button class="btn btn-outline btn-sm btn-restore" data-restore-order="${
          order.id
        }">Restore</button>
        <button class="btn btn-warning btn-sm btn-permanent-delete" data-delete-order="${
          order.id
        }">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach event listeners
  document.querySelectorAll("[data-restore-order]").forEach((btn) => {
    btn.addEventListener("click", () => restoreOrder(btn.dataset.restoreOrder));
  });

  document.querySelectorAll("[data-delete-order]").forEach((btn) => {
    btn.addEventListener("click", () => deleteOrder(btn.dataset.deleteOrder));
  });
}

// Render Archived Inventory
function renderArchivedInventory() {
  const tbody = document.querySelector("#archive-inventory-table tbody");
  if (!tbody) return;

  const archivedItems = (appState.inventory || []).filter(
    (item) => item.archived
  );

  tbody.innerHTML = "";

  if (archivedItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-archive">
          <div class="empty-archive-icon">📋</div>
          <div>No archived inventory items</div>
        </td>
      </tr>
    `;
    return;
  }

  archivedItems.forEach((item) => {
    // Get archived by user name
    let archivedByName = "--";
    const archivedById = item.archivedBy || item.archived_by;
    if (archivedById) {
      const archivedByUser = (appState.users || []).find(
        (u) => u.id === archivedById
      );
      archivedByName = archivedByUser ? archivedByUser.name : "Unknown";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${item.category || "--"}</td>
      <td>${item.quantity || 0}</td>
      <td>${item.unit || "--"}</td>
      <td>${archivedByName}</td>
      <td class="archive-actions">
        <button class="btn btn-outline btn-sm btn-restore" data-restore-inventory="${
          item.id
        }">Restore</button>
        <button class="btn btn-warning btn-sm btn-permanent-delete" data-delete-inventory="${
          item.id
        }">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach event listeners
  document.querySelectorAll("[data-restore-inventory]").forEach((btn) => {
    btn.addEventListener("click", () =>
      restoreInventory(btn.dataset.restoreInventory)
    );
  });

  document.querySelectorAll("[data-delete-inventory]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteInventory(btn.dataset.deleteInventory)
    );
  });
}

// Render Archived Users
function renderArchivedUsers() {
  const tbody = document.querySelector("#archive-users-table tbody");
  if (!tbody) return;

  const archivedUsers = (appState.users || []).filter((user) => user.archived);

  tbody.innerHTML = "";

  if (archivedUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-archive">
          <div class="empty-archive-icon">👥</div>
          <div>No archived users</div>
        </td>
      </tr>
    `;
    return;
  }

  archivedUsers.forEach((user) => {
    // Get archived by user name
    let archivedByName = "--";
    const archivedById = user.archivedBy || user.archived_by;
    if (archivedById) {
      const archivedByUser = (appState.users || []).find(
        (u) => u.id === archivedById
      );
      archivedByName = archivedByUser ? archivedByUser.name : "Unknown";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${user.name}</strong></td>
      <td>${user.email || "--"}</td>
      <td>${user.role || "--"}</td>
      <td>${user.permission || "--"}</td>
      <td>${archivedByName}</td>
      <td class="archive-actions">
        <button class="btn btn-outline btn-sm btn-restore" data-restore-user="${
          user.id
        }">Restore</button>
        <button class="btn btn-warning btn-sm btn-permanent-delete" data-delete-user="${
          user.id
        }">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach event listeners
  document.querySelectorAll("[data-restore-user]").forEach((btn) => {
    btn.addEventListener("click", () => restoreUser(btn.dataset.restoreUser));
  });

  document.querySelectorAll("[data-delete-user]").forEach((btn) => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.deleteUser));
  });
}

// Render Archived Attendance Logs
function renderArchivedAttendanceLogs() {
  const tbody = document.querySelector("#archive-attendance-table tbody");
  if (!tbody) return;

  const archivedLogs = (appState.attendanceLogs || []).filter(
    (log) => log.archived
  );

  tbody.innerHTML = "";

  if (archivedLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-archive">
          <div class="empty-archive-icon">🕒</div>
          <div>No archived attendance logs</div>
        </td>
      </tr>
    `;
    return;
  }

  archivedLogs.forEach((log) => {
    // Get employee name
    const employee = (appState.users || []).find(
      (u) => u.id === log.employeeId
    );
    const employeeName = employee ? employee.name : "Unknown";

    // Get archived by user name
    let archivedByName = "--";
    const archivedById = log.archivedBy || log.archived_by;
    if (archivedById) {
      const archivedByUser = (appState.users || []).find(
        (u) => u.id === archivedById
      );
      archivedByName = archivedByUser ? archivedByUser.name : "Unknown";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${employeeName}</strong></td>
      <td><span class="status ${log.action === "in" ? "in" : "out"}">${
      log.action === "in"
        ? "Clock In"
        : log.action === "out"
        ? "Clock Out"
        : "On Leave"
    }</span></td>
      <td>${formatTime(log.timestamp)}</td>
      <td>${log.note || "--"}</td>
      <td>${archivedByName}</td>
      <td class="archive-actions">
        <button class="btn btn-outline btn-sm btn-restore" data-restore-log="${
          log.id
        }">Restore</button>
        <button class="btn btn-warning btn-sm btn-permanent-delete" data-delete-log="${
          log.id
        }">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach event listeners
  document.querySelectorAll("[data-restore-log]").forEach((btn) => {
    btn.addEventListener("click", () =>
      restoreAttendanceLog(btn.dataset.restoreLog)
    );
  });

  document.querySelectorAll("[data-delete-log]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteAttendanceLog(btn.dataset.deleteLog)
    );
  });
}

// Restore Functions
async function restoreOrder(orderId) {
  const order = appState.orders.find((o) => o.id === orderId);
  if (!order) return;

  order.archived = false;
  order.archivedAt = null;
  order.archivedBy = null;

  try {
    const apiBase = window.API_BASE_URL || "";
    let response = await fetch(`${apiBase}/api/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(order),
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
      throw new Error("Failed to restore order");
    }

    renderArchive();
    showToast("Order restored successfully", "success");
  } catch (error) {
    console.error("Error restoring order:", error);
    showToast("Failed to restore order", "error");
  }
}

async function restoreInventory(itemId) {
  const item = appState.inventory.find((i) => i.id === itemId);
  if (!item) return;

  item.archived = false;
  item.archivedAt = null;
  item.archivedBy = null;

  try {
    const apiBase = window.API_BASE_URL || "";
    let response = await fetch(`${apiBase}/api/inventory/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(item),
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
      throw new Error("Failed to restore item");
    }

    renderArchive();
    showToast("Inventory item restored successfully", "success");
  } catch (error) {
    console.error("Error restoring item:", error);
    showToast("Failed to restore item", "error");
  }
}

async function restoreUser(userId) {
  const user = appState.users.find((u) => u.id === userId);
  if (!user) return;

  user.archived = false;
  user.archivedAt = null;
  user.archivedBy = null;

  try {
    const apiBase = window.API_BASE_URL || "";
    let response = await fetch(`${apiBase}/api/users/${userId}`, {
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
      throw new Error("Failed to restore user");
    }

    renderArchive();
    showToast("User restored successfully", "success");
  } catch (error) {
    console.error("Error restoring user:", error);
    showToast("Failed to restore user", "error");
  }
}

// Delete Functions (permanent)
function deleteOrder(orderId) {
  const order = appState.orders.find((o) => o.id === orderId);
  if (!order) return;

  showDeleteConfirmation(
    "Permanently Delete Order?",
    `This will permanently delete order ${orderId}. This action cannot be undone.`,
    async () => {
      try {
        const apiBase = window.API_BASE_URL || "";
        let response = await fetch(`${apiBase}/api/orders/${orderId}`, {
          method: "DELETE",
          credentials: "include",
        });

        // Fallback to bulk save if DELETE endpoint not available
        if (response.status === 404) {
          appState.orders = appState.orders.filter((o) => o.id !== orderId);
          const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(appState),
          });
        } else {
          appState.orders = appState.orders.filter((o) => o.id !== orderId);
        }

        if (!response.ok) {
          throw new Error("Failed to delete order");
        }

        renderArchive();
        showToast("Order permanently deleted", "warning");
      } catch (error) {
        console.error("Error deleting order:", error);
        showToast("Failed to delete order", "error");
      }
    }
  );
}

function deleteInventory(itemId) {
  const item = appState.inventory.find((i) => i.id === itemId);
  if (!item) return;

  showDeleteConfirmation(
    "Permanently Delete Item?",
    `This will permanently delete ${item.name}. This action cannot be undone.`,
    async () => {
      try {
        const apiBase = window.API_BASE_URL || "";
        let response = await fetch(`${apiBase}/api/inventory/${itemId}`, {
          method: "DELETE",
          credentials: "include",
        });

        // Fallback to bulk save if DELETE endpoint not available
        if (response.status === 404) {
          appState.inventory = appState.inventory.filter(
            (i) => i.id !== itemId
          );
          const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(appState),
          });
        } else {
          appState.inventory = appState.inventory.filter(
            (i) => i.id !== itemId
          );
        }

        if (!response.ok) {
          throw new Error("Failed to delete item");
        }

        renderArchive();
        showToast("Item permanently deleted", "warning");
      } catch (error) {
        console.error("Error deleting item:", error);
        showToast("Failed to delete item", "error");
      }
    }
  );
}

function deleteUser(userId) {
  const user = appState.users.find((u) => u.id === userId);
  if (!user) return;

  showDeleteConfirmation(
    "Permanently Delete User?",
    `This will permanently delete ${user.name}. This action cannot be undone.`,
    async () => {
      try {
        const apiBase = window.API_BASE_URL || "";
        let response = await fetch(`${apiBase}/api/users/${userId}`, {
          method: "DELETE",
          credentials: "include",
        });

        // Fallback to bulk save if DELETE endpoint not available
        if (response.status === 404) {
          appState.users = appState.users.filter((u) => u.id !== userId);
          const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(appState),
          });
        } else {
          appState.users = appState.users.filter((u) => u.id !== userId);
        }

        if (!response.ok) {
          throw new Error("Failed to delete user");
        }

        renderArchive();
        showToast("User permanently deleted", "warning");
      } catch (error) {
        console.error("Error deleting user:", error);
        showToast("Failed to delete user", "error");
      }
    }
  );
}

// Delete Confirmation Modal
function showDeleteConfirmation(title, message, onConfirm) {
  const modal = document.getElementById("delete-confirm-modal");
  const titleEl = document.getElementById("delete-title");
  const messageEl = document.getElementById("delete-message");
  const cancelBtn = document.getElementById("delete-cancel");
  const confirmBtn = document.getElementById("delete-confirm");

  if (!modal) return;

  titleEl.textContent = title;
  messageEl.textContent = message;

  modal.setAttribute("aria-hidden", "false");

  const closeModal = () => {
    modal.setAttribute("aria-hidden", "true");
  };

  cancelBtn.onclick = closeModal;

  confirmBtn.onclick = () => {
    onConfirm();
    closeModal();
  };

  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

// Restore Attendance Log
async function restoreAttendanceLog(logId) {
  const log = appState.attendanceLogs.find((l) => l.id === logId);
  if (!log) return;

  // Check if there's already a non-archived log for this employee on the same day
  const logDate = log.timestamp.split("T")[0];
  const existingLog = appState.attendanceLogs.find(
    (l) =>
      l.id !== logId &&
      l.employeeId === log.employeeId &&
      l.timestamp.startsWith(logDate) &&
      !l.archived
  );

  if (existingLog) {
    const employee = (appState.users || []).find(
      (u) => u.id === log.employeeId
    );
    const employeeName = employee ? employee.name : "Unknown";
    showToast(
      `Cannot restore: ${employeeName} already has a log for this day`,
      "error"
    );
    return;
  }

  log.archived = false;
  log.archivedAt = null;
  log.archivedBy = null;

  try {
    await saveToDatabase();
    renderArchive();
    showToast("Attendance log restored successfully", "success");
  } catch (error) {
    console.error("Error restoring attendance log:", error);
    showToast("Failed to restore attendance log", "error");
  }
}

// Delete Attendance Log
function deleteAttendanceLog(logId) {
  const log = appState.attendanceLogs.find((l) => l.id === logId);
  if (!log) return;

  const employee = (appState.users || []).find((u) => u.id === log.employeeId);
  const employeeName = employee ? employee.name : "Unknown";

  showDeleteConfirmation(
    "Permanently Delete Log?",
    `This will permanently delete the attendance log for ${employeeName} (${formatTime(
      log.timestamp
    )}). This action cannot be undone.`,
    async () => {
      try {
        const apiBase = window.API_BASE_URL || "";
        const response = await fetch(
          `${apiBase}/api/attendance-logs/${logId}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete attendance log");
        }

        // Remove from local state
        appState.attendanceLogs = appState.attendanceLogs.filter(
          (l) => l.id !== logId
        );

        renderArchive();
        showToast("Attendance log permanently deleted", "warning");
      } catch (error) {
        console.error("Error deleting attendance log:", error);
        showToast("Failed to delete attendance log", "error");
      }
    }
  );
}

// Save to Database
async function saveToDatabase() {
  try {
    const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(appState),
    });

    if (!response.ok) {
      console.error("Failed to save to database");
    }
  } catch (error) {
    console.error("Error saving to database:", error);
  }
}

// Toast Notification
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  const bgColor =
    type === "success" ? "#4caf50" : type === "warning" ? "#ff9800" : "#f44336";

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOutRight 0.3s ease-out";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Render Archived Usage Logs
function renderArchivedUsageLogs() {
  const tbody = document.querySelector("#archive-usage-logs-table tbody");
  if (!tbody) return;

  // Fetch from appState - will be loaded by getAppState
  const archivedLogs = (appState.inventoryUsageLogs || []).filter(
    (log) => log.archived
  );

  tbody.innerHTML = "";

  if (archivedLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-archive">
          <div class="empty-archive-icon">📊</div>
          <div>No archived usage logs</div>
        </td>
      </tr>
    `;
    return;
  }

  // Group logs by batch_id
  const groupedLogs = {};
  const standaloneLogIds = [];

  archivedLogs.forEach((log) => {
    if (log.batchId) {
      if (!groupedLogs[log.batchId]) {
        groupedLogs[log.batchId] = [];
      }
      groupedLogs[log.batchId].push(log);
    } else {
      standaloneLogIds.push(log.id);
    }
  });

  // Render batched entries
  Object.entries(groupedLogs).forEach(([batchId, batchLogs]) => {
    // Sort batch logs by timestamp
    batchLogs.sort(
      (a, b) =>
        new Date(b.timestamp || b.created_at) -
        new Date(a.timestamp || a.created_at)
    );

    const firstLog = batchLogs[0];

    // Combine all items from the batch
    const itemAndQty = batchLogs
      .map((log) => {
        const inventoryItem = (appState.inventory || []).find(
          (item) =>
            item.id === log.inventory_item_id || item.id === log.inventoryItemId
        );
        const itemName = inventoryItem ? inventoryItem.name : "Unknown Item";
        const unit = inventoryItem?.unit || "";
        return `${itemName} (${log.quantity} ${unit})`;
      })
      .join("<br>");

    // Get recorded by user name
    let recordedByName = "--";
    const createdById = firstLog.createdBy || firstLog.created_by;
    if (createdById) {
      const createdByUser = (appState.users || []).find(
        (u) => u.id === createdById
      );
      recordedByName = createdByUser ? createdByUser.name : createdById;
    }

    // Get archived by user name
    let archivedByName = "--";
    const archivedById = firstLog.archivedBy || firstLog.archived_by;
    if (archivedById) {
      const archivedByUser = (appState.users || []).find(
        (u) => u.id === archivedById
      );
      archivedByName = archivedByUser ? archivedByUser.name : "Unknown";
    }

    // Parse the date properly - handle both ISO strings and locale strings
    let displayDate = "N/A";
    const dateValue =
      firstLog.createdAt || firstLog.created_at || firstLog.timestamp;
    if (dateValue) {
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) {
        displayDate = parsedDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${itemAndQty}</strong></td>
      <td><span class="pill" style="background: #e3f2fd; color: #1565c0; font-size: 0.75rem">${
        firstLog.reason || "--"
      }</span></td>
      <td>${firstLog.notes || "--"}</td>
      <td>${displayDate}</td>
      <td>${recordedByName}</td>
      <td>${archivedByName}</td>
      <td class="archive-actions">
        <button class="btn btn-outline btn-sm btn-restore" data-restore-batch="${batchId}">Restore</button>
        <button class="btn btn-warning btn-sm btn-permanent-delete" data-delete-batch="${batchId}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Render standalone entries
  standaloneLogIds.forEach((logId) => {
    const log = archivedLogs.find((l) => l.id === logId);
    if (!log) return;

    const inventoryItem = (appState.inventory || []).find(
      (item) =>
        item.id === log.inventory_item_id || item.id === log.inventoryItemId
    );
    const itemName = inventoryItem ? inventoryItem.name : "Unknown Item";
    const unit = inventoryItem?.unit || "";
    const itemAndQty = `${itemName} (${log.quantity} ${unit})`;

    // Get recorded by user name
    let recordedByName = "--";
    const createdById = log.createdBy || log.created_by;
    if (createdById) {
      const createdByUser = (appState.users || []).find(
        (u) => u.id === createdById
      );
      recordedByName = createdByUser ? createdByUser.name : createdById;
    }

    // Get archived by user name
    let archivedByName = "--";
    const archivedById = log.archivedBy || log.archived_by;
    if (archivedById) {
      const archivedByUser = (appState.users || []).find(
        (u) => u.id === archivedById
      );
      archivedByName = archivedByUser ? archivedByUser.name : "Unknown";
    }

    // Parse the date properly - handle both ISO strings and locale strings
    let displayDate = "N/A";
    const dateValue = log.createdAt || log.created_at || log.timestamp;
    if (dateValue) {
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) {
        displayDate = parsedDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${itemAndQty}</strong></td>
      <td><span class="pill" style="background: #e3f2fd; color: #1565c0; font-size: 0.75rem">${
        log.reason || "--"
      }</span></td>
      <td>${log.notes || "--"}</td>
      <td>${displayDate}</td>
      <td>${recordedByName}</td>
      <td>${archivedByName}</td>
      <td class="archive-actions">
        <button class="btn btn-outline btn-sm btn-restore" data-restore-usage-log="${
          log.id
        }">Restore</button>
        <button class="btn btn-warning btn-sm btn-permanent-delete" data-delete-usage-log="${
          log.id
        }">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Attach event listeners for standalone logs
  document.querySelectorAll("[data-restore-usage-log]").forEach((btn) => {
    btn.addEventListener("click", () =>
      restoreUsageLog(btn.dataset.restoreUsageLog)
    );
  });

  document.querySelectorAll("[data-delete-usage-log]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteUsageLog(btn.dataset.deleteUsageLog)
    );
  });

  // Attach event listeners for batch logs
  document.querySelectorAll("[data-restore-batch]").forEach((btn) => {
    btn.addEventListener("click", () =>
      restoreBatchUsageLogs(btn.dataset.restoreBatch)
    );
  });

  document.querySelectorAll("[data-delete-batch]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteBatchUsageLogs(btn.dataset.deleteBatch)
    );
  });
}

// Restore Usage Log
async function restoreUsageLog(logId) {
  const log = (appState.inventoryUsageLogs || []).find((l) => l.id == logId);
  if (!log) return;

  const confirmed = await showConfirmAlert(
    "Restore Usage Log",
    `Are you sure you want to restore this usage log?`
  );

  if (!confirmed) return;

  showLoading("Restoring usage log...");

  log.archived = false;
  log.archivedAt = null;
  log.archivedBy = null;

  try {
    const response = await fetch(
      `${window.API_BASE_URL || ""}/api/inventory-usage-logs/${logId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(log),
      }
    );

    hideLoading();

    if (!response.ok) throw new Error("Failed to restore");

    showAlert("Usage log restored successfully!", "success");
    renderArchive();
  } catch (error) {
    hideLoading();
    console.error("Error restoring usage log:", error);
    showAlert("Failed to restore usage log", "error");
  }
}

// Restore all usage logs in a batch
async function restoreBatchUsageLogs(batchId) {
  const batchLogs = (appState.inventoryUsageLogs || []).filter(
    (log) => log.batchId === batchId && log.archived
  );

  if (batchLogs.length === 0) return;

  const confirmed = await showConfirmAlert(
    "Restore Batch Logs",
    `Are you sure you want to restore all ${batchLogs.length} logs in this batch?`
  );

  if (!confirmed) return;

  showLoading("Restoring batch logs...");

  try {
    const restorePromises = batchLogs.map((log) => {
      log.archived = false;
      log.archivedAt = null;
      log.archivedBy = null;

      return fetch(
        `${window.API_BASE_URL || ""}/api/inventory-usage-logs/${log.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(log),
        }
      );
    });

    const results = await Promise.all(restorePromises);
    const allSuccess = results.every((res) => res.ok);

    hideLoading();

    if (!allSuccess) throw new Error("Failed to restore some logs");

    showAlert("Batch logs restored successfully!", "success");
    renderArchive();
  } catch (error) {
    hideLoading();
    console.error("Error restoring batch logs:", error);
    showAlert("Failed to restore batch logs", "error");
  }
}

// Delete Usage Log
async function deleteUsageLog(logId) {
  const confirmed = await showConfirmAlert(
    "Permanently Delete Usage Log",
    "This action cannot be undone. The usage log will be permanently deleted."
  );

  if (!confirmed) return;

  showLoading("Deleting usage log...");

  try {
    const response = await fetch(
      `${window.API_BASE_URL || ""}/api/inventory-usage-logs/${logId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    hideLoading();

    if (!response.ok) throw new Error("Failed to delete");

    // Remove from appState
    appState.inventoryUsageLogs = (appState.inventoryUsageLogs || []).filter(
      (l) => l.id != logId
    );

    showAlert("Usage log permanently deleted", "success");
    renderArchive();
  } catch (error) {
    hideLoading();
    console.error("Error deleting usage log:", error);
    showAlert("Failed to delete usage log", "error");
  }
}

// Delete all usage logs in a batch
async function deleteBatchUsageLogs(batchId) {
  const batchLogs = (appState.inventoryUsageLogs || []).filter(
    (log) => log.batchId === batchId
  );

  if (batchLogs.length === 0) return;

  const confirmed = await showConfirmAlert(
    "Permanently Delete Batch Logs",
    `This action cannot be undone. All ${batchLogs.length} logs in this batch will be permanently deleted.`
  );

  if (!confirmed) return;

  showLoading("Deleting batch logs...");

  try {
    const deletePromises = batchLogs.map((log) =>
      fetch(`${window.API_BASE_URL || ""}/api/inventory-usage-logs/${log.id}`, {
        method: "DELETE",
        credentials: "include",
      })
    );

    const results = await Promise.all(deletePromises);
    const allSuccess = results.every((res) => res.ok);

    hideLoading();

    if (!allSuccess) throw new Error("Failed to delete some logs");

    // Remove from appState
    appState.inventoryUsageLogs = (appState.inventoryUsageLogs || []).filter(
      (l) => l.batchId !== batchId
    );

    showAlert("Batch logs permanently deleted", "success");
    renderArchive();
  } catch (error) {
    hideLoading();
    console.error("Error deleting batch logs:", error);
    showAlert("Failed to delete batch logs", "error");
  }
}

// Page renderer
window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["archive"] = function () {
  initializeArchive();
};
