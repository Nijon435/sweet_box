// Global state for filters
let currentFilters = {
  search: "",
  category: "",
  unit: "",
  status: "",
};

// Pagination state
let currentPage = 1;
const itemsPerPage = 20;

function renderInventory() {
  renderMetrics();
  setupForms();
  renderUnifiedTable();
  setupFilters();
  setupRecordUsageButton();
  updateAlert();
}

function renderMetrics() {
  const inventory = (appState.inventory || []).filter((item) => !item.archived);

  // Calculate metrics
  const totalSKUs = inventory.length;

  const lowStockItems = inventory.filter((item) => {
    // Get unit-specific reorder point, fallback to 10 if not set
    const reorderPoint = item.reorderPoint || item.reorder_point || 10;
    return item.quantity < reorderPoint && item.quantity > 0;
  });

  const expiringItems = inventory.filter((item) => {
    const useByDate = item.useByDate || item.use_by_date;
    if (!useByDate) return false;
    const daysUntilExpiry = Math.floor(
      (new Date(useByDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  });

  const expiredItems = inventory.filter((item) => {
    const expiryDate = item.expiryDate || item.expiry_date;
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  });

  const totalValue = inventory.reduce(
    (sum, item) => sum + item.quantity * item.cost,
    0
  );

  // Update UI
  const metricElements = {
    "metric-total-skus": totalSKUs,
    "metric-low-stock": lowStockItems.length,
    "metric-expiring-soon": expiringItems.length,
    "metric-expired": expiredItems.length,
    "metric-total-value": formatCurrency(totalValue),
  };

  Object.entries(metricElements).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

function getItemStatus(item) {
  // Get unit-specific reorder point, fallback to 10 if not set
  const reorderPoint = item.reorderPoint || item.reorder_point || 10;
  const useByDate = item.useByDate || item.use_by_date;

  // Check stock levels first (highest priority)
  if (item.quantity === 0)
    return {
      status: "out-of-stock",
      text: "Out of Stock",
      class: "out-of-stock",
    };

  // Then check expiration (only if in stock)
  if (useByDate) {
    const daysUntilExpiry = Math.floor(
      (new Date(useByDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry < 0)
      return { status: "expired", text: "Expired", class: "out-of-stock" };
    if (daysUntilExpiry <= 7)
      return { status: "expiring-soon", text: "Expiring Soon", class: "late" };
  }

  // Finally check low stock
  if (item.quantity < reorderPoint)
    return { status: "low-stock", text: "Low Stock", class: "late" };

  return { status: "in-stock", text: "In Stock", class: "present" };
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderUnifiedTable() {
  const tbody = document.getElementById("unified-inventory-tbody");
  if (!tbody) return;

  const inventory = (appState.inventory || []).filter((item) => !item.archived);

  // Apply filters
  const filteredInventory = inventory.filter((item) => {
    // Search filter
    if (currentFilters.search) {
      const searchLower = currentFilters.search.toLowerCase();
      const itemName = (item.name || "").toLowerCase();
      const itemCategory = (item.category || "").toLowerCase();
      if (
        !itemName.includes(searchLower) &&
        !itemCategory.includes(searchLower)
      ) {
        return false;
      }
    }

    // Category filter
    if (currentFilters.category && item.category !== currentFilters.category) {
      return false;
    }

    // Status filter
    if (currentFilters.status) {
      const itemStatus = getItemStatus(item);
      if (itemStatus.status !== currentFilters.status) {
        return false;
      }
    }

    // Unit filter
    if (currentFilters.unit && item.unit !== currentFilters.unit) {
      return false;
    }

    return true;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageItems = filteredInventory.slice(startIdx, endIdx);

  // Update pagination UI
  updatePaginationControls(totalPages);

  if (filteredInventory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: #999">
          No inventory items found matching your filters
        </td>
      </tr>
    `;
    return;
  }

  const canManageInventory = isAdmin();

  tbody.innerHTML = pageItems
    .map((item) => {
      const statusInfo = getItemStatus(item);
      const datePurchased = item.datePurchased || item.date_purchased;
      const useByDate = item.useByDate || item.use_by_date;
      const unit = item.unit || "pieces";

      return `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td><span class="pill" style="background: #e3f2fd; color: #1565c0; font-size: 0.75rem">${
          item.category
        }</span></td>
        <td>${item.quantity}</td>
        <td>${unit}</td>
        <td>${formatCurrency(item.cost)}</td>
        <td>${formatDate(datePurchased)}</td>
        <td>${formatDate(useByDate)}</td>
        <td><span class="status ${
          statusInfo.class
        }"><span class="status-text">${statusInfo.text}</span></span></td>
        <td class="table-actions">
          <button class="btn btn-outline" data-edit="${item.id}" ${
        !canManageInventory ? "disabled" : ""
      }>Edit</button>
          <button class="btn btn-warning" data-archive="${item.id}" ${
        !canManageInventory ? "disabled" : ""
      }>Archive</button>
        </td>
      </tr>
    `;
    })
    .join("");

  // Attach event listeners
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.edit;
      const item = inventory.find((i) => i.id === id);
      if (item) openEditModal(item);
    });
  });

  document.querySelectorAll("[data-archive]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.archive;
      const item = appState.inventory.find((i) => i.id === id);
      if (!item) return;
      if (confirm(`Archive ${item.name}? This will move it to the archive.`)) {
        const currentUser = getCurrentUser();
        item.archived = true;
        item.archivedAt = new Date().toISOString();
        item.archivedBy = currentUser?.id || null;

        // Save to database using individual endpoint
        showLoading("Archiving item...");
        try {
          const apiBase = window.API_BASE_URL || "";
          let response = await fetch(`${apiBase}/api/inventory/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(item),
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
            throw new Error("Failed to archive item");
          }

          hideLoading();
          renderInventory();
          alert("Item archived successfully");
        } catch (error) {
          hideLoading();
          console.error("Error archiving item:", error);
          alert("Failed to archive item");
          return;
        }
      }
    });
  });
}

function setupFilters() {
  const searchInput = document.getElementById("unified-search");
  const categoryFilter = document.getElementById("category-filter");
  const statusFilter = document.getElementById("status-filter");
  const unitFilter = document.getElementById("unit-filter");

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", (e) => {
      currentFilters.search = e.target.value;
      currentPage = 1; // Reset to first page on filter change
      renderUnifiedTable();
    });
  }

  if (categoryFilter && !categoryFilter.dataset.bound) {
    categoryFilter.dataset.bound = "true";
    categoryFilter.addEventListener("change", (e) => {
      currentFilters.category = e.target.value;
      currentPage = 1; // Reset to first page on filter change
      renderUnifiedTable();
    });
  }

  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.dataset.bound = "true";
    statusFilter.addEventListener("change", (e) => {
      currentFilters.status = e.target.value;
      currentPage = 1; // Reset to first page on filter change
      renderUnifiedTable();
    });
  }

  if (unitFilter && !unitFilter.dataset.bound) {
    unitFilter.dataset.bound = "true";
    unitFilter.addEventListener("change", (e) => {
      currentFilters.unit = e.target.value;
      currentPage = 1; // Reset to first page on filter change
      renderUnifiedTable();
    });
  }
}

function setupForms() {
  setupAddModal();
  setupEditModal();
}

function setupAddModal() {
  const addBtn = document.getElementById("add-item-btn");
  const addModal = document.getElementById("inventory-add-modal");
  const addForm = document.getElementById("inventory-form");
  const addClose = document.getElementById("inventory-add-close");
  const addCancel = document.getElementById("inventory-add-cancel");

  // Add button click
  if (addBtn && !addBtn.dataset.bound) {
    addBtn.dataset.bound = "true";
    addBtn.addEventListener("click", () => {
      if (!isAdmin()) {
        alert("Only administrators can add inventory items.");
        return;
      }
      openAddModal();
    });
  }

  // Close buttons
  if (addClose && !addClose.dataset.bound) {
    addClose.dataset.bound = "true";
    addClose.addEventListener("click", closeAddModal);
  }

  if (addCancel && !addCancel.dataset.bound) {
    addCancel.dataset.bound = "true";
    addCancel.addEventListener("click", closeAddModal);
  }

  // Click outside to close
  if (addModal && !addModal.dataset.bound) {
    addModal.dataset.bound = "true";
    addModal.addEventListener("click", (e) => {
      if (e.target === addModal) closeAddModal();
    });
  }

  // Form submission
  if (addForm && !addForm.dataset.bound) {
    addForm.dataset.bound = "true";
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!isAdmin()) {
        alert("Only administrators can add inventory items.");
        return;
      }

      const data = new FormData(addForm);
      const payload = {
        id: `inv-${Date.now()}`,
        category: data.get("category"),
        name: data.get("name"),
        quantity: Number(data.get("quantity")) || 0,
        cost: Number(data.get("cost")) || 0,
        datePurchased: data.get("datePurchased") || null,
        useByDate: data.get("useByDate") || null,
        reorderPoint: Number(data.get("reorderPoint")) || 10,
        unit: data.get("unit") || "pieces",
        lastRestocked: new Date().toISOString().split("T")[0],
        totalUsed: 0,
      };

      if (!payload.category || !payload.name) {
        alert("Please fill in all required fields.");
        return;
      }

      appState.inventory.push(payload);

      // Save to database using individual endpoint
      (async () => {
        showLoading("Adding item...");
        try {
          const apiBase = window.API_BASE_URL || "";
          let response = await fetch(`${apiBase}/api/inventory/${payload.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
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
            throw new Error("Failed to add inventory item");
          }

          hideLoading();
          closeAddModal();
          renderInventory();
          alert("Inventory item added successfully!");
        } catch (error) {
          hideLoading();
          console.error("Error adding inventory item:", error);
          alert("Failed to add inventory item");
        }
      })();
    });
  }
}

function openAddModal() {
  const addModal = document.getElementById("inventory-add-modal");
  const addForm = document.getElementById("inventory-form");
  if (!addModal || !addForm) return;

  addForm.reset();
  addModal.classList.add("active");
}

function closeAddModal() {
  const addModal = document.getElementById("inventory-add-modal");
  const addForm = document.getElementById("inventory-form");
  if (!addModal || !addForm) return;

  addModal.classList.remove("active");
  addForm.reset();
}

function setupMainForm() {
  // This function is no longer needed as form is in modal
  // Kept for compatibility, actual form setup is in setupAddModal
}

function setupEditModal() {
  const editModal = document.getElementById("inventory-edit-modal");
  const editForm = document.getElementById("inventory-edit-form");
  const editClose = document.getElementById("inventory-edit-close");
  const editCancel = document.getElementById("inventory-edit-cancel");

  if (editClose && !editClose.dataset.bound) {
    editClose.dataset.bound = "true";
    editClose.addEventListener("click", closeEditModal);
  }

  if (editCancel && !editCancel.dataset.bound) {
    editCancel.dataset.bound = "true";
    editCancel.addEventListener("click", closeEditModal);
  }

  if (editModal && !editModal.dataset.bound) {
    editModal.dataset.bound = "true";
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) closeEditModal();
    });
  }

  if (editForm && !editForm.dataset.bound) {
    editForm.dataset.bound = "true";
    editForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!isAdmin()) {
        alert("Only administrators can update inventory records.");
        return;
      }

      const itemId = editForm.dataset.itemId;
      if (!itemId) {
        closeEditModal();
        return;
      }

      const idx = appState.inventory.findIndex((i) => i.id === itemId);
      if (idx < 0) {
        closeEditModal();
        return;
      }

      const data = new FormData(editForm);
      const updated = {
        ...appState.inventory[idx],
        category: data.get("category"),
        name: data.get("name"),
        quantity: Number(data.get("quantity")) || 0,
        cost: Number(data.get("cost")) || 0,
        datePurchased: data.get("datePurchased") || null,
        useByDate: data.get("useByDate") || null,
        reorderPoint: Number(data.get("reorderPoint")) || 10,
        unit: data.get("unit") || "pieces",
      };

      appState.inventory[idx] = updated;

      // Save to database using individual endpoint
      (async () => {
        showLoading("Saving changes...");
        try {
          const apiBase = window.API_BASE_URL || "";
          let response = await fetch(`${apiBase}/api/inventory/${itemId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(updated),
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
            throw new Error("Failed to update inventory");
          }

          hideLoading();
          closeEditModal();
          renderInventory();
          alert("Inventory item updated successfully!");
        } catch (error) {
          hideLoading();
          console.error("Error updating inventory:", error);
          alert("Failed to update inventory item");
        }
      })();
    });
  }
}

function openEditModal(item) {
  const editModal = document.getElementById("inventory-edit-modal");
  const editForm = document.getElementById("inventory-edit-form");
  if (!editModal || !editForm) return;

  editForm.dataset.itemId = item.id;

  // Set form values
  const categoryField = editForm.querySelector("[name=category]");
  const nameField = editForm.querySelector("[name=name]");
  const qtyField = editForm.querySelector("[name=quantity]");
  const costField = editForm.querySelector("[name=cost]");
  const datePurchasedField = editForm.querySelector("[name=datePurchased]");
  const useByDateField = editForm.querySelector("[name=useByDate]");
  const reorderPointField = editForm.querySelector("[name=reorderPoint]");
  const unitField = editForm.querySelector("[name=unit]");

  if (categoryField) categoryField.value = item.category || "";
  if (nameField) nameField.value = item.name || "";
  if (qtyField) qtyField.value = item.quantity || 0;
  if (costField) costField.value = item.cost || 0;
  if (datePurchasedField)
    datePurchasedField.value = item.datePurchased || item.date_purchased || "";
  if (useByDateField)
    useByDateField.value = item.useByDate || item.use_by_date || "";
  if (reorderPointField)
    reorderPointField.value = item.reorderPoint || item.reorder_point || 10;
  if (unitField) unitField.value = item.unit || "pieces";

  editModal.classList.add("active");
}

function closeEditModal() {
  const editModal = document.getElementById("inventory-edit-modal");
  const editForm = document.getElementById("inventory-edit-form");
  if (!editModal || !editForm) return;

  editModal.classList.remove("active");
  editForm.reset();
  delete editForm.dataset.itemId;
}

function setupRecordUsageButton() {
  const recordUsageBtn = document.getElementById("log-usage-btn");
  const modal = document.getElementById("log-usage-modal");
  const closeBtn = document.getElementById("log-usage-close");
  const cancelBtn = document.getElementById("log-usage-cancel");
  const form = document.getElementById("log-usage-form");
  const select = document.getElementById("usage-ingredient-select");

  if (!recordUsageBtn || !modal || !form || !select) return;

  // Populate ingredient dropdown with ALL inventory items
  function populateItemSelect() {
    const allItems = appState.inventory || [];
    select.innerHTML = '<option value="">Choose item...</option>';

    // Group by category for better UX
    const categories = [...new Set(allItems.map((i) => i.category))].sort();
    categories.forEach((category) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = category.charAt(0).toUpperCase() + category.slice(1);

      const itemsInCategory = allItems.filter((i) => i.category === category);
      itemsInCategory.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.dataset.unit = item.unit || "units";
        opt.textContent = `${item.name} (${item.quantity} ${
          item.unit || "units"
        })`;
        optgroup.appendChild(opt);
      });

      select.appendChild(optgroup);
    });
  }

  // Update unit label when item is selected
  select.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];
    const unit = selectedOption.dataset.unit || "units";
    const qtyInput = document.getElementById("usage-quantity");
    if (qtyInput) {
      qtyInput.placeholder = `Enter quantity in ${unit}`;
    }
  });

  // Open modal
  recordUsageBtn.addEventListener("click", () => {
    populateItemSelect();
    modal.classList.add("active");
    form.reset();
  });

  // Close modal
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
  }

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  // Handle form submission
  if (form.dataset.bound) return;
  form.dataset.bound = "true";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const ingredientId = data.get("itemId");
    const qty = Number(data.get("quantity"));
    const usageReason = data.get("reason");
    const notes = data.get("notes") || "";

    const idx = appState.inventory.findIndex((i) => i.id === ingredientId);
    if (idx < 0) {
      alert("Item not found");
      return;
    }

    const item = appState.inventory[idx];

    if (item.quantity < qty) {
      alert(
        `Insufficient quantity. Available: ${item.quantity} ${
          item.unit || "units"
        }`
      );
      return;
    }

    // Deduct from inventory
    item.quantity -= qty;

    // Log ingredient usage with the new system
    if (typeof logIngredientUsage === "function") {
      logIngredientUsage(
        ingredientId,
        qty,
        usageReason,
        null, // No order ID for manual logging
        notes || `${usageReason}: ${item.name}`
      );
    }

    // Also update totalUsed for backward compatibility
    const currentTotalUsed = item.totalUsed || item.total_used || 0;
    item.totalUsed = currentTotalUsed + qty;

    saveState();
    renderInventory();
    modal.classList.remove("active");
    form.reset();

    const reasonLabels = {
      waste: "Waste",
      spoilage: "Spoilage",
      testing: "Testing",
      staff_consumption: "Staff Consumption",
      other: "Other",
    };

    alert(
      `Logged: ${qty} ${item.unit || "units"} of ${item.name} used for ${
        reasonLabels[usageReason] || usageReason
      }`
    );
  });
}

function updateAlert() {
  const alertPanel = document.getElementById("inventory-alert");
  if (!alertPanel) return;

  const inventory = appState.inventory || [];
  const lowItems = inventory.filter((item) => {
    const reorderPoint = item.reorderPoint || item.reorder_point || 10;
    return item.quantity < reorderPoint && item.quantity > 0;
  });

  const expiringItems = inventory.filter((item) => {
    const useByDate = item.useByDate || item.use_by_date;
    if (!useByDate) return false;
    const daysUntilExpiry = Math.floor(
      (new Date(useByDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  });

  const totalAlerts = lowItems.length + expiringItems.length;

  if (totalAlerts === 0) {
    alertPanel.className = "alert-panel good";
    alertPanel.innerHTML = `<strong>Inventory healthy</strong><p>All items are properly stocked and fresh.</p>`;
  } else {
    const severity = totalAlerts > 5 ? "alert" : "warning";
    alertPanel.className = `alert-panel ${severity}`;

    const alerts = [];
    if (lowItems.length > 0) {
      alerts.push(
        `${lowItems.length} low-stock item${lowItems.length !== 1 ? "s" : ""}`
      );
    }
    if (expiringItems.length > 0) {
      alerts.push(`${expiringItems.length} expiring soon`);
    }

    const preview = [...lowItems.slice(0, 3), ...expiringItems.slice(0, 3)]
      .slice(0, 4)
      .map((item) => `<span class="alert-tag">${item.name}</span>`)
      .join("");

    const extraCount = totalAlerts - 4;

    alertPanel.innerHTML = `
      <strong>${alerts.join(" • ")}</strong>
      <p>Action required to maintain inventory health.</p>
      <div class="alert-tags">
        ${preview}
        ${
          extraCount > 0
            ? `<span class="alert-tag">+${extraCount} more</span>`
            : ""
        }
      </div>
    `;
  }
}

// Pagination functions
function updatePaginationControls(totalPages) {
  const currentPageEl = document.getElementById("inventory-current-page");
  const totalPagesEl = document.getElementById("inventory-total-pages");
  const prevBtn = document.getElementById("inventory-prev-btn");
  const nextBtn = document.getElementById("inventory-next-btn");
  const pagination = document.getElementById("inventory-pagination");

  if (!currentPageEl || !totalPagesEl || !prevBtn || !nextBtn) return;

  // Hide pagination if only one page
  if (totalPages <= 1) {
    pagination.style.display = "none";
    return;
  } else {
    pagination.style.display = "flex";
  }

  currentPageEl.textContent = currentPage;
  totalPagesEl.textContent = totalPages;

  // Enable/disable buttons
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function inventoryPreviousPage() {
  if (currentPage > 1) {
    currentPage--;
    renderUnifiedTable();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function inventoryNextPage() {
  const inventory = appState.inventory || [];
  const filteredInventory = inventory.filter((item) => {
    if (currentFilters.search) {
      const searchLower = currentFilters.search.toLowerCase();
      const itemName = (item.name || "").toLowerCase();
      const itemCategory = (item.category || "").toLowerCase();
      if (
        !itemName.includes(searchLower) &&
        !itemCategory.includes(searchLower)
      ) {
        return false;
      }
    }
    if (currentFilters.category && item.category !== currentFilters.category) {
      return false;
    }
    if (currentFilters.status) {
      const itemStatus = getItemStatus(item);
      if (itemStatus.status !== currentFilters.status) {
        return false;
      }
    }
    if (currentFilters.unit && item.unit !== currentFilters.unit) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderUnifiedTable();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// Tab switching functionality
function setupInventoryTabs() {
  const tabs = document.querySelectorAll(".inventory-tab");
  const allItemsSection = document.getElementById("all-items-section");
  const usageLogsSection = document.getElementById("usage-logs-section");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;

      // Update active tab
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Show/hide sections
      if (targetTab === "all-items") {
        allItemsSection.style.display = "block";
        usageLogsSection.style.display = "none";
      } else if (targetTab === "usage-logs") {
        allItemsSection.style.display = "none";
        usageLogsSection.style.display = "block";
        loadUsageLogs();
      }
    });
  });
}

// Load usage logs from database
async function loadUsageLogs() {
  try {
    const response = await fetch(`${API_BASE}/inventory_usage`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error("Failed to fetch usage logs");

    const logs = await response.json();
    renderUsageLogs(logs);
  } catch (error) {
    console.error("Error loading usage logs:", error);
    renderUsageLogs([]);
  }
}

// Render usage logs table
function renderUsageLogs(logs) {
  const tbody = document.querySelector("#usage-logs-table tbody");
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: #666;">
          No usage logs recorded yet
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs
    .map((log) => {
      const timestamp = new Date(log.timestamp || log.created_at);
      const formattedDate = timestamp.toLocaleDateString();
      const formattedTime = timestamp.toLocaleTimeString();
      const item = appState.inventory?.find(
        (i) => i.id === log.inventory_item_id
      );
      const itemName = item ? item.name : `Item #${log.inventory_item_id}`;
      const quantity = log.quantity || 0;
      const unit = item?.unit || "";
      const reason = log.reason || "N/A";
      const notes = log.notes || "-";
      const recordedBy = log.user_name || "System";

      return `
      <tr>
        <td>${formattedDate} ${formattedTime}</td>
        <td>${itemName}</td>
        <td>${quantity} ${unit}</td>
        <td>${formatReason(reason)}</td>
        <td>${notes}</td>
        <td>${recordedBy}</td>
      </tr>
    `;
    })
    .join("");
}

// Format reason text for display
function formatReason(reason) {
  const reasonMap = {
    waste: "Waste",
    spoilage: "Spoilage",
    testing: "Testing",
    staff_consumption: "Staff Consumption",
    production: "Production",
    other: "Other",
  };
  return reasonMap[reason] || reason;
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["inventory"] = function () {
  renderInventory();
  setupInventoryTabs();
};
