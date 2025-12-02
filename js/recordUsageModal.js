// Replace the setupRecordUsageButton function (lines 604-820) with this code:

function setupRecordUsageButton() {
  const recordUsageBtn = document.getElementById("log-usage-btn");
  const modal = document.getElementById("log-usage-modal");
  const closeBtn = document.getElementById("log-usage-close");
  const cancelBtn = document.getElementById("log-usage-cancel");
  const form = document.getElementById("log-usage-form");
  const select = document.getElementById("usage-ingredient-select");
  const qtyInput = document.getElementById("usage-quantity-input");
  const addToListBtn = document.getElementById("add-to-list-btn");
  const itemsList = document.getElementById("usage-items-list");

  if (!recordUsageBtn || !modal || !form || !select || !addToListBtn || !itemsList) return;

  let usageItems = []; // Store items to be recorded

  // Populate ingredient dropdown
  function populateItemSelect() {
    const allItems = (appState.inventory || []).filter((i) => !i.archived);
    select.innerHTML = '<option value="">Choose item...</option>';

    const categories = [...new Set(allItems.map((i) => i.category))].sort();
    categories.forEach((category) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = category.charAt(0).toUpperCase() + category.slice(1);

      const itemsInCategory = allItems.filter((i) => i.category === category);
      itemsInCategory.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.dataset.unit = item.unit || "units";
        opt.dataset.name = item.name;
        opt.dataset.available = item.quantity;
        opt.textContent = `${item.name} (${item.quantity} ${item.unit || "units"})`;
        optgroup.appendChild(opt);
      });

      select.appendChild(optgroup);
    });
  }

  // Render the items list
  function renderItemsList() {
    if (usageItems.length === 0) {
      itemsList.innerHTML = '<p style="color: #9ca3af; text-align: center; margin: 2rem 0;">No items added yet</p>';
      return;
    }

    itemsList.innerHTML = usageItems
      .map(
        (item, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 6px; margin-bottom: 0.5rem;">
          <span><strong>${item.name}</strong> - ${item.qty} ${item.unit}</span>
          <button type="button" class="btn btn-sm btn-danger" onclick="removeUsageItem(${index})" style="padding: 0.25rem 0.5rem;">
            Remove
          </button>
        </div>
      `
      )
      .join("");
  }

  // Add item to list
  addToListBtn.addEventListener("click", () => {
    const selectedOption = select.options[select.selectedIndex];
    const ingredientId = select.value;
    const qty = Number(qtyInput.value);

    if (!ingredientId) {
      alert("Please select an item");
      return;
    }

    if (!qty || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    const available = Number(selectedOption.dataset.available);
    if (qty > available) {
      alert(`Insufficient quantity. Available: ${available} ${selectedOption.dataset.unit}`);
      return;
    }

    // Check if item already in list
    if (usageItems.some((item) => item.id === ingredientId)) {
      alert("Item already added to list");
      return;
    }

    usageItems.push({
      id: ingredientId,
      name: selectedOption.dataset.name,
      qty: qty,
      unit: selectedOption.dataset.unit,
    });

    renderItemsList();
    select.value = "";
    qtyInput.value = "";
  });

  // Remove item from list (global function)
  window.removeUsageItem = function (index) {
    usageItems.splice(index, 1);
    renderItemsList();
  };

  // Open modal
  recordUsageBtn.addEventListener("click", () => {
    populateItemSelect();
    usageItems = [];
    renderItemsList();
    modal.classList.add("active");
    form.reset();
  });

  // Close modal
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });

  // Handle form submission
  if (form.dataset.bound) return;
  form.dataset.bound = "true";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (usageItems.length === 0) {
      alert("Please add at least one item to the list");
      return;
    }

    const usageReason = document.getElementById("usage-reason").value;
    const notes = document.getElementById("usage-notes-field").value || "";

    if (!usageReason) {
      alert("Please select a usage reason");
      return;
    }

    // Process each item
    let successCount = 0;
    for (const usageItem of usageItems) {
      const idx = appState.inventory.findIndex(
        (i) => i.id === usageItem.id && !i.archived
      );

      if (idx < 0) continue;

      const item = appState.inventory[idx];

      // Deduct from inventory
      item.quantity -= usageItem.qty;

      // Log ingredient usage
      if (typeof logIngredientUsage === "function") {
        await logIngredientUsage(
          usageItem.id,
          usageItem.qty,
          usageReason,
          null,
          notes || `${usageReason}: ${item.name}`
        );
      }

      // Update totalUsed
      const currentTotalUsed = item.totalUsed || item.total_used || 0;
      item.totalUsed = currentTotalUsed + usageItem.qty;

      // Update inventory item in database
      try {
        const apiBase = window.API_BASE_URL || "";
        const response = await fetch(`${apiBase}/api/inventory/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(item),
        });

        if (response.ok) {
          successCount++;
        }
      } catch (error) {
        console.error("Error updating inventory:", error);
      }
    }

    // Success
    saveState();
    renderInventory();
    modal.classList.remove("active");
    form.reset();
    usageItems = [];

    const reasonLabels = {
      waste: "Waste",
      spoilage: "Spoilage",
      testing: "Testing",
      staff_consumption: "Staff Consumption",
      production: "Production",
      other: "Other",
    };

    alert(
      `Successfully recorded ${successCount} item(s) for ${reasonLabels[usageReason] || usageReason}`
    );
  });
}
