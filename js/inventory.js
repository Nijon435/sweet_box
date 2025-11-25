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
    const unitField = editForm.querySelector("[name=unit]");
    setSelectValue(categoryField, item.category);
    setSelectValue(unitField, item.unit);
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
        unit: data.get("unit"),
        cost: Number(data.get("cost")) || 0,
      };
      updated.reorderPoint = Math.max(1, Math.round(updated.quantity * 0.3));
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
        unit: data.get("unit"),
        cost: Number(data.get("cost")) || 0,
      };
      payload.reorderPoint = Math.max(1, Math.round(payload.quantity * 0.3));
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
  const inventoryStatsMap = {
    "inventory-total": `${stats.totalItems} products`,
    "inventory-low": `${stats.lowStock} low stock`,
    "inventory-value": formatCurrency(stats.value),
  };
  Object.entries(inventoryStatsMap).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
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
      row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.cost)}</td>
      <td><span class="status ${
        item.quantity <= item.reorderPoint ? "late" : "present"
      }">${
        item.quantity <= item.reorderPoint ? "Reorder" : "Healthy"
      }</span></td>
      <td class="table-actions"><button class="btn btn-outline" data-edit="${
        item.id
      }">Edit</button><button class="btn btn-secondary" data-delete="${
        item.id
      }">Delete</button></td>
    `;
      tbody.appendChild(row);
    });
  });

  const canManageInventory = isAdmin();
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
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["inventory"] = renderInventory;
