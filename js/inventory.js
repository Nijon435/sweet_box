function renderInventory() {
  const form = document.getElementById("inventory-form");
  const editModal = document.getElementById("inventory-edit-modal");
  const editForm = document.getElementById("inventory-edit-form");
  const editClose = document.getElementById("inventory-edit-close");
  const editCancel = document.getElementById("inventory-edit-cancel");

  const setSelectValue = (select, value) => {
    if (!select) return;
    const hasOption = [...select.options].some(
      (option) => option.value === value
    );
    if (!hasOption && value) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.value = value || "";
  };

  const closeEditModal = () => {
    if (!editModal || !editForm) return;
    editModal.classList.remove("active");
    editForm.reset();
    delete editForm.dataset.itemId;
  };
  const openEditModal = (item) => {
    if (!editModal || !editForm) return;
    editForm.dataset.itemId = item.id;
    const categoryField = editForm.querySelector("[name=category]");
    setSelectValue(categoryField, item.category);
    const nameField = editForm.querySelector("[name=name]");
    const qtyField = editForm.querySelector("[name=quantity]");
    const costField = editForm.querySelector("[name=cost]");
    if (nameField) nameField.value = item.name;
    if (qtyField) qtyField.value = item.quantity;
    if (costField) costField.value = item.cost;
    editModal.classList.add("active");
  };

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
    editModal.addEventListener("click", (event) => {
      if (event.target === editModal) closeEditModal();
    });
  }

  if (editForm && !editForm.dataset.bound) {
    editForm.dataset.bound = "true";
    editForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isAdmin()) {
        alert("Only administrators can update inventory records.");
        return;
      }
      const itemId = editForm.dataset.itemId;
      if (!itemId) {
        closeEditModal();
        return;
      }
      const idx = appState.inventory.findIndex((item) => item.id === itemId);
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
      };
      appState.inventory[idx] = updated;

      // Save to backend API
      fetch(
        window.APP_STATE_ENDPOINT?.replace(
          "/api/state",
          "/api/inventory/" + itemId
        ),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
          credentials: "include",
        }
      ).catch((err) =>
        console.error("Failed to save inventory to backend:", err)
      );

      saveState();
      closeEditModal();
      renderInventory();
    });
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        id: data.get("itemId") || `inv-${Date.now()}`,
        category: data.get("category"),
        name: data.get("name"),
        quantity: Number(data.get("quantity")) || 0,
        cost: Number(data.get("cost")) || 0,
      };
      if (!payload.category || !payload.name) return;
      const idx = appState.inventory.findIndex(
        (item) => item.id === payload.id
      );
      if (idx >= 0) appState.inventory[idx] = payload;
      else appState.inventory.push(payload);
      saveState();
      form.reset();
      renderInventory();
    });
  }

  const stats = inventoryStats();
  const categorizedInventory = categorizeInventory();

  // Calculate value per category
  const categoryValues = {
    "cakes & pastries":
      categorizedInventory["cakes & pastries"]?.reduce(
        (sum, item) => sum + item.quantity * item.cost,
        0
      ) || 0,
    ingredients:
      categorizedInventory["ingredients"]?.reduce(
        (sum, item) => sum + item.quantity * item.cost,
        0
      ) || 0,
    supplies:
      categorizedInventory["supplies"]?.reduce(
        (sum, item) => sum + item.quantity * item.cost,
        0
      ) || 0,
    beverages:
      categorizedInventory["beverages"]?.reduce(
        (sum, item) => sum + item.quantity * item.cost,
        0
      ) || 0,
  };

  const inventoryStatsMap = {
    "inventory-total": `${stats.totalItems} products`,
    "inventory-low": `${stats.lowStock} low stock`,
    "inventory-value": formatCurrency(stats.value),
    "inventory-cakes-value": formatCurrency(categoryValues["cakes & pastries"]),
    "inventory-ingredients-value": formatCurrency(
      categoryValues["ingredients"]
    ),
    "inventory-supplies-value": formatCurrency(categoryValues["supplies"]),
    "inventory-beverages-value": formatCurrency(categoryValues["beverages"]),
  };
  Object.entries(inventoryStatsMap).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });

  // Populate low stock items dropdown
  const lowStockItemsContainer = document.getElementById("low-stock-items");
  if (lowStockItemsContainer) {
    const lowItems = lowStockItems();
    if (lowItems.length > 0) {
      lowStockItemsContainer.innerHTML = lowItems
        .map(
          (item) =>
            `<div style="display: flex; justify-content: space-between; padding: 4px 0;">
              <span>${item.name}</span>
              <strong style="color: var(--warning);">${item.quantity}</strong>
            </div>`
        )
        .join("");
    } else {
      lowStockItemsContainer.innerHTML =
        '<div style="color: var(--gray-500); font-size: 13px;">All items are well stocked</div>';
    }
  }

  // Setup collapsible sections
  const lowStockToggle = document.getElementById("low-stock-toggle");
  const totalValueToggle = document.getElementById("total-value-toggle");

  if (lowStockToggle && !lowStockToggle.dataset.bound) {
    lowStockToggle.dataset.bound = "true";
    lowStockToggle.addEventListener("click", () => {
      lowStockToggle.classList.toggle("expanded");
    });
  }

  if (totalValueToggle && !totalValueToggle.dataset.bound) {
    totalValueToggle.dataset.bound = "true";
    totalValueToggle.addEventListener("click", () => {
      totalValueToggle.classList.toggle("expanded");
    });
  }

  // Setup search functionality
  document.querySelectorAll(".inventory-search").forEach((search) => {
    if (search.dataset.bound) return;
    search.dataset.bound = "true";
    search.addEventListener("input", (e) => {
      const category = e.target.dataset.category;
      const searchTerm = e.target.value.toLowerCase();
      const table = document.querySelector(
        `.inventory-table[data-category="${category}"]`
      );
      if (!table) return;

      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const itemName =
          row.querySelector("td:first-child")?.textContent.toLowerCase() || "";
        if (itemName.includes(searchTerm)) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  });

  const alertPanel = document.getElementById("inventory-alert");
  if (alertPanel) {
    const lowItems = lowStockItems();
    const severity = !lowItems.length
      ? "good"
      : lowItems.length > 5
      ? "alert"
      : "warning";
    alertPanel.className = `alert-panel${
      severity !== "warning" ? ` ${severity}` : ""
    }`;
    if (!lowItems.length) {
      alertPanel.innerHTML = `<strong>Inventory healthy</strong><p>All categories are above their reorder points.</p>`;
    } else {
      const preview = lowItems
        .slice(0, 4)
        .map(
          (item) =>
            `<span class="alert-tag">${item.name} (${item.quantity})</span>`
        )
        .join("");
      const extraCount = lowItems.length - 4;
      alertPanel.innerHTML = `<strong>${lowItems.length} low-stock ${
        lowItems.length === 1 ? "item" : "items"
      }</strong><p>Restock soon to avoid production gaps.</p><div class="alert-tags">${preview}${
        extraCount > 0
          ? `<span class="alert-tag">+${extraCount} more</span>`
          : ""
      }</div>`;
    }
  }

  const sections = document.querySelectorAll(".inventory-table");
  sections.forEach((table) => {
    const category = table.dataset.category;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const records = categorizeInventory()[category] || [];
    if (!records.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="6" class="empty-state">No items under ${category} yet.</td>`;
      tbody.appendChild(row);
      return;
    }
    records.forEach((item) => {
      const row = document.createElement("tr");
      // Different thresholds: 10 for supplies/beverages, 5 for others
      const threshold =
        category === "supplies" || category === "beverages" ? 10 : 5;
      const isOutOfStock = item.quantity === 0;
      const isLowStock = item.quantity > 0 && item.quantity < threshold;
      const statusClass = isOutOfStock
        ? "out-of-stock"
        : isLowStock
        ? "late"
        : "present";
      const statusText = isOutOfStock
        ? "Out of Stock"
        : isLowStock
        ? "Low Stock"
        : "Healthy";
      const statusSymbol = isOutOfStock ? "✖" : isLowStock ? "⚠" : "✓";
      row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.cost)}</td>
      <td><span class="status ${statusClass}"><span class="status-text">${statusText}</span><span class="status-symbol">${statusSymbol}</span></span></td>
      <td class="table-actions">
        <button class="btn btn-outline" data-edit="${item.id}">Edit</button>
        <button class="btn btn-secondary" data-delete="${
          item.id
        }">Delete</button>
        <div class="table-actions-mobile">
          <button class="table-actions-toggle" data-toggle="${item.id}">
            ⋯
          </button>
          <div class="table-actions-dropdown" data-dropdown="${item.id}">
            <button class="btn btn-outline" data-edit-mobile="${
              item.id
            }">Edit</button>
            <button class="btn btn-secondary" data-delete-mobile="${
              item.id
            }">Delete</button>
          </div>
        </div>
      </td>
    `;
      tbody.appendChild(row);
    });
  });

  const canManageInventory = isAdmin();

  // Handle dropdown toggles
  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.toggle;
      const dropdown = document.querySelector(`[data-dropdown="${id}"]`);

      // Close all other dropdowns
      document.querySelectorAll(".table-actions-dropdown").forEach((d) => {
        if (d !== dropdown) d.classList.remove("active");
      });

      // Toggle current dropdown
      dropdown.classList.toggle("active");
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".table-actions-mobile")) {
      document.querySelectorAll(".table-actions-dropdown").forEach((d) => {
        d.classList.remove("active");
      });
    }
  });

  // Desktop Edit buttons
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.disabled = !canManageInventory;
    if (!canManageInventory) {
      btn.title = "Admin only";
      return;
    }
    btn.addEventListener("click", () => {
      const id = btn.dataset.edit;
      const item = appState.inventory.find((record) => record.id === id);
      if (!item) return;
      openEditModal(item);
    });
  });

  // Mobile Edit buttons
  document.querySelectorAll("[data-edit-mobile]").forEach((btn) => {
    btn.disabled = !canManageInventory;
    if (!canManageInventory) {
      btn.title = "Admin only";
      return;
    }
    btn.addEventListener("click", () => {
      const id = btn.dataset.editMobile;
      const item = appState.inventory.find((record) => record.id === id);
      if (!item) return;
      openEditModal(item);
      // Close dropdown
      document.querySelectorAll(".table-actions-dropdown").forEach((d) => {
        d.classList.remove("active");
      });
    });
  });

  // Desktop Delete buttons
  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.disabled = !canManageInventory;
    if (!canManageInventory) {
      btn.title = "Admin only";
      return;
    }
    btn.addEventListener("click", () => {
      const id = btn.dataset.delete;
      appState.inventory = appState.inventory.filter((item) => item.id !== id);
      saveState();
      renderInventory();
    });
  });

  // Mobile Delete buttons
  document.querySelectorAll("[data-delete-mobile]").forEach((btn) => {
    btn.disabled = !canManageInventory;
    if (!canManageInventory) {
      btn.title = "Admin only";
      return;
    }
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteMobile;
      appState.inventory = appState.inventory.filter((item) => item.id !== id);
      saveState();
      renderInventory();
      // Close dropdown
      document.querySelectorAll(".table-actions-dropdown").forEach((d) => {
        d.classList.remove("active");
      });
    });
  });

  // Setup ingredient usage form
  setupIngredientUsageForm();
}

function setupIngredientUsageForm() {
  const form = document.getElementById("ingredient-usage-form");
  const select = document.getElementById("ingredient-select");

  if (!form || !select) return;

  // Populate ingredient dropdown
  const ingredients = appState.inventory.filter(
    (i) => i.category === "ingredients"
  );
  select.innerHTML = '<option value="">Choose ingredient...</option>';
  ingredients.forEach((ing) => {
    const opt = document.createElement("option");
    opt.value = ing.id;
    opt.textContent = `${ing.name} (Available: ${ing.quantity})`;
    select.appendChild(opt);
  });

  if (form.dataset.bound) return;
  form.dataset.bound = "true";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const ingredientId = data.get("ingredientId");
    const qty = Number(data.get("quantity"));
    const reason = data.get("reason");

    const idx = appState.inventory.findIndex((i) => i.id === ingredientId);
    if (idx < 0) {
      alert("Ingredient not found");
      return;
    }

    if (appState.inventory[idx].quantity < qty) {
      alert(
        `Insufficient quantity. Available: ${appState.inventory[idx].quantity}`
      );
      return;
    }

    // Deduct from inventory
    appState.inventory[idx].quantity -= qty;

    // Record usage
    const usageRecord = {
      id: "usage-" + Date.now(),
      label: appState.inventory[idx].name,
      used: qty,
      reason: reason || "Staff usage",
      timestamp: new Date().toISOString(),
    };

    if (!appState.inventoryUsage) appState.inventoryUsage = [];
    appState.inventoryUsage.push(usageRecord);

    saveState();
    syncStateToDatabase();
    renderInventory();
    form.reset();

    alert(`Recorded: ${qty} of ${appState.inventory[idx].name} used`);
  });
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["inventory"] = renderInventory;
