// Pagination state for completed orders
let ordersCurrentPage = 1;
const ordersItemsPerPage = 20;

// POS System State
let posCart = [];
let currentCategory = "all";
let searchTerm = "";

// Initialize POS System
function initializePOS() {
  // View toggle buttons
  const posViewBtn = document.getElementById("pos-view-btn");
  const historyViewBtn = document.getElementById("history-view-btn");
  const posView = document.querySelector(".pos-view");
  const historyView = document.querySelector(".order-history-view");

  if (posViewBtn && historyViewBtn && posView && historyView) {
    posViewBtn.addEventListener("click", () => {
      posViewBtn.classList.add("active");
      historyViewBtn.classList.remove("active");
      posView.classList.add("active");
      historyView.classList.remove("active");
    });

    historyViewBtn.addEventListener("click", () => {
      historyViewBtn.classList.add("active");
      posViewBtn.classList.remove("active");
      historyView.classList.add("active");
      posView.classList.remove("active");
    });
  }

  // Initialize categories
  renderCategories();

  // Initialize products grid
  renderProductsGrid();

  // Product search
  const searchInput = document.getElementById("product-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value.toLowerCase();
      renderProductsGrid();
    });
  }

  // Cart actions
  const completeOrderBtn = document.getElementById("complete-order-btn");
  const clearCartBtn = document.getElementById("clear-cart-btn");

  if (completeOrderBtn) {
    completeOrderBtn.addEventListener("click", completeOrder);
  }

  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      if (posCart.length > 0) {
        if (confirm("Clear all items from cart?")) {
          posCart = [];
          renderCart();
        }
      }
    });
  }

  renderCart();
}

// Get unique categories from inventory
function getCategories() {
  const categories = new Set(["all"]);
  (appState.inventory || []).forEach((item) => {
    if (item.category && item.category !== "Supplies") {
      categories.add(item.category);
    }
  });
  return Array.from(categories);
}

// Render category tabs
function renderCategories() {
  const categoriesContainer = document.getElementById("category-tabs");
  if (!categoriesContainer) return;

  const categories = getCategories();
  categoriesContainer.innerHTML = "";

  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.className = "category-tab";
    if (category === currentCategory) btn.classList.add("active");
    btn.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    btn.dataset.category = category;
    btn.addEventListener("click", () => {
      currentCategory = category;
      renderCategories();
      renderProductsGrid();
    });
    categoriesContainer.appendChild(btn);
  });
}

// Render products grid
function renderProductsGrid() {
  const productsGrid = document.getElementById("products-grid");
  if (!productsGrid) return;

  let products = (appState.inventory || []).filter(
    (item) => item.category !== "Supplies" && item.category !== "supplies"
  );

  // Filter by category
  if (currentCategory !== "all") {
    products = products.filter(
      (item) => item.category.toLowerCase() === currentCategory.toLowerCase()
    );
  }

  // Filter by search term
  if (searchTerm) {
    products = products.filter((item) =>
      item.name.toLowerCase().includes(searchTerm)
    );
  }

  productsGrid.innerHTML = "";

  if (products.length === 0) {
    productsGrid.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #999;">No products found</div>';
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const inStock = Number(product.quantity || 0) > 0;
    if (!inStock) {
      card.classList.add("disabled");
    }

    card.innerHTML = `
      <img src="${product.image || "img/placeholder.png"}" alt="${
      product.name
    }" onerror="this.src='img/placeholder.png'">
      <div class="product-name">${product.name}</div>
      <div class="product-price">₱${Number(product.unitPrice || 0).toFixed(
        2
      )}</div>
      <div class="product-stock ${!inStock ? "out-of-stock" : ""}">${
      inStock ? `Stock: ${product.quantity}` : "Out of Stock"
    }</div>
    `;

    if (inStock) {
      card.addEventListener("click", () => addToCart(product));
    }

    productsGrid.appendChild(card);
  });
}

// Add item to cart
function addToCart(product) {
  const existingItem = posCart.find((item) => item.id === product.id);

  if (existingItem) {
    // Check if we have enough stock
    if (existingItem.qty + 1 > Number(product.quantity)) {
      alert(`Only ${product.quantity} units available in stock`);
      return;
    }
    existingItem.qty += 1;
  } else {
    posCart.push({
      id: product.id,
      name: product.name,
      unitPrice: Number(product.unitPrice || 0),
      qty: 1,
      source: "inventory",
    });
  }

  renderCart();
}

// Update cart quantity
function updateCartQty(itemId, change) {
  const item = posCart.find((i) => i.id === itemId);
  if (!item) return;

  const product = appState.inventory.find((p) => p.id === itemId);
  const maxQty = product ? Number(product.quantity || 0) : 999;

  item.qty += change;

  if (item.qty <= 0) {
    removeFromCart(itemId);
  } else if (item.qty > maxQty) {
    alert(`Only ${maxQty} units available in stock`);
    item.qty = maxQty;
    renderCart();
  } else {
    renderCart();
  }
}

// Remove item from cart
function removeFromCart(itemId) {
  posCart = posCart.filter((item) => item.id !== itemId);
  renderCart();
}

// Render cart
function renderCart() {
  const cartItemsContainer = document.getElementById("cart-items");
  const subtotalEl = document.getElementById("cart-subtotal");
  const totalEl = document.getElementById("cart-total");
  const completeBtn = document.getElementById("complete-order-btn");

  if (!cartItemsContainer) return;

  // Calculate totals
  const subtotal = posCart.reduce(
    (sum, item) => sum + item.qty * item.unitPrice,
    0
  );
  const total = subtotal; // Can add tax here if needed

  // Update totals
  if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `₱${total.toFixed(2)}`;

  // Enable/disable complete button
  if (completeBtn) {
    completeBtn.disabled = posCart.length === 0;
  }

  // Render cart items
  if (posCart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <div>Cart is empty</div>
        <small>Click on products to add</small>
      </div>
    `;
    return;
  }

  cartItemsContainer.innerHTML = "";
  posCart.forEach((item) => {
    const cartItem = document.createElement("div");
    cartItem.className = "cart-item";
    cartItem.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₱${item.unitPrice.toFixed(2)} each</div>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="updateCartQty('${
          item.id
        }', -1)">−</button>
        <span class="qty-display">${item.qty}</span>
        <button class="qty-btn" onclick="updateCartQty('${
          item.id
        }', 1)">+</button>
        <span class="remove-item" onclick="removeFromCart('${
          item.id
        }')" title="Remove">✕</span>
      </div>
    `;
    cartItemsContainer.appendChild(cartItem);
  });
}

// Complete order
function completeOrder() {
  const customerInput = document.getElementById("pos-customer");
  const orderTypeSelect = document.getElementById("pos-order-type");

  if (posCart.length === 0) {
    alert("Cart is empty");
    return;
  }

  const customer = customerInput?.value.trim() || "Walk-in";
  const orderType = orderTypeSelect?.value || "dine-in";

  // Deduct from inventory
  posCart.forEach((cartItem) => {
    const invItem = appState.inventory.find((i) => i.id === cartItem.id);
    if (invItem) {
      invItem.quantity =
        Number(invItem.quantity || 0) - Number(cartItem.qty || 0);
      if (invItem.quantity < 0) invItem.quantity = 0;

      // Log ingredient usage
      if (typeof logIngredientUsage === "function") {
        logIngredientUsage(
          invItem.id,
          Number(cartItem.qty),
          "order",
          `ord-${Date.now()}`,
          `Order item: ${cartItem.name}`
        );
      }
    }
  });

  // Calculate total
  const total = posCart.reduce(
    (sum, item) => sum + item.qty * item.unitPrice,
    0
  );

  // Create order
  const order = {
    id: `ord-${Date.now()}`,
    customer: customer,
    items: posCart.map((item) => `${item.qty}x ${item.name}`).join(", "),
    itemsJson: posCart,
    total: total,
    status: "pending",
    type: orderType,
    timestamp: new Date().toISOString(),
    servedAt: null,
  };

  appState.orders = appState.orders || [];
  appState.orders.push(order);

  // Save to database
  saveState();

  // Clear cart
  posCart = [];
  if (customerInput) customerInput.value = "";
  renderCart();
  renderProductsGrid(); // Update stock display

  alert(`Order ${order.id} created successfully!`);

  // Switch to history view to show the order
  const historyViewBtn = document.getElementById("history-view-btn");
  if (historyViewBtn) historyViewBtn.click();
}

// Make functions globally available
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;

function renderOrders() {
  const form = document.getElementById("orders-form");
  const filterSelect = document.getElementById("orders-filter");
  const orderTypeSelect = document.getElementById("order-type");
  const customerLabelSpan = document.getElementById("order-customer-label");
  const customerInput = document.getElementById("order-customer");
  const receiptTemplate = document.getElementById("receipt-template");
  const receiptModal = document.getElementById("receipt-modal");
  const receiptClose = document.getElementById("receipt-close");
  const receiptPrintBtn = document.getElementById("receipt-print");
  const receiptFields = {
    ticket: document.getElementById("receipt-ticket"),
    customer: document.getElementById("receipt-customer"),
    itemCount: document.getElementById("receipt-item-count"),
    itemsList: document.getElementById("receipt-items-list"),
    total: document.getElementById("receipt-total"),
    time: document.getElementById("receipt-time"),
    note: document.getElementById("receipt-note"),
    serviceTag: document.getElementById("receipt-service-tag"),
  };

  const updateCustomerFieldCopy = () => {
    if (!customerLabelSpan || !customerInput) return;
    const key = normalizeOrderType(orderTypeSelect?.value);
    const copy = ORDER_TYPE_FORM_COPY[key] || ORDER_TYPE_FORM_COPY["dine-in"];
    customerLabelSpan.textContent = copy.label;
    customerInput.placeholder = copy.placeholder;
    customerInput.setAttribute("aria-label", copy.label);
  };

  updateCustomerFieldCopy();
  if (orderTypeSelect && !orderTypeSelect.dataset.copyBound) {
    orderTypeSelect.dataset.copyBound = "true";
    orderTypeSelect.addEventListener("change", updateCustomerFieldCopy);
  }

  if (filterSelect && !filterSelect.dataset.bound) {
    filterSelect.dataset.bound = "true";
    filterSelect.addEventListener("change", renderOrders);
  }
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const orderType = normalizeOrderType(data.get("type"));
      let itemsArr = [];
      try {
        const raw = form.querySelector("#order-items-json")?.value || "[]";
        itemsArr = JSON.parse(raw);
      } catch (err) {
        itemsArr = [];
      }
      itemsArr.forEach((it) => {
        if (!it || !it.source) return;
        if (it.source === "inventory" || it.source === "supplies") {
          const inv = appState.inventory.find((i) => i.id === it.id);
          if (inv) {
            // Deduct from inventory
            inv.quantity = Number(inv.quantity || 0) - Number(it.qty || 0);
            if (inv.quantity < 0) inv.quantity = 0;

            // Log ingredient usage for this order
            if (typeof logIngredientUsage === "function") {
              logIngredientUsage(
                inv.id,
                Number(it.qty || 0),
                "order",
                `ord-${Date.now()}`, // Will be replaced with actual order ID below
                `Order item: ${it.name}`
              );
            }
          }
        }
      });
      const payload = {
        id: `ord-${Date.now()}`,
        customer: data.get("customer") || "Walk-in",
        items:
          (itemsArr || []).map((it) => `${it.qty}x ${it.name}`).join(", ") ||
          data.get("items") ||
          "",
        itemsJson: itemsArr,
        total: Number(data.get("total")) || 0,
        status: data.get("status") || "pending",
        type: orderType,
        timestamp: new Date().toISOString(),
        servedAt: null,
      };

      // Update usage logs with correct order ID
      if (appState.ingredientUsageLogs && itemsArr.length > 0) {
        const recentLogs = appState.ingredientUsageLogs.slice(-itemsArr.length);
        recentLogs.forEach((log) => {
          if (log.orderId && log.orderId.startsWith("ord-")) {
            log.orderId = payload.id;
          }
        });
      }

      appState.orders.unshift(payload);
      saveState();
      form.reset();
      renderOrders();
    });
  }

  const activeOrders = appState.orders.filter(
    (order) => order.status !== "served"
  );
  const completedOrders = appState.orders.filter(
    (order) => order.status === "served"
  );
  const tableBody = document.querySelector("#orders-table tbody");
  const filter = filterSelect?.value || "all";
  if (tableBody) {
    tableBody.innerHTML = "";
    const filteredActive = activeOrders.filter((order) =>
      filter === "all" ? true : order.status === filter
    );
    if (!filteredActive.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="6" class="empty-state">No active orders under this filter.</td>`;
      tableBody.appendChild(emptyRow);
    } else {
      filteredActive.forEach((order) => {
        const orderTypeKey = normalizeOrderType(order.type);
        const orderTypeTag = `<span class="pill pill-ghost order-type-tag order-type-${orderTypeKey}">${getOrderTypeLabel(
          orderTypeKey
        )}</span>`;
        const statusControl = `<select class="order-status" data-order="${
          order.id
        }">${["pending", "preparing", "ready"]
          .map(
            (status) =>
              `<option value="${status}" ${
                order.status === status ? "selected" : ""
              }>${status}</option>`
          )
          .join("")}</select>`;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${order.id}</td>
          <td><strong>${order.customer}</strong><br/><small>${
          order.items
        }</small><div class="order-tags">${orderTypeTag}</div></td>
          <td>${formatCurrency(order.total)}</td>
          <td>${statusControl}</td>
          <td>${formatTime(order.timestamp)}</td>
          <td class="orders-actions">
            <button class="btn btn-outline" data-receipt="${
              order.id
            }">Receipt</button>
            <button class="btn btn-secondary" data-serve="${
              order.id
            }">Mark served</button>
            <button class="btn btn-danger" data-delete="${
              order.id
            }">Delete</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    }
  }

  const completedBody = document.querySelector("#completed-orders-table tbody");
  if (completedBody) {
    completedBody.innerHTML = "";
    if (!completedOrders.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5" class="empty-state">No completed orders yet.</td>`;
      completedBody.appendChild(row);
      updateOrdersPaginationControls(0);
    } else {
      const sortedOrders = completedOrders.sort(
        (a, b) =>
          new Date(b.servedAt || b.timestamp) -
          new Date(a.servedAt || a.timestamp)
      );

      // Calculate pagination
      const totalPages = Math.ceil(sortedOrders.length / ordersItemsPerPage);
      const startIdx = (ordersCurrentPage - 1) * ordersItemsPerPage;
      const endIdx = startIdx + ordersItemsPerPage;
      const pageOrders = sortedOrders.slice(startIdx, endIdx);

      // Update pagination UI
      updateOrdersPaginationControls(totalPages);

      pageOrders.forEach((order) => {
        const orderTypeKey = normalizeOrderType(order.type);
        const orderTypeTag = `<span class="pill pill-ghost order-type-tag order-type-${orderTypeKey}">${getOrderTypeLabel(
          orderTypeKey
        )}</span>`;
        const servedTime = order.servedAt || order.timestamp;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${order.id}</td>
          <td><strong>${order.customer}</strong><br/><small>${
          order.items
        }</small><div class="order-tags">${orderTypeTag}</div></td>
          <td>${formatCurrency(order.total)}</td>
          <td>${formatTime(servedTime)}</td>
          <td>
            <button class="btn btn-outline" data-receipt="${
              order.id
            }">Receipt</button>
            <button class="btn btn-secondary" data-delete-completed="${
              order.id
            }">Delete</button>
          </td>
        `;
        completedBody.appendChild(row);
      });
    }
  }

  document.querySelectorAll(".order-status").forEach((select) => {
    select.addEventListener("change", () => {
      const order = appState.orders.find(
        (item) => item.id === select.dataset.order
      );
      if (!order) return;
      order.status = select.value;
      saveState();
      renderOrders();
    });
  });

  document.querySelectorAll("[data-serve]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = appState.orders.find(
        (item) => item.id === button.dataset.serve
      );
      if (!order || order.status === "served") return;
      order.status = "served";
      order.servedAt = new Date().toISOString();

      // Update sales history
      if (typeof updateSalesHistory === "function") {
        updateSalesHistory(order.total);
      }

      saveState();
      renderOrders();
    });
  });

  const insightContainer = document.getElementById("order-status-breakdown");
  if (insightContainer) {
    insightContainer.innerHTML = "";
    const statuses = ["pending", "preparing", "ready", "served"];
    statuses.forEach((status) => {
      const ordersInStatus = (appState.orders || []).filter(
        (o) => o.status === status
      );
      const chip = document.createElement("div");
      chip.className = "chip has-details";
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.innerHTML = `<span style="font-weight:600">${status}</span><span style="opacity:0.9">${ordersInStatus.length}</span>`;
      const details = document.createElement("div");
      details.className = "chip-details";
      details.style.display = "none";
      details.style.marginTop = "0.5rem";
      details.style.fontSize = "0.85rem";
      if (!ordersInStatus.length) {
        details.innerHTML = '<div class="muted">No orders</div>';
      } else {
        details.innerHTML = ordersInStatus
          .slice(0, 6)
          .map(
            (o) =>
              `<div>${o.id} — ${o.customer} — ${formatCurrency(o.total)}</div>`
          )
          .join("");
        if (ordersInStatus.length > 6)
          details.innerHTML += `<div class="muted">+${
            ordersInStatus.length - 6
          } more</div>`;
      }
      chip.appendChild(header);
      chip.appendChild(details);
      header.style.cursor = "pointer";
      header.addEventListener("click", () => {
        details.style.display = details.style.display === "none" ? "" : "none";
      });
      insightContainer.appendChild(chip);
    });
  }

  document.querySelectorAll("[data-receipt]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = appState.orders.find(
        (item) => item.id === button.dataset.receipt
      );
      if (!order) return;
      selectedReceiptOrder = order;
      if (receiptFields.ticket) receiptFields.ticket.textContent = order.id;
      if (receiptFields.customer)
        receiptFields.customer.textContent = order.customer;
      if (receiptFields.itemsList) {
        const items = order.items
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        receiptFields.itemsList.innerHTML = items.length
          ? items.map((itemText) => `<li>${itemText}</li>`).join("")
          : "<li>No item details recorded</li>";
        if (receiptFields.itemCount)
          receiptFields.itemCount.textContent = `${items.length || 0} ${
            items.length === 1 ? "item" : "items"
          }`;
      }
      if (receiptFields.total)
        receiptFields.total.textContent = formatCurrency(order.total);
      if (receiptFields.time)
        receiptFields.time.textContent = formatTime(order.timestamp);
      if (receiptFields.note) {
        receiptFields.note.textContent =
          order.status === "served"
            ? "Order completed. Please retain this stub for reference."
            : "Please present this stub when claiming your order.";
      }
      if (receiptFields.serviceTag) {
        receiptFields.serviceTag.textContent = getOrderTypeService(order.type);
      }
      if (receiptModal) receiptModal.classList.add("active");
    });
  });

  document.querySelectorAll("#orders-table [data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.delete;
      const idx = appState.orders.findIndex((o) => o.id === id);
      if (idx === -1) return;
      showConfirm(
        `Delete order ${id}? This will restore any reserved inventory.`,
        () => {
          const order = appState.orders[idx];
          try {
            const itemsJson = order.itemsJson || [];
            (itemsJson || []).forEach((it) => {
              if (!it || !it.source) return;
              if (it.source === "inventory" || it.source === "supplies") {
                const inv = appState.inventory.find((i) => i.id === it.id);
                if (inv) {
                  inv.quantity =
                    Number(inv.quantity || 0) + Number(it.qty || 0);
                }
              }
            });
          } catch (err) {
            console.warn("Failed to restore inventory for deleted order", err);
          }
          appState.orders.splice(idx, 1);
          saveState();
          renderOrders();
        }
      );
    });
  });

  document
    .querySelectorAll("#completed-orders-table [data-delete-completed]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.deleteCompleted;
        const idx = appState.orders.findIndex((o) => o.id === id);
        if (idx === -1) return;
        showConfirm(
          `Delete completed order ${id}? This action cannot be undone.`,
          () => {
            appState.orders.splice(idx, 1);

            // Recalculate sales history after deletion
            if (typeof recalculateSalesHistory === "function") {
              recalculateSalesHistory();
            }

            saveState();
            renderOrders();
          }
        );
      });
    });

  const closeReceipt = () => {
    selectedReceiptOrder = null;
    if (receiptModal) receiptModal.classList.remove("active");
  };

  if (receiptClose && !receiptClose.dataset.bound) {
    receiptClose.dataset.bound = "true";
    receiptClose.addEventListener("click", closeReceipt);
  }
  if (receiptModal && !receiptModal.dataset.bound) {
    receiptModal.dataset.bound = "true";
    receiptModal.addEventListener("click", (event) => {
      if (event.target === receiptModal) closeReceipt();
    });
  }
  if (receiptPrintBtn && !receiptPrintBtn.dataset.bound) {
    receiptPrintBtn.dataset.bound = "true";
    receiptPrintBtn.addEventListener("click", () => {
      if (!receiptTemplate) return;
      const printWindow = window.open("", "PRINT", "height=600,width=400");
      if (!printWindow) return;
      printWindow.document.write(
        `<html><head><title>${selectedReceiptOrder?.id || "receipt"}</title>`
      );
      printWindow.document.write(
        "<style>body{font-family:'Courier New',monospace;padding:20px;background:#fff;} .receipt{border:1px dashed #000;padding:1rem;} .receipt p{margin:0.3rem 0;}</style>"
      );
      printWindow.document.write("</head><body>");
      printWindow.document.write(receiptTemplate.innerHTML);
      printWindow.document.write("</body></html>");
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      closeReceipt();
    });
  }

  if (typeof initializeOrderForm === "function") initializeOrderForm();
}

function initializeOrderForm() {
  try {
    const byId = (id) => document.getElementById(id);
    const inventoryCategory = byId("inventory-category");
    const inventoryItem = byId("inventory-item");
    const inventoryQty = byId("inventory-qty");
    const addInventoryBtn = byId("add-inventory-item");
    const suppliesSection = byId("supplies-section");
    const suppliesItem = byId("supplies-item");
    const suppliesQty = byId("supplies-qty");
    const addSuppliesBtn = byId("add-supplies-item");
    const customSection = byId("custom-section");
    const addCustomBtn = byId("add-custom-item");
    const customName = byId("custom-name");
    const customPrice = byId("custom-price");
    const customQty = byId("custom-qty");
    const orderItemsList = byId("order-items-list");
    const hiddenItems = byId("order-items");
    const orderTotalInput = byId("order-total");
    const orderType = byId("order-type");
    const ordersForm = byId("orders-form");

    if (!ordersForm) return;

    let orderItems = [];

    const formatMoney = (v) => Number(v).toFixed(2);

    const findInventory = (id) =>
      (appState.inventory || []).find((i) => i.id === id);
    const availableFor = (id) => {
      const inv = findInventory(id);
      return inv ? Number(inv.quantity) : 0;
    };

    function refreshInventoryItems() {
      if (!inventoryItem || !inventoryCategory) return;
      inventoryItem.innerHTML = "";
      const cat = inventoryCategory.value;
      const list = (appState.inventory || []).filter(
        (it) => it.category === cat
      );
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "-- Select item --";
      placeholder.disabled = true;
      placeholder.selected = true;
      inventoryItem.appendChild(placeholder);
      list.forEach((it) => {
        const opt = document.createElement("option");
        opt.value = it.id;
        opt.textContent = `${it.name} — ₱${formatMoney(it.cost)}`;
        inventoryItem.appendChild(opt);
      });
    }

    function populateInventoryCategories() {
      if (!inventoryCategory) return;
      const cats = Array.from(
        new Set((appState.inventory || []).map((i) => i.category))
      ).filter(Boolean);
      inventoryCategory.innerHTML = "";
      cats.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
        inventoryCategory.appendChild(opt);
      });
      if (cats.length) inventoryCategory.value = cats[0];
    }

    function refreshSupplies() {
      if (!suppliesItem) return;
      suppliesItem.innerHTML = "";
      const list = (appState.inventory || []).filter(
        (it) => it.category === "supplies"
      );
      list.forEach((it) => {
        const opt = document.createElement("option");
        opt.value = it.id;
        opt.textContent = `${it.name} — ₱${formatMoney(it.cost)}`;
        suppliesItem.appendChild(opt);
      });
    }

    function getOrderQtyForInventory(id) {
      return orderItems.reduce(
        (sum, it) => (it.id === id ? sum + Number(it.qty || 0) : sum),
        0
      );
    }

    function addOrMergeItem(item) {
      item.qty = Number(item.qty) || 1;
      item.unitPrice = Number(item.unitPrice) || 0;
      if (item.source === "inventory" || item.source === "supplies") {
        const invId = item.id;
        const available = availableFor(invId);
        const already = getOrderQtyForInventory(invId);
        if (already + item.qty > available) {
          alert(
            `Cannot add ${item.qty} × ${item.name}. Only ${
              available - already
            } left in stock.`
          );
          return;
        }
      }
      if (item.source === "custom") {
        const existing = orderItems.find(
          (it) => it.source === "custom" && it.name === item.name
        );
        if (existing) {
          existing.qty = Number(existing.qty) + Number(item.qty);
          existing.subtotal = Number(
            (existing.qty * existing.unitPrice).toFixed(2)
          );
        } else {
          item.subtotal = Number((item.qty * item.unitPrice).toFixed(2));
          orderItems.push(item);
        }
      } else {
        const existing = orderItems.find(
          (it) => it.id === item.id && it.source === item.source
        );
        if (existing) {
          existing.qty = Number(existing.qty) + Number(item.qty);
          existing.subtotal = Number(
            (existing.qty * existing.unitPrice).toFixed(2)
          );
        } else {
          item.subtotal = Number((item.qty * item.unitPrice).toFixed(2));
          orderItems.push(item);
        }
      }
      renderOrderItems();
    }

    function removeOrderItem(index) {
      orderItems.splice(index, 1);
      renderOrderItems();
    }

    function renderOrderItems() {
      if (!orderItemsList) return;
      orderItemsList.innerHTML = "";
      let total = 0;
      orderItems.forEach((it, idx) => {
        total += Number(it.subtotal || 0);
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.gap = "1rem";
        const left = document.createElement("div");
        left.textContent = `${it.qty}× ${it.name}`;
        const right = document.createElement("div");
        right.textContent = `₱${formatMoney(it.subtotal)}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-outline";
        btn.textContent = "Remove";
        btn.addEventListener("click", () => removeOrderItem(idx));
        li.appendChild(left);
        li.appendChild(right);
        li.appendChild(btn);
        orderItemsList.appendChild(li);
      });
      if (orderTotalInput) orderTotalInput.value = formatMoney(total);
      if (hiddenItems)
        hiddenItems.value = orderItems
          .map((it) => `${it.qty}x ${it.name}`)
          .join(", ");
      const jsonField = document.getElementById("order-items-json");
      if (jsonField) jsonField.value = JSON.stringify(orderItems);
    }

    if (inventoryCategory)
      inventoryCategory.addEventListener("change", refreshInventoryItems);
    if (addInventoryBtn)
      addInventoryBtn.addEventListener("click", () => {
        const id = inventoryItem.value;
        const qty = Number(inventoryQty.value) || 1;
        const inv = findInventory(id);
        if (!inv) return alert("Please select an inventory item");
        addOrMergeItem({
          source: "inventory",
          id: inv.id,
          name: inv.name,
          qty,
          unitPrice: inv.cost,
        });
        if (inventoryItem) {
          inventoryItem.value = "";
          inventoryItem.selectedIndex = 0;
        }
        if (inventoryQty) inventoryQty.value = "1";
      });

    if (addSuppliesBtn)
      addSuppliesBtn.addEventListener("click", () => {
        const id = suppliesItem.value;
        const qty = Number(suppliesQty.value) || 1;
        const inv = findInventory(id);
        if (!inv) return alert("Please select a supply item");
        addOrMergeItem({
          source: "supplies",
          id: inv.id,
          name: inv.name,
          qty,
          unitPrice: inv.cost,
        });
        if (suppliesItem) {
          suppliesItem.value = "";
          suppliesItem.selectedIndex = 0;
        }
        if (suppliesQty) suppliesQty.value = "1";
      });

    if (addCustomBtn)
      addCustomBtn.addEventListener("click", () => {
        const name = (customName.value || "").trim();
        const price = Number(customPrice.value) || 0;
        const qty = Number(customQty.value) || 1;
        if (!name) return alert("Enter item name");
        addOrMergeItem({ source: "custom", name, qty, unitPrice: price });
        customName.value = "";
        customPrice.value = "0.00";
        customQty.value = "1";
      });

    function updateSuppliesVisibility() {
      const type = (orderType?.value || "").toLowerCase();
      if (type === "takeout" || type === "delivery") {
        if (suppliesSection) suppliesSection.style.display = "";
      } else {
        if (suppliesSection) suppliesSection.style.display = "none";
      }
    }
    if (orderType)
      orderType.addEventListener("change", updateSuppliesVisibility);

    const itemModeRadios = document.querySelectorAll('input[name="item-mode"]');
    function updateItemModeVisibility() {
      const mode =
        document.querySelector('input[name="item-mode"]:checked')?.value ||
        "inventory";
      if (mode === "inventory") {
        if (inventoryCategory)
          inventoryCategory.closest("div")?.classList.remove("hidden");
        if (inventoryItem)
          inventoryItem.closest("div")?.classList.remove("hidden");
        if (document.getElementById("inventory-section"))
          document.getElementById("inventory-section").style.display = "";
        if (customSection) customSection.style.display = "none";
      } else {
        if (document.getElementById("inventory-section"))
          document.getElementById("inventory-section").style.display = "none";
        if (customSection) customSection.style.display = "";
      }
    }
    itemModeRadios.forEach((r) =>
      r.addEventListener("change", updateItemModeVisibility)
    );

    ordersForm.addEventListener("submit", () => {
      setTimeout(() => {
        orderItems = [];
        renderOrderItems();
      }, 150);
    });

    populateInventoryCategories();
    refreshInventoryItems();
    refreshSupplies();
    updateSuppliesVisibility();
    updateItemModeVisibility();
    renderOrderItems();
  } catch (err) {
    console.warn("initializeOrderForm failed", err);
  }
}

// Pagination functions for completed orders
function updateOrdersPaginationControls(totalPages) {
  const currentPageEl = document.getElementById("orders-current-page");
  const totalPagesEl = document.getElementById("orders-total-pages");
  const prevBtn = document.getElementById("orders-prev-btn");
  const nextBtn = document.getElementById("orders-next-btn");
  const pagination = document.getElementById("orders-pagination");

  if (!currentPageEl || !totalPagesEl || !prevBtn || !nextBtn) return;

  // Hide pagination if only one page or no orders
  if (totalPages <= 1) {
    pagination.style.display = "none";
    return;
  } else {
    pagination.style.display = "flex";
  }

  currentPageEl.textContent = ordersCurrentPage;
  totalPagesEl.textContent = totalPages;

  // Enable/disable buttons
  prevBtn.disabled = ordersCurrentPage === 1;
  nextBtn.disabled = ordersCurrentPage >= totalPages;
}

function ordersPreviousPage() {
  if (ordersCurrentPage > 1) {
    ordersCurrentPage--;
    renderOrders();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function ordersNextPage() {
  const completedOrders = appState.orders
    ? appState.orders.filter((o) => o.status === "served")
    : [];
  const totalPages = Math.ceil(completedOrders.length / ordersItemsPerPage);
  if (ordersCurrentPage < totalPages) {
    ordersCurrentPage++;
    renderOrders();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["orders"] = function () {
  renderOrders();
  // Initialize POS system after rendering orders
  if (!window.posInitialized) {
    initializePOS();
    window.posInitialized = true;
  }
};
