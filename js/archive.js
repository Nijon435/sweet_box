// Archive page functionality

let currentTab = "orders";

function initializeArchive() {
  setupTabs();
  setupRefreshButton();
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

function renderArchive() {
  if (currentTab === "orders") {
    renderArchivedOrders();
  } else if (currentTab === "inventory") {
    renderArchivedInventory();
  } else if (currentTab === "users") {
    renderArchivedUsers();
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
        <td colspan="6" class="empty-archive">
          <div class="empty-archive-icon">📦</div>
          <div>No archived orders</div>
        </td>
      </tr>
    `;
    return;
  }

  archivedOrders.forEach((order) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${order.id}</strong></td>
      <td>${order.customer}</td>
      <td>${formatCurrency(order.total)}</td>
      <td>${formatTime(order.timestamp)}</td>
      <td>${order.archivedAt ? formatTime(order.archivedAt) : "--"}</td>
      <td class="archive-actions">
        <button class="btn-restore" data-restore-order="${
          order.id
        }">Restore</button>
        <button class="btn-permanent-delete" data-delete-order="${
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
        <td colspan="6" class="empty-archive">
          <div class="empty-archive-icon">📋</div>
          <div>No archived inventory items</div>
        </td>
      </tr>
    `;
    return;
  }

  archivedItems.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${item.category || "--"}</td>
      <td>${item.quantity || 0}</td>
      <td>${item.unit || "--"}</td>
      <td>${item.archivedAt ? formatTime(item.archivedAt) : "--"}</td>
      <td class="archive-actions">
        <button class="btn-restore" data-restore-inventory="${
          item.id
        }">Restore</button>
        <button class="btn-permanent-delete" data-delete-inventory="${
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
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${user.name}</strong></td>
      <td>${user.email || "--"}</td>
      <td>${user.role || "--"}</td>
      <td>${user.permission || "--"}</td>
      <td>${user.archivedAt ? formatTime(user.archivedAt) : "--"}</td>
      <td class="archive-actions">
        <button class="btn-restore" data-restore-user="${
          user.id
        }">Restore</button>
        <button class="btn-permanent-delete" data-delete-user="${
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

// Restore Functions
async function restoreOrder(orderId) {
  const order = appState.orders.find((o) => o.id === orderId);
  if (!order) return;

  order.archived = false;
  order.archivedAt = null;
  order.archivedBy = null;

  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(order),
    });

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
    const response = await fetch(`/api/inventory/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(item),
    });

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
    const response = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(user),
    });

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
        const response = await fetch(`/api/orders/${orderId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to delete order");
        }

        appState.orders = appState.orders.filter((o) => o.id !== orderId);
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
        const response = await fetch(`/api/inventory/${itemId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to delete item");
        }

        appState.inventory = appState.inventory.filter((i) => i.id !== itemId);
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
        const response = await fetch(`/api/users/${userId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to delete user");
        }

        appState.users = appState.users.filter((u) => u.id !== userId);
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

// Page renderer
window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["archive"] = function () {
  initializeArchive();
};
