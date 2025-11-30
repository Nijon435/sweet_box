const STORAGE_KEY = "cake_restaurant_suite_v1";
const SESSION_KEY = "cake_restaurant_active_user";

const PREFER_SERVER_DATA = true;

const ACCOUNTS = [
  { id: "admin-1", name: "", role: "admin", pin: "4321" },
  { id: "staff-1", name: "", role: "inventory_manager", pin: "1111" },
  { id: "staff-2", name: "", role: "staff", pin: "2222" },
];

function capitalizeWord(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function formatRole(role) {
  if (!role) return "";
  return role.replace(/_/g, " ").split(" ").map(capitalizeWord).join(" ");
}

function displayNameFromAccount(account, opts = {}) {
  let base = (account && account.name && account.name.trim()) || "";
  if (!base && account && account.id) {
    base = account.id.replace(/-\d+$/, "").replace(/[_-]/g, " ");
  }
  base = base.trim();
  if (!base) return "";
  if (opts.titleCase) {
    return base
      .split(" ")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }
  if (opts.lowercase) return base.toLowerCase();
  return base;
}

window.formatRole = formatRole;
window.displayNameFromAccount = displayNameFromAccount;
window.formatAccountLabel = function (account) {
  const name = displayNameFromAccount(account, { titleCase: true });
  const role = formatRole(account.role);
  return name ? `${name} - ${role}` : role;
};

const getDefaultData = () => getEmptyData();

const getEmptyData = () => ({
  users: [],
  attendanceLogs: [],
  inventory: [],
  orders: [],
  salesHistory: [],
  inventoryUsage: [],
  attendanceTrend: [],
  requests: [],
  ingredientUsageLogs: [], // New: separate ingredient usage tracking
});

async function fetchServerState() {
  const endpoint =
    (typeof window !== "undefined" && window.APP_STATE_ENDPOINT) ||
    "/api/state";
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok)
    throw new Error(
      `Failed to fetch server state: ${res.status} ${res.statusText}`
    );
  return res.json();
}

const deepClone = (value) => JSON.parse(JSON.stringify(value));

let appState = getEmptyData();
let activeUser = loadSession();
let authCallback = null;
let liveClockTimer = null;
let selectedReceiptOrder = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Handle new format (essential data only) or old format (full state)
      if (data.users && !data.orders && !data.inventory) {
        // New format: only essential data stored
        // Return full state structure with loaded users
        const fullState = getEmptyData();
        fullState.users = data.users;
        return fullState;
      }
      // Old format: full state stored
      return data;
    }
  } catch (error) {
    console.warn("Unable to parse saved data", error);
    // Clear corrupted data
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Could not clear corrupted localStorage", e);
    }
  }
  if (
    typeof window !== "undefined" &&
    (window.SERVER_HAS_DATA || PREFER_SERVER_DATA)
  ) {
    return getEmptyData();
  }
  return getDefaultData();
}

function loadSession() {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;

  // Try to find in appState.users first (from database)
  if (appState && appState.users) {
    const user = appState.users.find((u) => u.id === id);
    if (user) return user;
  }

  // Fallback to hardcoded ACCOUNTS for backward compatibility
  return ACCOUNTS.find((account) => account.id === id) || null;
}

function setSession(userId) {
  localStorage.setItem(SESSION_KEY, userId);

  // Try to find in appState.users first
  if (appState && appState.users) {
    activeUser = appState.users.find((u) => u.id === userId);
  }

  // Fallback to ACCOUNTS
  if (!activeUser) {
    activeUser = ACCOUNTS.find((account) => account.id === userId) || null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  activeUser = null;
}

const getCurrentUser = () => {
  if (activeUser) return activeUser;

  // Try to reload from session
  const id = localStorage.getItem(SESSION_KEY);
  if (id && appState && appState.users) {
    activeUser = appState.users.find((u) => u.id === id);
    if (activeUser) return activeUser;
  }

  return null;
};

const isAdmin = () => getCurrentUser()?.permission === "admin";

const isManager = () => getCurrentUser()?.permission === "manager";

const isAdminOrManager = () => isAdmin() || isManager();

const getLandingPageForRole = (role) => {
  if (role === "admin") return "index.html";
  if (role === "manager") return "employees.html";
  if (role === "kitchen_staff") return "orders.html";
  if (role === "front_staff") return "orders.html";
  if (role === "delivery_staff") return "orders.html";
  return "attendance.html";
};

// Database sync functionality
let saveTimeout = null;
let isSyncing = false;

async function syncStateToDatabase() {
  // DATABASE SYNC PERMANENTLY DISABLED
  // Data is now read-only from the server to prevent data loss
  // All updates go through individual API endpoints (PUT /api/inventory, etc.)
  console.log(
    "ℹ️ Database sync disabled - using individual API endpoints for updates"
  );
  return;

  try {
    isSyncing = true;
    const endpoint =
      (typeof window !== "undefined" && window.APP_STATE_ENDPOINT) ||
      "/api/state";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(appState),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Failed to sync to database:",
        response.status,
        response.statusText,
        errorText
      );
    } else {
      console.log("State synced to database successfully");
      // Only store essential data in localStorage
      try {
        const essentialData = {
          users: appState.users || [],
          lastSync: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialData));
      } catch (e) {
        console.warn("Failed to update localStorage after database sync", e);
      }
    }
  } catch (error) {
    console.error("Unable to sync to database:", error);
  } finally {
    isSyncing = false;
  }
}

function saveState() {
  try {
    // Only store essential data (users) in localStorage to avoid quota issues
    const essentialData = {
      users: appState.users || [],
      lastSync: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialData));

    // Debounce database sync (wait 500ms after last change)
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      syncStateToDatabase();
    }, 500);
  } catch (error) {
    console.warn("Unable to save data", error);
    // Try to clear and save again if quota exceeded
    try {
      localStorage.clear();
      const essentialData = {
        users: appState.users || [],
        lastSync: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialData));
    } catch (retryError) {
      console.error(
        "Failed to save even after clearing localStorage",
        retryError
      );
    }
  }
}

function resetDemoData() {
  appState = getDefaultData();
  saveState();
  window.location.reload();
}

const ChartManager = (() => {
  const registry = {};
  return {
    plot(id, config) {
      const canvas = document.getElementById(id);
      if (!canvas || typeof Chart === "undefined") return;
      if (registry[id]) registry[id].destroy();
      registry[id] = new Chart(canvas, config);
    },
  };
})();

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    value || 0
  );

const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const parseDateKey = (dateString) => new Date(`${dateString}T00:00:00`);

const ORDER_TYPE_META = {
  "dine-in": { label: "Dine-in", service: "Dine-in service" },
  takeout: { label: "Takeout", service: "Counter pickup" },
  delivery: { label: "Delivery", service: "Delivery dispatch" },
};

const ORDER_TYPE_FORM_COPY = {
  "dine-in": {
    label: "Customer / Table",
    placeholder: "Table 7 or walk-in guest",
  },
  takeout: {
    label: "Customer name",
    placeholder: "Walk-in guest or pickup name",
  },
  delivery: {
    label: "Delivery address",
    placeholder: "123 San Juan St., Order #8821",
  },
};

const ATTENDANCE_ACTION_META = {
  in: {
    label: "Clock In",
    timeline: "clocked in",
    badge: "present",
    requiresReason: false,
  },
  out: {
    label: "Clock Out",
    timeline: "clocked out",
    badge: "served",
    requiresReason: false,
  },
  sick: {
    label: "Sick Leave",
    timeline: "reported in sick",
    badge: "absent",
    requiresReason: true,
  },
  absent: {
    label: "Marked absent",
    timeline: "was marked absent",
    badge: "absent",
    requiresReason: true,
  },
};

const getAttendanceActionMeta = (action) =>
  ATTENDANCE_ACTION_META[action] || {
    label: action,
    timeline: "updated attendance",
    badge: "pending",
    requiresReason: false,
  };
const attendanceActionRequiresReason = (action) =>
  Boolean(ATTENDANCE_ACTION_META[action]?.requiresReason);

const normalizeOrderType = (type) => (ORDER_TYPE_META[type] ? type : "dine-in");
const getOrderTypeLabel = (type) =>
  ORDER_TYPE_META[normalizeOrderType(type)].label;
const getOrderTypeService = (type) =>
  ORDER_TYPE_META[normalizeOrderType(type)].service;

const todayKey = () => new Date().toISOString().split("T")[0];

const getEmployee = (id) => appState.users.find((emp) => emp.id === id);
const getTodaysLogs = () =>
  appState.attendanceLogs.filter((log) => log.timestamp.startsWith(todayKey()));

const computeEmployeeStatus = (employee) => {
  // Check if employee is on approved leave today
  const today = todayKey();
  const onLeave = (appState.requests || []).some((leave) => {
    // Support both camelCase (frontend) and snake_case (database)
    const empId = leave.employeeId || leave.employee_id;
    if (empId !== employee.id || leave.status !== "approved") {
      return false;
    }
    const start = leave.startDate || leave.start_date;
    const end = leave.endDate || leave.end_date;
    return today >= start && today <= end;
  });

  if (onLeave) {
    return { status: "on-leave", timestamp: "On Leave" };
  }

  const todayLogs = appState.attendanceLogs
    .filter(
      (log) =>
        log.employeeId === employee.id && log.timestamp.startsWith(todayKey())
    )
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Check if has shift time and past shift time
  const now = new Date();
  const shiftStart = employee.shiftStart || employee.shift_start;
  let isPastShiftTime = false;

  if (shiftStart && typeof shiftStart === "string") {
    const shiftParts = shiftStart.split(":");
    if (shiftParts.length >= 2) {
      const [hours, minutes] = shiftParts;
      const shiftTime = new Date();
      shiftTime.setHours(Number(hours), Number(minutes), 0, 0);
      isPastShiftTime = now > shiftTime;
    }
  }

  if (!todayLogs.length) {
    // If past shift time and no logs, mark as absent
    return isPastShiftTime
      ? { status: "absent", timestamp: "No log" }
      : { status: "absent", timestamp: "Not yet" };
  }

  const firstIn = todayLogs.find((log) => log.action === "in");
  const latest = todayLogs[todayLogs.length - 1];

  // If clocked out, show as clocked-out (grey)
  if (latest.action === "out") {
    return { status: "clocked-out", timestamp: formatTime(latest.timestamp) };
  }

  if (!firstIn)
    return { status: "absent", timestamp: formatTime(latest.timestamp) };

  // Handle missing or invalid shiftStart
  if (!employee.shiftStart || typeof employee.shiftStart !== "string") {
    return { status: "present", timestamp: formatTime(latest.timestamp) };
  }

  const shift = new Date();
  const shiftParts = employee.shiftStart.split(":");
  if (shiftParts.length < 2) {
    return { status: "present", timestamp: formatTime(latest.timestamp) };
  }

  const [hours, minutes] = shiftParts;
  shift.setHours(Number(hours), Number(minutes), 0, 0);
  const diff = (new Date(firstIn.timestamp) - shift) / 60000;
  return {
    status: diff > 15 ? "late" : "present",
    timestamp: formatTime(latest.timestamp),
  };
};

const categorizeInventory = () => {
  const groups = { cakes: [], ingredients: [], supplies: [], beverages: [] };
  appState.inventory.forEach((item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });
  return groups;
};

const inventoryStats = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const value = appState.inventory.reduce(
    (sum, item) => sum + item.quantity * item.cost,
    0
  );
  const outOfStock = appState.inventory.filter(
    (item) => item.quantity === 0
  ).length;
  const lowStock = appState.inventory.filter((item) => {
    const threshold =
      item.category === "supplies" || item.category === "beverages" ? 10 : 5;
    return item.quantity > 0 && item.quantity < threshold;
  }).length;

  const expired = appState.inventory.filter((item) => {
    if (!item.useByDate) return false;
    const expireDate = new Date(item.useByDate);
    return expireDate < today;
  }).length;

  const soonToExpire = appState.inventory.filter((item) => {
    if (!item.useByDate) return false;
    const expireDate = new Date(item.useByDate);
    return expireDate >= today && expireDate <= sevenDaysFromNow;
  }).length;

  return {
    totalItems: appState.inventory.length,
    lowStock,
    outOfStock,
    expired,
    soonToExpire,
    value,
  };
};

const orderStats = () => {
  const buckets = { pending: 0, preparing: 0, ready: 0, served: 0 };
  appState.orders.forEach((order) => {
    buckets[order.status] = (buckets[order.status] || 0) + 1;
  });
  return buckets;
};

const updateSalesHistory = (amount, date = todayKey()) => {
  const existing = appState.salesHistory.find((entry) => entry.date === date);
  if (existing) {
    existing.total += amount;
    existing.ordersCount = (existing.ordersCount || 0) + 1;
  } else {
    appState.salesHistory.push({
      id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date,
      total: amount,
      ordersCount: 1,
    });
  }
  appState.salesHistory.sort((a, b) => a.date.localeCompare(b.date));
};

const recalculateSalesHistory = () => {
  // Group served orders by date
  const salesByDate = {};
  const ordersCountByDate = {};
  (appState.orders || []).forEach((order) => {
    if (order.status === "served" && order.servedAt) {
      const date = order.servedAt.split("T")[0];
      salesByDate[date] = (salesByDate[date] || 0) + (order.total || 0);
      ordersCountByDate[date] = (ordersCountByDate[date] || 0) + 1;
    }
  });

  // Update sales history
  appState.salesHistory = Object.entries(salesByDate)
    .map(([date, total]) => ({
      id: `sale-${date}`,
      date,
      total,
      ordersCount: ordersCountByDate[date] || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const salesToday = () =>
  appState.salesHistory.find((entry) => entry.date === todayKey())?.total || 0;
const salesYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const key = yesterday.toISOString().split("T")[0];
  return appState.salesHistory.find((entry) => entry.date === key)?.total || 0;
};

const lowStockItems = () =>
  appState.inventory
    .filter((item) => {
      const threshold =
        item.category === "supplies" || item.category === "beverages" ? 10 : 5;
      return item.quantity < threshold;
    })
    .sort((a, b) => a.quantity - b.quantity);

const highlightNavigation = () => {
  const page = document.body.dataset.page;
  document.querySelectorAll(".nav a[data-section]").forEach((link) => {
    if (link.dataset.section === page) link.classList.add("active");
  });
};

const mountLiveClock = () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || sidebar.querySelector(".live-clock")) return;
  const clock = document.createElement("div");
  clock.className = "live-clock";
  clock.setAttribute("aria-live", "polite");
  clock.innerHTML = `
    <span class="live-clock__label">Today</span>
    <strong class="live-clock__date" id="live-date">--</strong>
    <span class="live-clock__time" id="live-time">--:-- --</span>
  `;
  sidebar.appendChild(clock);
};

const startLiveClock = () => {
  const dateNode = document.getElementById("live-date");
  const timeNode = document.getElementById("live-time");
  if (!dateNode || !timeNode) return;
  const update = () => {
    const now = new Date();
    dateNode.textContent = now.toLocaleDateString("en-PH", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    timeNode.textContent = now.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };
  update();
  if (liveClockTimer) clearInterval(liveClockTimer);
  liveClockTimer = setInterval(update, 1000);
};

const attachGlobalActions = () => {
  const refreshButton = document.getElementById("refresh-data");
  if (refreshButton)
    refreshButton.addEventListener("click", () => window.location.reload());
  const resetButton = document.getElementById("reset-data");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (!isAdmin()) {
        alert("Admin access required to reset data.");
        return;
      }
      resetDemoData();
    });
  }

  const editProfileBtn = document.getElementById("edit-profile-btn");
  if (editProfileBtn && !editProfileBtn.dataset.bound) {
    editProfileBtn.dataset.bound = "true";
    editProfileBtn.addEventListener("click", () => {
      openEditProfileModal();
    });
  }

  const logoutButton = document.getElementById("logout-btn");
  if (logoutButton && !logoutButton.dataset.bound) {
    logoutButton.dataset.bound = "true";
    logoutButton.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }
};

function setupSidebarToggle() {
  const body = document.body;
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  let backdrop = document.querySelector(".sidebar-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
  }
  let hamb = document.querySelector(".mobile-hamburger");
  if (!hamb) {
    hamb = document.createElement("button");
    hamb.className = "mobile-hamburger";
    hamb.setAttribute("aria-label", "Toggle navigation");
    hamb.innerHTML = "&#9776;";
    document.body.appendChild(hamb);
  }
  let closeBtn = sidebar.querySelector(".close-mobile");
  if (!closeBtn) {
    closeBtn = document.createElement("button");
    closeBtn.className = "close-mobile";
    closeBtn.setAttribute("aria-label", "Close navigation");
    closeBtn.innerHTML = "✕";
    sidebar.insertBefore(closeBtn, sidebar.firstChild);
  }
  function openSidebar() {
    body.classList.add("sidebar-open");
    sidebar.classList.add("mobile-visible");
  }
  function closeSidebar() {
    body.classList.remove("sidebar-open");
    sidebar.classList.remove("mobile-visible");
  }
  if (!hamb.dataset.bound) {
    hamb.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains("mobile-visible")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
    hamb.dataset.bound = "true";
  }
  if (!backdrop.dataset.bound) {
    backdrop.addEventListener("click", closeSidebar);
    backdrop.dataset.bound = "true";
  }
  if (!closeBtn.dataset.bound) {
    closeBtn.addEventListener("click", closeSidebar);
    closeBtn.dataset.bound = "true";
  }
  const navLinks = sidebar.querySelectorAll(".nav a[href]");
  navLinks.forEach((link) => {
    if (!link.dataset.closeBound) {
      link.addEventListener("click", (e) => {
        const isMobileNow = window.matchMedia("(max-width: 1100px)").matches;
        if (isMobileNow) closeSidebar();
      });
      link.dataset.closeBound = "true";
    }
  });
  const mq = window.matchMedia("(max-width: 1100px)");
  function updateControls() {
    const isMobile = mq.matches;
    hamb.style.display = isMobile ? "flex" : "none";
    closeBtn.style.display = isMobile ? "block" : "none";
    if (!isMobile) {
      closeSidebar();
      sidebar.style.transform = "none";
      sidebar.style.position = "relative";
    } else {
      sidebar.style.position = "fixed";
    }
  }
  updateControls();
  if (typeof mq.addEventListener === "function")
    mq.addEventListener("change", updateControls);
  else if (typeof mq.addListener === "function") mq.addListener(updateControls);
}

function updateSessionDisplay(user) {
  const nameNode = document.getElementById("session-name");
  const roleNode = document.getElementById("session-role");
  const logoutButton = document.getElementById("logout-btn");
  if (!nameNode || !roleNode) return;
  if (!user) {
    nameNode.textContent = "Guest";
    roleNode.textContent = "Sign in required";
    if (logoutButton) logoutButton.disabled = true;
    return;
  }
  nameNode.textContent =
    displayNameFromAccount(user, { titleCase: true }) || "";
  roleNode.textContent = formatRole(user.role) || "";
  if (logoutButton) logoutButton.disabled = false;
}

function applyRolePermissions(user) {
  const nodes = document.querySelectorAll("[data-role]");
  nodes.forEach((node) => {
    const requiredRaw = node.dataset.role || "";
    const requiredRoles = requiredRaw
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    // Admin permission grants access to everything
    const allowed =
      Boolean(user) &&
      (user.permission === "admin" ||
        requiredRoles.length === 0 ||
        requiredRoles.includes(user.role) ||
        requiredRoles.includes(user.permission));
    const hideWhenDenied = node.dataset.hideWhenDenied === "true";
    if (!allowed && hideWhenDenied) {
      node.style.display = "none";
      return;
    }
    if (hideWhenDenied) node.style.removeProperty("display");
    if (node.tagName === "FORM") {
      node.classList.toggle("disabled-role", !allowed);
      node
        .querySelectorAll("input, select, textarea, button")
        .forEach((field) => {
          field.disabled = !allowed;
        });
    } else if ("disabled" in node) {
      node.disabled = !allowed;
    }
    if (!allowed) {
      node.classList.add("disabled-role");
      node.setAttribute("aria-disabled", "true");
    } else {
      node.classList.remove("disabled-role");
      node.removeAttribute("aria-disabled");
    }
  });
}

function showAuthOverlay(onAuthenticated) {
  authCallback = onAuthenticated;
  let overlay = document.getElementById("auth-overlay");
  if (!overlay) {
    overlay = document.createElement("section");
    overlay.id = "auth-overlay";
    overlay.className = "auth-overlay";
    overlay.innerHTML = `
      <div class="auth-card">
        <h2>Secure Access</h2>
        <p>Select your account to continue managing.</p>
        <form id="auth-form">
          <label for="auth-user">User</label>
          <select id="auth-user" required></select>
          <label for="auth-pin">PIN</label>
          <input id="auth-pin" type="password" maxlength="4" placeholder="Enter 4-digit PIN" required>
          <p class="auth-error" id="auth-error"></p>
          <button class="btn btn-primary" type="submit">Sign In</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);
  }
  const select = overlay.querySelector("#auth-user");
  if (select) {
    select.innerHTML = "<option value=''>Select user</option>";
    ACCOUNTS.forEach((account) => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = window.formatAccountLabel(account);
      select.appendChild(option);
    });
  }
  const errorNode = overlay.querySelector("#auth-error");
  if (errorNode) errorNode.textContent = "";
  const pinInput = overlay.querySelector("#auth-pin");
  if (pinInput) pinInput.value = "";
  const form = overlay.querySelector("#auth-form");
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const userId = select?.value;
      const pin = pinInput?.value?.trim();
      const account = ACCOUNTS.find((acc) => acc.id === userId);
      if (!account || account.pin !== pin) {
        if (errorNode) errorNode.textContent = "Invalid credentials";
        return;
      }
      setSession(account.id);
      updateSessionDisplay(account);
      form.reset();
      overlay.classList.remove("active");
      if (typeof authCallback === "function") authCallback();
    });
  }
  overlay.classList.add("active");
}

function initApp() {
  // Session persistence - only clear on explicit logout
  // No automatic clearing to allow navigation between pages

  // Show loading screen
  showLoadingScreen();

  mountLiveClock();
  highlightNavigation();
  attachGlobalActions();
  setupSidebarToggle();
  startLiveClock();

  if (
    typeof window !== "undefined" &&
    (window.SERVER_HAS_DATA || PREFER_SERVER_DATA)
  ) {
    fetchServerState()
      .then((serverState) => {
        if (serverState && typeof serverState === "object") {
          appState = serverState;
          console.log("📦 Server state loaded:");
          console.log("  Users:", appState.users?.length || 0);
          console.log(
            "  Attendance Logs:",
            appState.attendanceLogs?.length || 0
          );
          console.log("  Requests:", appState.requests?.length || 0);
          console.log("  Orders:", appState.orders?.length || 0);
          // Only store essential data (users) in localStorage to avoid quota issues
          // Store full state in memory only
          try {
            const essentialData = {
              users: appState.users || [],
              lastSync: Date.now(),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialData));
            console.log(
              "Synced users from server:",
              appState.users?.length || 0
            );
          } catch (e) {
            console.warn("Failed to update localStorage with server data", e);
            // Clear localStorage if quota exceeded
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch (clearError) {
              console.error("Could not clear localStorage", clearError);
            }
          }
        } else {
          appState = loadState();
        }
      })
      .catch((err) => {
        console.warn(
          "Failed to fetch server state, falling back to local state",
          err
        );
        appState = loadState();
      })
      .finally(() => {
        bootPageFlow();
        hideLoadingScreen();
      });
  } else {
    appState = loadState();
    bootPageFlow();
    hideLoadingScreen();
  }

  function bootPageFlow() {
    // Recalculate sales history from served orders
    if (typeof recalculateSalesHistory === "function") {
      recalculateSalesHistory();
    }

    const page = document.body.dataset.page;
    if (page === "login") return;

    const user = getCurrentUser();
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    updateSessionDisplay(user);
    applyRolePermissions(user);

    // Check for clock-in prompt flag
    const shouldPromptClockIn = localStorage.getItem("show_clock_in_prompt");
    if (shouldPromptClockIn === "true") {
      localStorage.removeItem("show_clock_in_prompt");

      setTimeout(() => {
        showClockInPromptModal(user, page);
      }, 500);
    }

    try {
      const renderers = window.pageRenderers || {};
      if (renderers[page] && typeof renderers[page] === "function") {
        renderers[page]();
        applyRolePermissions(user);
      }
    } catch (err) {
      console.warn("Error while rendering page", err);
    }
  }
}

function showClockInPromptModal(user, page) {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px);";

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 450px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f6c343 0%, #f59e0b 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
          <span style="color: white; font-size: 2.5rem;">🕒</span>
        </div>
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Ready to Clock In?</h3>
        <p style="margin: 0; color: #666; font-size: 0.95rem;">You haven't clocked in today yet.</p>
        <div style="margin-top: 1rem; padding: 0.75rem; background: #f3f4f6; border-radius: 8px;">
          <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Current Time</div>
          <div style="font-size: 1.25rem; font-weight: 600; color: #333;">${timeStr}</div>
        </div>
      </div>
      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button id="later-clock-in-btn" style="padding: 0.75rem 1.75rem; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-size: 1rem; min-width: 120px; font-weight: 500; color: #6b7280; transition: all 0.2s;">Later</button>
        <button id="confirm-clock-in-btn" style="padding: 0.75rem 1.75rem; background: linear-gradient(135deg, #f6c343 0%, #f59e0b 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; min-width: 120px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); transition: all 0.2s;">Clock In</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listener for Later button
  const laterBtn = document.getElementById("later-clock-in-btn");
  laterBtn.addEventListener("click", () => {
    modal.remove();
  });

  const confirmBtn = document.getElementById("confirm-clock-in-btn");
  confirmBtn.addEventListener("click", async () => {
    const shift =
      currentHour < 12 ? "Morning (7AM–12PM)" : "Afternoon (12PM–5PM)";

    // Check if user is late (>15 min past shift start)
    const shiftStart = user.shift_start || user.shiftStart;
    let isLate = false;
    let lateNote = null;

    if (shiftStart) {
      const [shiftHour, shiftMin] = shiftStart.split(":").map(Number);
      const shiftStartMinutes = shiftHour * 60 + shiftMin;
      const currentMinutes = currentHour * 60 + currentMinute;
      const minutesLate = currentMinutes - shiftStartMinutes;

      if (minutesLate > 15) {
        isLate = true;
        modal.remove();
        lateNote = await showLateNoteDialog();
        if (lateNote === null) {
          return; // User cancelled
        }
      }
    }

    const newLog = {
      id: `att-${Date.now()}`,
      employeeId: user.id,
      action: "in",
      timestamp: new Date().toISOString(),
      shift: shift,
      note: isLate && lateNote ? `Late: ${lateNote}` : null,
    };

    appState.attendanceLogs = appState.attendanceLogs || [];
    appState.attendanceLogs.push(newLog);
    await saveState();

    modal.remove();

    // Show success toast
    const toast = document.createElement("div");
    toast.style.cssText =
      "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000; font-weight: 500;";
    toast.textContent = isLate
      ? "✓ Clocked in (Late)"
      : "✓ Successfully clocked in!";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

    // Refresh page to update attendance display
    if (
      typeof window.pageRenderers === "object" &&
      typeof window.pageRenderers[page] === "function"
    ) {
      window.pageRenderers[page]();
    }
  });
}

function showLateNoteDialog() {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px);";

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: slideIn 0.3s ease-out;">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);">
            <span style="color: white; font-size: 2rem;">⚠️</span>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #333;">Late Arrival</h3>
          <p style="margin: 0; color: #666; font-size: 0.95rem;">You're arriving late. Please provide a reason.</p>
        </div>
        <textarea id="late-note-input" placeholder="Reason for late arrival..." style="width: 100%; padding: 0.875rem; border: 2px solid #e5e7eb; border-radius: 8px; min-height: 100px; margin-bottom: 1.5rem; font-size: 1rem; font-family: inherit; resize: vertical; transition: border-color 0.2s;" onfocus="this.style.borderColor='#f6c343'"></textarea>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button id="cancel-late-btn" style="padding: 0.75rem 1.5rem; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 500; color: #6b7280;">Cancel</button>
          <button id="skip-note-btn" style="padding: 0.75rem 1.5rem; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Skip Note</button>
          <button id="submit-note-btn" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #f6c343 0%, #f59e0b 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">Submit</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

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
      resolve(note || "");
    };
  });
}

function showLoadingScreen() {
  let loader = document.getElementById("app-loading-screen");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "app-loading-screen";
    loader.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: center; justify-content: center; z-index: 9999;";
    loader.innerHTML = `
      <div class="loader"></div>
      <style>
        .loader {
          width: 50px;
          aspect-ratio: 1;
          border-radius: 50%;
          background: 
            radial-gradient(farthest-side,#ffa516 94%,#0000) top/8px 8px no-repeat,
            conic-gradient(#0000 30%,#ffa516);
          -webkit-mask: radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0);
          animation: l13 1s infinite linear;
        }
        @keyframes l13{ 
          100%{transform: rotate(1turn)}
        }
      </style>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = "flex";
}

function hideLoadingScreen() {
  const loader = document.getElementById("app-loading-screen");
  if (loader) {
    loader.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", initApp);

// Save state before page unload (refresh, close, navigate away)
window.addEventListener("beforeunload", (e) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  // Synchronously save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (error) {
    console.warn("Unable to save data on unload", error);
  }
  // Trigger immediate sync to database
  syncStateToDatabase();
});

if (typeof window !== "undefined") {
  window.ACCOUNTS = ACCOUNTS;
  window.setSession = setSession;
  window.getCurrentUser = getCurrentUser;
  window.clearSession = clearSession;
  window.getLandingPageForRole = getLandingPageForRole;
  window.saveState = saveState;
  window.syncStateToDatabase = syncStateToDatabase;
  window.pageRenderers = window.pageRenderers || {};
}

function showConfirm(message, onConfirm) {
  const modal = document.getElementById("confirm-modal");
  const msg = document.getElementById("confirm-message");
  const ok = document.getElementById("confirm-ok");
  const cancel = document.getElementById("confirm-cancel");
  if (!modal || !msg || !ok || !cancel) {
    if (window.confirm(message)) onConfirm();
    return;
  }
  msg.textContent = message;
  modal.classList.add("active");
  const cleanup = () => {
    modal.classList.remove("active");
    ok.removeEventListener("click", okHandler);
    cancel.removeEventListener("click", cancelHandler);
  };
  const okHandler = () => {
    cleanup();
    try {
      onConfirm();
    } catch (err) {
      console.error(err);
    }
  };
  const cancelHandler = () => {
    cleanup();
  };
  ok.addEventListener("click", okHandler);
  cancel.addEventListener("click", cancelHandler);
}

// Edit profile modal for current user
function openEditProfileModal() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    alert("Please log in to edit your profile");
    return;
  }

  const modal = document.createElement("div");
  modal.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;";

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0; font-size: 1.5rem; color: #333;">Edit Profile</h3>
        <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #666; line-height: 1;">&times;</button>
      </div>
      <form id="edit-profile-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Name *</label>
            <input type="text" name="name" value="${
              currentUser.name
            }" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Email *</label>
            <input type="email" name="email" value="${
              currentUser.email
            }" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Phone</label>
            <input type="text" name="phone" value="${
              currentUser.phone || ""
            }" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">New Password (leave blank to keep current)</label>
            <input type="password" name="password" placeholder="Enter new password..." style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Role *</label>
            <input type="text" name="role" value="${
              currentUser.role
            }" required style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555;">Shift Start</label>
            <input type="time" name="shiftStart" value="${
              currentUser.shiftStart || ""
            }" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
          </div>
        </div>
        ${
          !isAdminOrManager()
            ? '<div style="margin-top: 0.75rem; padding: 0.75rem; background: #e3f2fd; border: 1px solid #2196F3; border-radius: 4px; font-size: 0.875rem; color: #1565C0;"><strong>Note:</strong> Your profile changes will be sent to an administrator for approval.</div>'
            : ""
        }
        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="padding: 0.625rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 1rem;">Cancel</button>
          <button type="submit" style="padding: 0.625rem 1.5rem; background: #f6c343; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 1rem;">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#edit-profile-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    // Check if user is admin or manager
    if (isAdminOrManager()) {
      // Admin/Manager can edit directly
      const userIndex = appState.users.findIndex(
        (u) => u.id === currentUser.id
      );
      if (userIndex !== -1) {
        appState.users[userIndex].name = formData.get("name");
        appState.users[userIndex].email = formData.get("email");
        appState.users[userIndex].phone = formData.get("phone");
        appState.users[userIndex].role = formData.get("role");
        appState.users[userIndex].shiftStart = formData.get("shiftStart");

        const newPassword = formData.get("password");
        if (newPassword && newPassword.trim() !== "") {
          appState.users[userIndex].password = newPassword;
        }

        // Update session storage
        sessionStorage.setItem(
          "currentUser",
          JSON.stringify(appState.users[userIndex])
        );

        saveState();
        modal.remove();

        // Update UI
        updateUserSessionUI();

        const toast = document.createElement("div");
        toast.style.cssText =
          "position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
        toast.textContent = "Profile updated successfully!";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    } else {
      // Regular user - create a profile edit request
      const requestedChanges = {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        role: formData.get("role"),
        shiftStart: formData.get("shiftStart"),
      };

      const newPassword = formData.get("password");
      if (newPassword && newPassword.trim() !== "") {
        requestedChanges.password = newPassword;
      }

      const newRequest = {
        id: `req-${Date.now()}`,
        employeeId: currentUser.id,
        requestType: "profile_edit",
        requestedChanges: requestedChanges,
        status: "pending",
        requestedAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
      };

      appState.requests = appState.requests || [];
      appState.requests.push(newRequest);

      // Save to database via API
      const baseUrl = window.APP_STATE_ENDPOINT ? window.APP_STATE_ENDPOINT.replace('/api/state', '') : '';
      fetch(`${baseUrl}/api/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRequest),
      })
        .then((res) => res.json())
        .then(() => {
          saveState();
          modal.remove();

          const toast = document.createElement("div");
          toast.style.cssText =
            "position: fixed; top: 20px; right: 20px; background: #2196F3; color: white; padding: 1rem 1.5rem; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 10000;";
          toast.textContent = "Request has been sent to admin for approval!";
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        })
        .catch((error) => {
          console.error("Error saving request:", error);
          alert("Failed to save request. Please try again.");
        });
    }
  });
}

// ==================== INGREDIENT USAGE TRACKING ====================

/**
 * Log ingredient usage with reason and optional order linkage
 * @param {string} inventoryItemId - ID of the inventory item being used
 * @param {number} quantity - Amount used
 * @param {string} reason - Reason for usage: 'order', 'waste', 'testing', 'staff_consumption', 'spoilage', 'other'
 * @param {string|null} orderId - Optional order ID if usage is from an order
 * @param {string} notes - Optional notes/description
 * @returns {object} The created usage log entry
 */
function logIngredientUsage(
  inventoryItemId,
  quantity,
  reason,
  orderId = null,
  notes = ""
) {
  if (!appState.ingredientUsageLogs) {
    appState.ingredientUsageLogs = [];
  }

  const usageLog = {
    id: `usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    inventoryItemId: inventoryItemId,
    quantity: parseFloat(quantity),
    reason: reason, // 'order', 'waste', 'testing', 'staff_consumption', 'spoilage', 'other'
    orderId: orderId,
    notes: notes,
    timestamp: new Date().toISOString(),
  };

  appState.ingredientUsageLogs.push(usageLog);
  console.log(
    `Logged ingredient usage: ${quantity} of ${inventoryItemId} for ${reason}`
  );

  return usageLog;
}

/**
 * Get all ingredient usage logs for a specific item
 * @param {string} inventoryItemId - ID of the inventory item
 * @param {object} options - Filter options: {startDate, endDate, reason}
 * @returns {array} Array of usage logs
 */
function getIngredientUsageLogs(inventoryItemId, options = {}) {
  if (!appState.ingredientUsageLogs) {
    return [];
  }

  let logs = appState.ingredientUsageLogs.filter(
    (log) => log.inventoryItemId === inventoryItemId
  );

  // Filter by date range if provided
  if (options.startDate) {
    logs = logs.filter((log) => log.timestamp >= options.startDate);
  }
  if (options.endDate) {
    logs = logs.filter((log) => log.timestamp <= options.endDate);
  }

  // Filter by reason if provided
  if (options.reason) {
    logs = logs.filter((log) => log.reason === options.reason);
  }

  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Get usage summary grouped by reason
 * @param {string} inventoryItemId - ID of the inventory item
 * @param {object} options - Filter options: {startDate, endDate}
 * @returns {object} Object with usage totals by reason
 */
function getUsageByReason(inventoryItemId, options = {}) {
  const logs = getIngredientUsageLogs(inventoryItemId, options);

  const summary = {
    order: 0,
    waste: 0,
    testing: 0,
    staff_consumption: 0,
    spoilage: 0,
    other: 0,
    total: 0,
  };

  logs.forEach((log) => {
    const reason = log.reason || "other";
    if (summary.hasOwnProperty(reason)) {
      summary[reason] += log.quantity;
    } else {
      summary.other += log.quantity;
    }
    summary.total += log.quantity;
  });

  return summary;
}

/**
 * Get all usage logs (optionally filtered)
 * @param {object} options - Filter options: {startDate, endDate, reason, inventoryItemId}
 * @returns {array} Array of usage logs
 */
function getAllUsageLogs(options = {}) {
  if (!appState.ingredientUsageLogs) {
    return [];
  }

  let logs = [...appState.ingredientUsageLogs];

  if (options.inventoryItemId) {
    logs = logs.filter(
      (log) => log.inventoryItemId === options.inventoryItemId
    );
  }
  if (options.reason) {
    logs = logs.filter((log) => log.reason === options.reason);
  }
  if (options.startDate) {
    logs = logs.filter((log) => log.timestamp >= options.startDate);
  }
  if (options.endDate) {
    logs = logs.filter((log) => log.timestamp <= options.endDate);
  }

  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Calculate trending items based on usage logs
 * @param {number} limit - Number of top items to return
 * @param {object} options - Filter options: {startDate, endDate, reason}
 * @returns {array} Array of items with usage counts, sorted by usage
 */
function getTrendingItemsByUsage(limit = 10, options = {}) {
  const logs = getAllUsageLogs(options);

  const usageMap = {};
  logs.forEach((log) => {
    if (!usageMap[log.inventoryItemId]) {
      usageMap[log.inventoryItemId] = 0;
    }
    usageMap[log.inventoryItemId] += log.quantity;
  });

  // Convert to array and join with inventory data
  const trendingItems = Object.entries(usageMap).map(([itemId, totalUsage]) => {
    const inventoryItem = appState.inventory.find((item) => item.id === itemId);
    return {
      id: itemId,
      name: inventoryItem ? inventoryItem.name : "Unknown Item",
      category: inventoryItem ? inventoryItem.category : "unknown",
      totalUsage: totalUsage,
      inventoryItem: inventoryItem,
    };
  });

  // Sort by usage and limit
  return trendingItems
    .sort((a, b) => b.totalUsage - a.totalUsage)
    .slice(0, limit);
}

// Export functions globally
window.logIngredientUsage = logIngredientUsage;
window.getIngredientUsageLogs = getIngredientUsageLogs;
window.getUsageByReason = getUsageByReason;
window.getAllUsageLogs = getAllUsageLogs;
window.getTrendingItemsByUsage = getTrendingItemsByUsage;

// ==================== DATA MIGRATION ====================

/**
 * Migrate existing totalUsed/total_used values to ingredientUsageLogs
 * This should be run once when the new system is first deployed
 */
function migrateExistingUsageData() {
  if (!appState.inventory) {
    console.log("No inventory to migrate");
    return { migrated: 0, skipped: 0 };
  }

  if (!appState.ingredientUsageLogs) {
    appState.ingredientUsageLogs = [];
  }

  let migrated = 0;
  let skipped = 0;
  const migrationTimestamp = new Date().toISOString();

  appState.inventory.forEach((item) => {
    const totalUsed = item.totalUsed || item.total_used || 0;

    if (totalUsed > 0) {
      // Check if this item already has migration logs
      const existingMigrationLog = appState.ingredientUsageLogs.find(
        (log) =>
          log.inventoryItemId === item.id &&
          log.notes &&
          log.notes.includes("[MIGRATION]")
      );

      if (!existingMigrationLog) {
        // Create a migration log entry
        const migrationLog = {
          id: `usage-migration-${item.id}-${Date.now()}`,
          inventoryItemId: item.id,
          quantity: totalUsed,
          reason: "other",
          orderId: null,
          notes: `[MIGRATION] Historical usage data migrated from totalUsed field`,
          timestamp: migrationTimestamp,
        };

        appState.ingredientUsageLogs.push(migrationLog);
        migrated++;
        console.log(`Migrated ${totalUsed} usage for ${item.name}`);
      } else {
        skipped++;
      }
    }
  });

  console.log(
    `Migration complete: ${migrated} items migrated, ${skipped} skipped (already migrated)`
  );

  if (migrated > 0) {
    saveState();
  }

  return { migrated, skipped };
}

window.migrateExistingUsageData = migrateExistingUsageData;
