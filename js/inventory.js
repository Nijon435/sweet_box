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

// Usage logs pagination state
let usageLogsCurrentPage = 1;
const usageLogsItemsPerPage = 20;

function renderInventory() {
  renderMetrics();
  setupForms();
  renderUnifiedTable();
  setupFilters();
  setupRecordUsageButton();
  updateAlert();
}

// Check if user can manage inventory (admin, manager, or employee)
function canManageInventory() {
  const user = getCurrentUser();
  if (!user) return false;
  const permission = user.permission || "";
  return ["admin", "manager", "kitchen_staff", "front_staff"].includes(
    permission
  );
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

  const canManage = canManageInventory();

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
          <button class="btn btn-outline btn-sm" data-edit="${item.id}" ${
        !canManage ? "disabled" : ""
      }>Edit</button>
          <button class="btn btn-warning btn-sm" data-archive="${item.id}" ${
        !canManage ? "disabled" : ""
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

      const confirmed = await showConfirmAlert(
        "Archive Item",
        `Archive ${item.name}? This will move it to the archive.`
      );

      if (confirmed) {
        const currentUser = getCurrentUser();
        item.archived = true;
        item.archivedAt = getLocalTimestamp();
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
          showAlert("Item archived successfully!", "success");
        } catch (error) {
          hideLoading();
          console.error("Error archiving item:", error);
          showAlert("Failed to archive item", "error");
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
        showAlert("Only administrators can add inventory items.", "warning");
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
        showAlert("Only administrators can add inventory items.", "warning");
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
        showAlert("Please fill in all required fields.", "warning");
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
          showAlert("Inventory item added successfully!", "success");
        } catch (error) {
          hideLoading();
          console.error("Error adding inventory item:", error);
          showAlert("Failed to add inventory item", "error");
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
        showAlert(
          "Only administrators can update inventory records.",
          "warning"
        );
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
          showAlert("Inventory item updated successfully!", "success");
        } catch (error) {
          hideLoading();
          console.error("Error updating inventory:", error);
          showAlert("Failed to update inventory item", "error");
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
  const cancelBtn = document.getElementById("log-usage-cancel");
  const form = document.getElementById("log-usage-form");
  const itemsListContainer = document.getElementById("usage-items-list");
  const ingredientsGrid = document.getElementById("ingredients-grid");
  const searchInput = document.getElementById("ingredient-search");

  if (!form || !itemsListContainer || !ingredientsGrid) return;

  // Make usageItems accessible globally for form submission
  window.usageItems = [];
  let currentIngredient = null;

  // Populate ingredients grid
  window.populateIngredientsGrid = function (filterText = "") {
    const allItems = (appState.inventory || []).filter(
      (i) => !i.archived && i.category === "ingredients"
    );

    const filteredItems = filterText
      ? allItems.filter((item) =>
          item.name.toLowerCase().includes(filterText.toLowerCase())
        )
      : allItems;

    if (filteredItems.length === 0) {
      ingredientsGrid.innerHTML =
        '<p style="color: #9ca3af; text-align: center; padding: 2rem;">No ingredients found</p>';
      return;
    }

    ingredientsGrid.innerHTML = filteredItems
      .map(
        (item) => `
        <div 
          class="ingredient-card" 
          data-item-id="${item.id}"
          style="
            padding: 0.75rem;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';"
          onmouseout="this.style.background='#f9fafb'; this.style.borderColor='#e5e7eb';"
        >
          <div style="font-weight: 600; margin-bottom: 0.25rem;">${
            item.name
          }</div>
          <div style="color: #6b7280; font-size: 0.875rem;">
            Available: ${item.quantity} ${item.unit || "units"}
          </div>
        </div>
      `
      )
      .join("");

    // Attach click handlers
    document.querySelectorAll(".ingredient-card").forEach((card) => {
      card.addEventListener("click", () => {
        const itemId = card.dataset.itemId;
        const item = allItems.find((i) => i.id === itemId);
        if (item) {
          openQuantityModal(item);
        }
      });
    });
  };

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      window.populateIngredientsGrid(e.target.value);
    });
  }

  // Open quantity modal
  window.openQuantityModal = function (item) {
    currentIngredient = item;
    const modal = document.getElementById("quantity-modal");
    const title = document.getElementById("quantity-modal-title");
    const available = document.getElementById("quantity-modal-available");
    const controlsContainer = document.getElementById("quantity-controls");

    if (!modal || !title || !available || !controlsContainer) return;

    title.textContent = item.name;
    available.textContent = `Available: ${item.quantity} ${
      item.unit || "units"
    }`;

    // Determine if count or volume/weight
    const isCountUnit =
      item.unit === "count" || item.unit === "pcs" || item.unit === "pieces";

    // Build controls based on unit type
    if (isCountUnit) {
      // Simple +/- buttons for count
      controlsContainer.innerHTML = `
        <button type="button" class="btn btn-outline" id="qty-decrease" style="width: 50px; height: 40px; padding: 0; font-size: 1.1rem;">−</button>
        <input type="number" id="quantity-modal-input" min="1" step="1" value="1" readonly
          style="flex: 1; text-align: center; font-size: 1.25rem; font-weight: 600; cursor: default;" />
        <button type="button" class="btn btn-outline" id="qty-increase" style="width: 50px; height: 40px; padding: 0; font-size: 1.1rem;">+</button>
      `;

      const input = document.getElementById("quantity-modal-input");
      const decreaseBtn = document.getElementById("qty-decrease");
      const increaseBtn = document.getElementById("qty-increase");

      decreaseBtn.onclick = () => {
        const currentValue = parseInt(input.value) || 1;
        input.value = Math.max(1, currentValue - 1);
      };

      increaseBtn.onclick = () => {
        const currentValue = parseInt(input.value) || 1;
        const newValue = currentValue + 1;
        if (newValue <= item.quantity) {
          input.value = newValue;
        }
      };
    } else {
      // Volume/Weight: 4 buttons with unit labels
      const unitLabel = item.unit || "units";
      controlsContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: center;">
          <button type="button" class="btn btn-outline" id="qty-decrease-1" 
            style="width: 55px; height: 40px; padding: 0; font-size: 0.9rem;">-1</button>
          <button type="button" class="btn btn-outline" id="qty-decrease-decimal" 
            style="width: 55px; height: 40px; padding: 0; font-size: 0.9rem;">-0.1</button>
          <input type="number" id="quantity-modal-input" min="0.1" step="0.1" value="1.2" readonly
            style="width: 90px; text-align: center; font-size: 1.25rem; font-weight: 600; cursor: default;" />
          <button type="button" class="btn btn-outline" id="qty-increase-decimal" 
            style="width: 55px; height: 40px; padding: 0; font-size: 0.9rem;">+0.1</button>
          <button type="button" class="btn btn-outline" id="qty-increase-1" 
            style="width: 55px; height: 40px; padding: 0; font-size: 0.9rem;">+1</button>
        </div>
      `;

      const input = document.getElementById("quantity-modal-input");
      const decrease1Btn = document.getElementById("qty-decrease-1");
      const decreaseDecimalBtn = document.getElementById(
        "qty-decrease-decimal"
      );
      const increaseDecimalBtn = document.getElementById(
        "qty-increase-decimal"
      );
      const increase1Btn = document.getElementById("qty-increase-1");

      // Update button labels with unit
      decrease1Btn.textContent = `-1 ${unitLabel}`;
      decreaseDecimalBtn.textContent = `-0.1 ${unitLabel}`;
      increaseDecimalBtn.textContent = `+0.1 ${unitLabel}`;
      increase1Btn.textContent = `+1 ${unitLabel}`;

      // Adjust button widths to accommodate unit labels
      [decrease1Btn, decreaseDecimalBtn, increaseDecimalBtn, increase1Btn].forEach(btn => {
        btn.style.width = "auto";
        btn.style.minWidth = "70px";
        btn.style.padding = "0 0.5rem";
      });

      decrease1Btn.onclick = () => {
        const currentValue = parseFloat(input.value) || 0.1;
        input.value = Math.max(0.1, currentValue - 1).toFixed(2);
      };

      decreaseDecimalBtn.onclick = () => {
        const currentValue = parseFloat(input.value) || 0.1;
        input.value = Math.max(0.1, currentValue - 0.1).toFixed(2);
      };

      increaseDecimalBtn.onclick = () => {
        const currentValue = parseFloat(input.value) || 0.1;
        const newValue = currentValue + 0.1;
        if (newValue <= item.quantity) {
          input.value = newValue.toFixed(2);
        }
      };

      increase1Btn.onclick = () => {
        const currentValue = parseFloat(input.value) || 0.1;
        const newValue = currentValue + 1;
        if (newValue <= item.quantity) {
          input.value = newValue.toFixed(2);
        }
      };
    }

    modal.style.display = "flex";
  };

  // Close quantity modal
  window.closeQuantityModal = function () {
    const modal = document.getElementById("quantity-modal");
    if (modal) modal.style.display = "none";
    currentIngredient = null;
  };

  // Confirm quantity and add to list
  const confirmBtn = document.getElementById("quantity-modal-confirm");
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (!currentIngredient) return;

      const input = document.getElementById("quantity-modal-input");
      const qty = parseFloat(input.value);

      if (!qty || qty <= 0) {
        showAlert("Please enter a valid quantity", "warning");
        return;
      }

      // Check available quantity
      const existingQty = window.usageItems
        .filter((u) => u.ingredientId === currentIngredient.id)
        .reduce((sum, u) => sum + u.qty, 0);

      if (existingQty + qty > currentIngredient.quantity) {
        showAlert(
          `Insufficient quantity. Available: ${currentIngredient.quantity}, already added: ${existingQty}`,
          "warning"
        );
        return;
      }

      // Add to list
      window.usageItems.push({
        ingredientId: currentIngredient.id,
        qty: qty,
      });

      renderItemsList();
      window.closeQuantityModal();
    };
  }

  // Render the list of items to record
  function renderItemsList() {
    if (window.usageItems.length === 0) {
      itemsListContainer.innerHTML =
        '<p style="color: #9ca3af; text-align: center; margin: 8rem 0; font-size: 0.95rem;">Click items from the right to add →</p>';
      return;
    }

    let html =
      '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
    window.usageItems.forEach((usageItem, index) => {
      const inventoryItem = appState.inventory.find(
        (i) => i.id === usageItem.ingredientId
      );
      if (!inventoryItem) return;

      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
          <div>
            <strong>${inventoryItem.name}</strong> - 
            <span style="color: #6b7280;">${usageItem.qty} ${
        inventoryItem.unit || "units"
      }</span>
          </div>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeUsageItem(${index})">Remove</button>
        </div>
      `;
    });
    html += "</div>";

    itemsListContainer.innerHTML = html;
  }

  // Global function to remove item from list
  window.removeUsageItem = function (index) {
    window.usageItems.splice(index, 1);
    renderItemsList();
  };

  // Cancel button - switch back to all items tab
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      const allItemsTab = document.querySelector('[data-tab="all-items"]');
      if (allItemsTab) {
        allItemsTab.click();
      }
      form.reset();
      window.usageItems = [];
      renderItemsList();
    });
  }

  // Handle form submission
  if (form.dataset.bound) return;
  form.dataset.bound = "true";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usageReason = document.getElementById("usage-reason").value;
    const notes = document.getElementById("usage-notes-field").value || "";

    if (!window.usageItems || window.usageItems.length === 0) {
      showAlert("Please add at least one item to the list", "warning");
      return;
    }

    console.log("Processing usage for items:", window.usageItems);

    let successCount = 0;
    const itemsToLog = []; // Collect items for consolidated log

    // Process each item
    for (const { ingredientId, qty } of window.usageItems) {
      const idx = appState.inventory.findIndex(
        (i) => i.id === ingredientId && !i.archived
      );

      if (idx < 0) {
        showAlert(`Item ${ingredientId} not found or archived`, "error");
        continue;
      }

      const item = appState.inventory[idx];

      if (item.quantity < qty) {
        showAlert(
          `Insufficient quantity for ${item.name}. Available: ${
            item.quantity
          } ${item.unit || "units"}`,
          "warning"
        );
        continue;
      }

      // Deduct from inventory
      item.quantity -= qty;

      // Collect item info for consolidated log
      itemsToLog.push({
        id: ingredientId,
        name: item.name,
        quantity: qty,
        unit: item.unit || "units",
      });

      // Update totalUsed
      const currentTotalUsed = item.totalUsed || item.total_used || 0;
      item.totalUsed = currentTotalUsed + qty;

      // Update inventory item in database
      try {
        const apiBase = window.API_BASE_URL || "";
        const response = await fetch(`${apiBase}/api/inventory/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(item),
        });

        if (!response.ok) {
          throw new Error("Failed to update inventory");
        }

        successCount++;
      } catch (error) {
        console.error("Error updating inventory:", error);
        showAlert(`Failed to update ${item.name}. Please try again.`, "error");
      }
    }

    // Show loader
    showLoading("Recording usage logs...");

    // Create a single consolidated usage log for all items
    if (
      itemsToLog.length > 0 &&
      typeof logConsolidatedIngredientUsage === "function"
    ) {
      await logConsolidatedIngredientUsage(itemsToLog, usageReason, notes);
    }

    // Hide loader
    hideLoading();

    // Success
    if (successCount > 0) {
      saveState();
      renderInventory();
      form.reset();
      window.usageItems = [];
      renderItemsList();

      const reasonLabels = {
        waste: "Waste",
        spoilage: "Spoilage",
        testing: "Testing",
        staff_consumption: "Staff Consumption",
        production: "Production",
        other: "Other",
      };

      // Show custom success alert
      showCustomSuccessAlert(
        "Usage Recorded Successfully",
        `${successCount} item${successCount > 1 ? "s" : ""} recorded as ${
          reasonLabels[usageReason] || usageReason
        }`
      );

      // Switch back to all items tab
      const allItemsTab = document.querySelector('[data-tab="all-items"]');
      if (allItemsTab) {
        allItemsTab.click();
      }

      // Reload usage logs to show the new entry
      loadUsageLogs();
    }
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
    // Scroll to the inventory table section
    const tableSection = document.querySelector("#all-items-section");
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
    // Scroll to the inventory table section
    const tableSection = document.querySelector("#all-items-section");
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

// Tab switching functionality
function setupInventoryTabs() {
  const tabs = document.querySelectorAll(".inventory-tab");
  const allItemsSection = document.getElementById("all-items-section");
  const usageLogsSection = document.getElementById("usage-logs-section");
  const recordUsageSection = document.getElementById("record-usage-section");

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
        if (recordUsageSection) recordUsageSection.style.display = "none";
      } else if (targetTab === "usage-logs") {
        allItemsSection.style.display = "none";
        usageLogsSection.style.display = "block";
        if (recordUsageSection) recordUsageSection.style.display = "none";
        loadUsageLogs();
      } else if (targetTab === "record-usage") {
        allItemsSection.style.display = "none";
        usageLogsSection.style.display = "none";
        if (recordUsageSection) {
          recordUsageSection.style.display = "block";
          // Populate ingredients grid when tab is opened
          if (typeof populateIngredientsGrid === "function") {
            populateIngredientsGrid();
          }
        }
      }
    });
  });
}

// Load usage logs from database
async function loadUsageLogs() {
  try {
    const response = await fetch(
      `${window.API_BASE_URL || ""}/api/inventory-usage-logs`,
      {
        credentials: "include",
      }
    );

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
    updateUsageLogsPaginationControls(0);
    return;
  }

  // Group logs by batch_id
  const groupedLogs = {};
  const standaloneLogIds = [];

  logs.forEach((log) => {
    if (log.batchId) {
      if (!groupedLogs[log.batchId]) {
        groupedLogs[log.batchId] = [];
      }
      groupedLogs[log.batchId].push(log);
    } else {
      standaloneLogIds.push(log.id);
    }
  });

  // Build rows: first show batched entries, then standalone ones
  let allRows = [];

  // Render batched entries
  Object.entries(groupedLogs).forEach(([batchId, batchLogs]) => {
    // Sort batch logs by timestamp
    batchLogs.sort(
      (a, b) =>
        new Date(b.timestamp || b.created_at) -
        new Date(a.timestamp || a.created_at)
    );

    const firstLog = batchLogs[0];
    const timestamp = new Date(firstLog.timestamp || firstLog.created_at);
    const formattedDateTime = timestamp.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Combine all items from the batch
    const itemAndQty = batchLogs
      .map((log) => {
        const item = appState.inventory?.find(
          (i) => i.id === log.inventoryItemId
        );
        const itemName = item ? item.name : `Item #${log.inventoryItemId}`;
        const quantity = log.quantity || 0;
        const unit = item?.unit || "";
        return `${itemName} (${quantity} ${unit})`;
      })
      .join("<br>");

    const reason = firstLog.reason || "N/A";
    const notes = firstLog.notes || "-";

    // Get user name - check userName first (from backend), then lookup by createdBy ID
    let recordedBy = "System";
    if (firstLog.userName) {
      recordedBy = firstLog.userName;
    } else {
      const createdById = firstLog.createdBy || firstLog.created_by;
      if (createdById) {
        const user = appState.users?.find((u) => u.id === createdById);
        recordedBy = user ? user.name : createdById;
      }
    }

    allRows.push(`
      <tr>
        <td>${formattedDateTime}</td>
        <td>${itemAndQty}</td>
        <td>${formatReason(reason)}</td>
        <td>${notes}</td>
        <td>${recordedBy}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="archiveBatchUsageLogs('${batchId}')" title="Archive this batch">
            Archive
          </button>
        </td>
      </tr>
    `);
  });

  // Render standalone entries
  standaloneLogIds.forEach((logId) => {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const timestamp = new Date(log.timestamp || log.created_at);
    const formattedDateTime = timestamp.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const item = appState.inventory?.find((i) => i.id === log.inventoryItemId);
    const itemName = item ? item.name : `Item #${log.inventoryItemId}`;
    const quantity = log.quantity || 0;
    const unit = item?.unit || "";
    const itemAndQty = `${itemName} (${quantity} ${unit})`;

    const reason = log.reason || "N/A";
    const notes = log.notes || "-";

    // Get user name - check userName first (from backend), then lookup by createdBy ID
    let recordedBy = "System";
    if (log.userName) {
      recordedBy = log.userName;
    } else {
      const createdById = log.createdBy || log.created_by;
      if (createdById) {
        const user = appState.users?.find((u) => u.id === createdById);
        recordedBy = user ? user.name : createdById;
      }
    }

    allRows.push(`
      <tr>
        <td>${formattedDateTime}</td>
        <td>${itemAndQty}</td>
        <td>${formatReason(reason)}</td>
        <td>${notes}</td>
        <td>${recordedBy}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="archiveUsageLog(${
            log.id
          })" title="Archive this log">
            Archive
          </button>
        </td>
      </tr>
    `);
  });

  // Apply pagination
  const totalPages = Math.ceil(allRows.length / usageLogsItemsPerPage);
  const startIdx = (usageLogsCurrentPage - 1) * usageLogsItemsPerPage;
  const endIdx = startIdx + usageLogsItemsPerPage;
  const pageRows = allRows.slice(startIdx, endIdx);

  tbody.innerHTML = pageRows.join("");
  updateUsageLogsPaginationControls(totalPages);
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

// Archive a usage log
async function archiveUsageLog(logId) {
  const confirmed = await showConfirmAlert(
    "Archive Log",
    "Archive this usage log? It will be moved to the Archive page."
  );

  if (!confirmed) {
    return;
  }

  showLoading("Archiving log...");

  try {
    const currentUser = getCurrentUser();
    const apiBase = window.API_BASE_URL || "";
    const response = await fetch(
      `${apiBase}/api/inventory-usage-logs/${logId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: currentUser?.id,
        }),
      }
    );

    hideLoading();

    if (!response.ok) {
      throw new Error("Failed to archive usage log");
    }

    showAlert("Usage log archived successfully!", "success");
    loadUsageLogs(); // Reload the table
  } catch (error) {
    hideLoading();
    console.error("Error archiving usage log:", error);
    showAlert("Failed to archive usage log", "error");
  }
}

// Archive all usage logs in a batch
async function archiveBatchUsageLogs(batchId) {
  const confirmed = await showConfirmAlert(
    "Archive Batch",
    "Archive all logs in this batch? They will be moved to the Archive page."
  );

  if (!confirmed) {
    return;
  }

  showLoading("Archiving batch logs...");

  try {
    const apiBase = window.API_BASE_URL || "";

    // First, fetch all current logs to get the ones with this batchId
    const response = await fetch(`${apiBase}/api/inventory-usage-logs`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to fetch usage logs");

    const allLogs = await response.json();
    const logsToArchive = allLogs.filter(
      (log) => log.batchId === batchId && !log.archived
    );

    if (logsToArchive.length === 0) {
      hideLoading();
      showAlert("No logs found to archive", "warning");
      return;
    }

    const currentUser = getCurrentUser();
    const archivePromises = logsToArchive.map((log) =>
      fetch(`${apiBase}/api/inventory-usage-logs/${log.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: currentUser?.id,
        }),
      })
    );

    const results = await Promise.all(archivePromises);
    const allSuccess = results.every((res) => res.ok);

    hideLoading();

    if (!allSuccess) {
      throw new Error("Failed to archive some logs");
    }

    showAlert("Batch logs archived successfully!", "success");
    loadUsageLogs(); // Reload the table
  } catch (error) {
    hideLoading();
    console.error("Error archiving batch logs:", error);
    showAlert("Failed to archive batch logs", "error");
  }
}

window.archiveUsageLog = archiveUsageLog;
window.archiveBatchUsageLogs = archiveBatchUsageLogs;

// Usage logs pagination functions
function updateUsageLogsPaginationControls(totalPages) {
  const currentPageEl = document.getElementById("usage-logs-current-page");
  const totalPagesEl = document.getElementById("usage-logs-total-pages");
  const prevBtn = document.getElementById("usage-logs-prev-btn");
  const nextBtn = document.getElementById("usage-logs-next-btn");
  const pagination = document.getElementById("usage-logs-pagination");

  if (!currentPageEl || !totalPagesEl || !prevBtn || !nextBtn || !pagination)
    return;

  // Hide pagination if no pages or only one page
  if (totalPages <= 1) {
    pagination.style.display = "none";
    return;
  } else {
    pagination.style.display = "flex";
  }

  currentPageEl.textContent = usageLogsCurrentPage;
  totalPagesEl.textContent = totalPages;

  // Enable/disable buttons
  prevBtn.disabled = usageLogsCurrentPage === 1;
  nextBtn.disabled = usageLogsCurrentPage >= totalPages;
}

function usageLogsPreviousPage() {
  if (usageLogsCurrentPage > 1) {
    usageLogsCurrentPage--;
    loadUsageLogs();
  }
}

function usageLogsNextPage() {
  usageLogsCurrentPage++;
  loadUsageLogs();
}

window.usageLogsPreviousPage = usageLogsPreviousPage;
window.usageLogsNextPage = usageLogsNextPage;

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["inventory"] = function () {
  renderInventory();
  setupInventoryTabs();
};
