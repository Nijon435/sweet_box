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
        showClearCartModal();
      }
    });
  }

  renderCart();
}

// Get unique categories from inventory
function getCategories() {
  const categories = new Set(["all"]);
  (appState.inventory || []).forEach((item) => {
    if (item.category && item.category.toLowerCase() !== "ingredients") {
      // Show all categories except ingredients
      let normalizedCategory = item.category.toLowerCase();
      if (
        normalizedCategory.includes("cake") ||
        normalizedCategory.includes("pastries")
      ) {
        normalizedCategory = "cakes";
      }
      categories.add(normalizedCategory);
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
    (item) => item.category && item.category.toLowerCase() !== "ingredients"
  );

  // Filter by category
  if (currentCategory !== "all") {
    products = products.filter((item) => {
      let itemCategory = item.category.toLowerCase();
      // Normalize category for comparison
      if (itemCategory.includes("cake") || itemCategory.includes("pastries")) {
        itemCategory = "cakes";
      }
      return itemCategory === currentCategory.toLowerCase();
    });
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
      <div class="product-name">${product.name}</div>
      <div class="product-price">₱${Number(product.cost || 0).toFixed(2)}</div>
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
      unitPrice: Number(product.cost || 0),
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

// Show clear cart confirmation modal
function showClearCartModal() {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;";

  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 70px; height: 70px; background: #ef4444; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);">
          <span style="color: white; font-size: 2.5rem; font-weight: bold;">🗑️</span>
        </div>
        <h3 style="margin: 0 0 0.75rem 0; font-size: 1.5rem; color: #1f2937;">Clear Cart?</h3>
        <p style="margin: 0; color: #6b7280; font-size: 1rem; line-height: 1.5;">This will remove all items from your cart. This action cannot be undone.</p>
      </div>
      <div style="display: flex; gap: 0.75rem;">
        <button id="cancel-clear-cart" style="flex: 1; padding: 0.875rem; border: 2px solid #e5e7eb; background: white; border-radius: 10px; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">Cancel</button>
        <button id="confirm-clear-cart" style="flex: 1; padding: 0.875rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">Clear Cart</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("cancel-clear-cart")
    .addEventListener("click", () => modal.remove());
  document
    .getElementById("confirm-clear-cart")
    .addEventListener("click", () => {
      posCart = [];
      const customerInput = document.getElementById("pos-customer");
      if (customerInput) customerInput.value = "";
      renderCart();
      modal.remove();
    });
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

// Complete order with styled confirmation
function completeOrder() {
  const customerInput = document.getElementById("pos-customer");
  const orderTypeSelect = document.getElementById("pos-order-type");

  if (posCart.length === 0) {
    showStyledAlert(
      "Cart is empty",
      "Please add items to the cart before completing the order.",
      "warning"
    );
    return;
  }

  const customer = customerInput?.value.trim();

  // Validate customer name is not empty
  if (!customer) {
    showStyledAlert(
      "Customer Required",
      "Please enter a customer name or table number before completing the order.",
      "warning"
    );
    if (customerInput) {
      customerInput.focus();
      customerInput.style.borderColor = "#ef4444";
      setTimeout(() => {
        customerInput.style.borderColor = "";
      }, 2000);
    }
    return;
  }

  const orderType = orderTypeSelect?.value || "dine-in";

  // Show custom confirmation modal
  showCompleteOrderModal(customer, orderType);
}

// Show styled alert/notification
function showStyledAlert(title, message, type = "info") {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;";

  const icons = {
    success: "✓",
    warning: "⚠",
    error: "✕",
    info: "ℹ",
  };

  const colors = {
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
  };

  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 70px; height: 70px; background: ${colors[type]}; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px ${colors[type]}40;">
          <span style="color: white; font-size: 2.5rem; font-weight: bold;">${icons[type]}</span>
        </div>
        <h3 style="margin: 0 0 0.75rem 0; font-size: 1.5rem; color: #1f2937;">${title}</h3>
        <p style="margin: 0; color: #6b7280; font-size: 1rem; line-height: 1.5;">${message}</p>
      </div>
      <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="width: 100%; padding: 0.875rem; background: linear-gradient(135deg, ${colors[type]} 0%, ${colors[type]}dd 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1rem; box-shadow: 0 4px 12px ${colors[type]}40; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">Got it</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Add animation styles
  if (!document.getElementById("modal-animations")) {
    const style = document.createElement("style");
    style.id = "modal-animations";
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;
    document.head.appendChild(style);
  }
}

// Show complete order confirmation modal
function showCompleteOrderModal(customer, orderType) {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;";

  const total = posCart.reduce(
    (sum, item) => sum + item.qty * item.unitPrice,
    0
  );
  const itemCount = posCart.reduce((sum, item) => sum + item.qty, 0);
  const itemsList = posCart
    .map(
      (item) =>
        `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6;"><span>${
          item.qty
        }x ${item.name}</span><span style="font-weight: 600;">₱${(
          item.qty * item.unitPrice
        ).toFixed(2)}</span></div>`
    )
    .join("");

  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);">
          <span style="color: white; font-size: 2rem;">🛍️</span>
        </div>
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1f2937;">Complete Order?</h3>
        <p style="margin: 0; color: #6b7280; font-size: 0.95rem;">Review order details before confirming</p>
      </div>
      
      <div style="background: #f9fafb; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 2px solid #e5e7eb;">
          <div>
            <div style="font-size: 0.85rem; color: #6b7280; margin-bottom: 0.25rem;">Customer</div>
            <div style="font-weight: 600; color: #1f2937;">${customer}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: #6b7280; margin-bottom: 0.25rem;">Type</div>
            <div style="font-weight: 600; color: #1f2937; text-transform: capitalize;">${orderType}</div>
          </div>
        </div>
        <div style="font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem;">${itemCount} item${
    itemCount !== 1 ? "s" : ""
  }</div>
        <div style="max-height: 150px; overflow-y: auto;">${itemsList}</div>
        <div style="display: flex; justify-content: space-between; margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #e5e7eb;">
          <span style="font-size: 1.1rem; font-weight: 600; color: #1f2937;">Total</span>
          <span style="font-size: 1.3rem; font-weight: 700; color: #8b5cf6;">₱${total.toFixed(
            2
          )}</span>
        </div>
      </div>
      
      <div style="display: flex; gap: 0.75rem;">
        <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="flex: 1; padding: 0.875rem; border: 2px solid #e5e7eb; background: white; border-radius: 10px; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">Cancel</button>
        <button id="confirm-complete-order" style="flex: 1; padding: 0.875rem; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">Confirm Order</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("confirm-complete-order")
    .addEventListener("click", () => {
      modal.remove();
      processOrder(customer, orderType);
    });
}

// Process the actual order
async function processOrder(customer, orderType) {
  const customerInput = document.getElementById("pos-customer");

  // Calculate total first
  const total = posCart.reduce(
    (sum, item) => sum + item.qty * item.unitPrice,
    0
  );

  // Create order with date-based ID (format: ord-MMDD-N)
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePrefix = `${month}${day}`;

  const existingOrders = appState.orders || [];
  const todayOrders = existingOrders.filter((order) => {
    const match = order.id?.match(/^ord-(\d{4})-(\d+)$/);
    return match && match[1] === datePrefix;
  });

  const maxTicketNum = todayOrders.reduce((max, order) => {
    const match = order.id?.match(/^ord-\d{4}-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  const nextTicketNum = maxTicketNum + 1;

  const order = {
    id: `ord-${datePrefix}-${nextTicketNum}`,
    customer: customer,
    items: posCart.map((item) => `${item.qty}x ${item.name}`).join(", "),
    itemsJson: posCart,
    total: total,
    type: orderType,
    timestamp: getLocalTimestamp(),
  };

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
          order.id,
          `Order item: ${cartItem.name}`
        );
      }
    }
  });

  // Add order to appState
  appState.orders = appState.orders || [];
  appState.orders.push(order);

  // Save to database immediately - try individual endpoint first, fallback to bulk
  showLoading("Processing order...");
  try {
    const apiBase = window.API_BASE_URL || "";
    let response = await fetch(`${apiBase}/api/orders/${order.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(order),
    });

    // If individual endpoint not available (404), fallback to bulk save
    if (response.status === 404) {
      console.log("Individual endpoint not available, using bulk save");
      const endpoint = window.APP_STATE_ENDPOINT || "/api/state";
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(appState),
      });
    }

    if (!response.ok) {
      console.error("Failed to save order to database");
      hideLoading();
    } else {
      console.log("Order saved to database successfully");
      hideLoading();
    }
  } catch (error) {
    hideLoading();
    console.error("Error saving order to database:", error);
  }

  // Clear cart
  posCart = [];
  if (customerInput) customerInput.value = "";
  renderCart();
  renderProductsGrid(); // Update stock display

  // Show receipt in success modal (stay in POS view)
  showOrderReceiptModal(order);
}

// Show order receipt modal directly after order completion
function showOrderReceiptModal(order) {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;";

  let itemsArr = [];
  try {
    itemsArr = Array.isArray(order.itemsJson)
      ? order.itemsJson
      : JSON.parse(order.itemsJson || "[]");
  } catch {
    itemsArr = [];
  }

  const totalQty = itemsArr.reduce((sum, it) => sum + (it.qty || 0), 0);
  const itemsList = itemsArr
    .map(
      (item) => `
        <li style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6;">
          <span><span style="color: #8b5cf6; font-weight: 600;">${
            item.qty
          }×</span> ${item.name}</span>
          <span style="font-weight: 600;">₱${(
            item.qty * item.unitPrice
          ).toFixed(2)}</span>
        </li>
      `
    )
    .join("");

  const orderTypeKey = normalizeOrderType(order.type);
  const serviceTag = getOrderTypeLabel(orderTypeKey);

  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out; max-height: 90vh; overflow-y: auto;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);">
          <span style="color: white; font-size: 2rem;">✓</span>
        </div>
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1f2937;">Order Complete!</h3>
        <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">Sweet Box • San Juan City</p>
      </div>
      
      <div style="background: #f9fafb; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid #e5e7eb;">
          <div style="display: inline-block; background: #8b5cf6; color: white; padding: 0.375rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.5rem;">${
            order.id
          }</div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid #e5e7eb;">
          <div>
            <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.25rem;">Customer</div>
            <div style="font-weight: 600; color: #1f2937;">${
              order.customer
            }</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.25rem;">Type</div>
            <div style="font-weight: 600; color: #1f2937; text-transform: capitalize;">${serviceTag}</div>
          </div>
        </div>
        
        <div style="margin-bottom: 0.75rem;">
          <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">${totalQty} item${
    totalQty !== 1 ? "s" : ""
  }</div>
          <ul style="list-style: none; padding: 0; margin: 0;">${itemsList}</ul>
        </div>
        
        <div style="display: flex; justify-content: space-between; padding-top: 1rem; border-top: 2px solid #e5e7eb;">
          <span style="font-size: 1.1rem; font-weight: 600; color: #1f2937;">Total</span>
          <span style="font-size: 1.3rem; font-weight: 700; color: #10b981;">₱${order.total.toFixed(
            2
          )}</span>
        </div>
        
        <div style="text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">Thank you for dining with us!</p>
          <p style="margin: 0.25rem 0 0 0; color: #9ca3af; font-size: 0.75rem;">${formatTime(
            order.timestamp
          )}</p>
        </div>
      </div>
      
      <div style="display: flex; gap: 0.75rem;">
        <button id="close-receipt-modal" style="flex: 1; padding: 0.875rem; border: 2px solid #e5e7eb; background: white; border-radius: 10px; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">Close</button>
        <button id="print-order-receipt" style="flex: 1; padding: 0.875rem; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">🖨️ Print Receipt</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("close-receipt-modal")
    .addEventListener("click", () => {
      modal.remove();
      // Update order history in background
      renderOrders();
    });

  document
    .getElementById("print-order-receipt")
    .addEventListener("click", () => {
      const receiptContent = modal.querySelector(
        '[style*="background: #f9fafb"]'
      );
      if (receiptContent) {
        const printWindow = window.open("", "", "width=800,height=600");
        printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${order.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>${receiptContent.outerHTML}</body>
        </html>
      `);
        printWindow.document.close();
        printWindow.print();
      }
    });
}

// Show order success modal with print option (legacy - kept for compatibility)
function showOrderSuccessModal(order) {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;";

  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 70px; height: 70px; background: #10b981; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);">
          <span style="color: white; font-size: 2.5rem; font-weight: bold;">✓</span>
        </div>
        <h3 style="margin: 0 0 0.75rem 0; font-size: 1.5rem; color: #1f2937;">Order Complete</h3>
        <p style="margin: 0; color: #6b7280; font-size: 1rem; line-height: 1.5;">Order ${order.id} created successfully for ${order.customer}!</p>
      </div>
      <div style="display: flex; gap: 0.75rem;">
        <button id="close-success-modal" style="flex: 1; padding: 0.875rem; border: 2px solid #e5e7eb; background: white; border-radius: 10px; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">Close</button>
        <button id="print-receipt-btn" style="flex: 1; padding: 0.875rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">🖨️ Print Receipt</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("close-success-modal")
    .addEventListener("click", () => modal.remove());
  document.getElementById("print-receipt-btn").addEventListener("click", () => {
    modal.remove();
    // Find and trigger the receipt modal for this order
    showReceiptForOrder(order);
  });
}

// Show receipt modal for a specific order
function showReceiptForOrder(order) {
  const receiptModal = document.getElementById("receipt-modal");
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

  if (receiptFields.ticket) receiptFields.ticket.textContent = order.id;
  if (receiptFields.customer)
    receiptFields.customer.textContent = order.customer;
  if (receiptFields.total)
    receiptFields.total.textContent = formatCurrency(order.total);
  if (receiptFields.time)
    receiptFields.time.textContent = formatTime(order.timestamp);

  let itemsArr = [];
  try {
    itemsArr = Array.isArray(order.itemsJson)
      ? order.itemsJson
      : JSON.parse(order.itemsJson || "[]");
  } catch {
    itemsArr = [];
  }

  if (receiptFields.itemCount) {
    const totalQty = itemsArr.reduce((sum, it) => sum + (it.qty || 0), 0);
    receiptFields.itemCount.textContent = `${totalQty} item${
      totalQty !== 1 ? "s" : ""
    }`;
  }

  if (receiptFields.itemsList) {
    receiptFields.itemsList.innerHTML = "";
    itemsArr.forEach((item) => {
      const li = document.createElement("li");
      li.className = "receipt-item";
      const itemTotal = item.qty * item.unitPrice;
      li.innerHTML = `
        <span class="receipt-item-qty">${item.qty}×</span>
        <span class="receipt-item-name">${item.name}</span>
        <span class="receipt-item-price">${formatCurrency(itemTotal)}</span>
      `;
      receiptFields.itemsList.appendChild(li);
    });
  }

  const orderTypeKey = normalizeOrderType(order.type);
  if (receiptFields.serviceTag) {
    receiptFields.serviceTag.textContent = getOrderTypeLabel(orderTypeKey);
  }

  if (receiptModal) {
    receiptModal.setAttribute("aria-hidden", "false");
  }
}

// Make functions globally available
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;

// Update order statistics
function updateOrderStatistics() {
  const allOrders = appState.orders || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate statistics
  const totalOrders = allOrders.length;
  const totalRevenue = allOrders.reduce(
    (sum, order) => sum + (order.total || 0),
    0
  );
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const todayOrders = allOrders.filter((order) => {
    const orderDate = new Date(order.timestamp);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
  }).length;

  // Update DOM
  const statTotalOrders = document.getElementById("stat-total-orders");
  const statTotalRevenue = document.getElementById("stat-total-revenue");
  const statAvgOrder = document.getElementById("stat-avg-order");
  const statTodayOrders = document.getElementById("stat-today-orders");

  if (statTotalOrders) statTotalOrders.textContent = totalOrders;
  if (statTotalRevenue)
    statTotalRevenue.textContent = `₱${totalRevenue.toFixed(2)}`;
  if (statAvgOrder) statAvgOrder.textContent = `₱${avgOrder.toFixed(2)}`;
  if (statTodayOrders) statTodayOrders.textContent = todayOrders;
}

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
        type: orderType,
        timestamp: getLocalTimestamp(),
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

  // Update order statistics
  updateOrderStatistics();

  const tableBody = document.querySelector("#orders-table tbody");
  if (tableBody) {
    tableBody.innerHTML = "";
    // Show all non-archived orders
    const allOrders = (appState.orders || [])
      .filter((order) => !order.archived)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!allOrders.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="5" class="empty-state">No orders yet.</td>`;
      tableBody.appendChild(emptyRow);
      updateOrdersPaginationControls(0);
    } else {
      // Apply pagination
      const totalPages = Math.ceil(allOrders.length / ordersItemsPerPage);
      const startIdx = (ordersCurrentPage - 1) * ordersItemsPerPage;
      const endIdx = startIdx + ordersItemsPerPage;
      const pageOrders = allOrders.slice(startIdx, endIdx);

      pageOrders.forEach((order) => {
        const orderTypeKey = normalizeOrderType(order.type);
        const orderTypeTag = `<span class="pill pill-ghost order-type-tag order-type-${orderTypeKey}">${getOrderTypeLabel(
          orderTypeKey
        )}</span>`;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${order.id}</td>
          <td><strong>${order.customer}</strong><br/><small>${
          order.items
        }</small><div class="order-tags">${orderTypeTag}</div></td>
          <td>${formatCurrency(order.total)}</td>
          <td>${formatTime(order.timestamp)}</td>
          <td class="orders-actions">
            <button class="btn btn-outline" data-receipt="${
              order.id
            }">Receipt</button>
            <button class="btn btn-warning" data-archive="${
              order.id
            }">Archive</button>
          </td>
        `;
        tableBody.appendChild(row);
      });

      updateOrdersPaginationControls(totalPages);
    }
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
        // Handle both string and array formats for items
        let items = [];
        if (typeof order.items === "string") {
          items = order.items
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        } else if (Array.isArray(order.items)) {
          items = order.items.map((item) =>
            typeof item === "object"
              ? `${item.name} x${item.quantity}`
              : String(item)
          );
        } else if (order.items) {
          items = [String(order.items)];
        }

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
          "Please retain this receipt for your reference.";
      }
      if (receiptFields.serviceTag) {
        receiptFields.serviceTag.textContent = getOrderTypeService(order.type);
      }
      if (receiptModal) receiptModal.classList.add("active");
    });
  });

  document.querySelectorAll("#orders-table [data-archive]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.archive;
      const order = appState.orders.find((o) => o.id === id);
      if (!order) return;
      showConfirm(
        `Archive order ${id}? This will move it to the archive.`,
        async () => {
          // Mark as archived
          const currentUser = getCurrentUser();
          order.archived = true;
          order.archivedAt = getLocalTimestamp();
          order.archivedBy = currentUser?.id || null;

          // Save to database using individual endpoint
          try {
            const apiBase = window.API_BASE_URL || "";
            let response = await fetch(`${apiBase}/api/orders/${order.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(order),
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
              throw new Error("Failed to archive order");
            }
          } catch (error) {
            console.error("Error archiving order:", error);
            alert("Failed to archive order");
            return;
          }

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
      if (type === "pickup" || type === "delivery") {
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

// Orders pagination functions
function updateOrdersPaginationControls(totalPages) {
  const currentPageEl = document.getElementById("orders-current-page");
  const totalPagesEl = document.getElementById("orders-total-pages");
  const prevBtn = document.getElementById("orders-prev-btn");
  const nextBtn = document.getElementById("orders-next-btn");
  const pagination = document.getElementById("orders-pagination");

  if (!currentPageEl || !totalPagesEl || !prevBtn || !nextBtn || !pagination)
    return;

  // Hide pagination if no pages or only one page
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
  }
}

function ordersNextPage() {
  ordersCurrentPage++;
  renderOrders();
}

window.ordersPreviousPage = ordersPreviousPage;
window.ordersNextPage = ordersNextPage;

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["orders"] = function () {
  renderOrders();
  // Initialize POS system after rendering orders
  if (!window.posInitialized) {
    initializePOS();
    window.posInitialized = true;
  }
};
