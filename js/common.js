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
  employees: [],
  attendanceLogs: [],
  inventory: [],
  orders: [],
  salesHistory: [],
  inventoryUsage: [],
  attendanceTrend: [],
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
    if (raw) return JSON.parse(raw);
  } catch (error) {
    console.warn("Unable to parse saved data", error);
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
  return ACCOUNTS.find((account) => account.id === id) || null;
}

function setSession(userId) {
  localStorage.setItem(SESSION_KEY, userId);
  activeUser = ACCOUNTS.find((account) => account.id === userId) || null;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  activeUser = null;
}

const getCurrentUser = () => activeUser;
const isAdmin = () => getCurrentUser()?.role === "admin";
const getLandingPageForRole = (role) =>
  role === "admin" ? "index.html" : "attendance.html";

// Database sync functionality
let saveTimeout = null;
let isSyncing = false;

async function syncStateToDatabase() {
  if (isSyncing) return;

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
    }
  } catch (error) {
    console.error("Unable to sync to database:", error);
  } finally {
    isSyncing = false;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));

    // Debounce database sync (wait 500ms after last change)
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      syncStateToDatabase();
    }, 500);
  } catch (error) {
    console.warn("Unable to save data", error);
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

const getEmployee = (id) => appState.employees.find((emp) => emp.id === id);
const getTodaysLogs = () =>
  appState.attendanceLogs.filter((log) => log.timestamp.startsWith(todayKey()));

const computeEmployeeStatus = (employee) => {
  const todayLogs = appState.attendanceLogs
    .filter(
      (log) =>
        log.employeeId === employee.id && log.timestamp.startsWith(todayKey())
    )
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (!todayLogs.length) return { status: "absent", timestamp: "No log" };
  const firstIn = todayLogs.find((log) => log.action === "in");
  const latest = todayLogs[todayLogs.length - 1];
  if (!firstIn)
    return { status: "absent", timestamp: formatTime(latest.timestamp) };
  const shift = new Date();
  const [hours, minutes] = employee.shiftStart.split(":");
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
  const value = appState.inventory.reduce(
    (sum, item) => sum + item.quantity * item.cost,
    0
  );
  const lowStock = appState.inventory.filter((item) => {
    const threshold =
      item.category === "supplies" || item.category === "beverages" ? 10 : 5;
    return item.quantity < threshold;
  }).length;
  return { totalItems: appState.inventory.length, lowStock, value };
};

const orderStats = () => {
  const buckets = { pending: 0, preparing: 0, ready: 0, served: 0 };
  appState.orders.forEach((order) => {
    buckets[order.status] = (buckets[order.status] || 0) + 1;
  });
  return buckets;
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
    displayNameFromAccount(user, { lowercase: true }) || "";
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
    const allowed =
      Boolean(user) &&
      (requiredRoles.length === 0 ||
        requiredRoles.includes(user.role) ||
        (requiredRoles.includes("admin") && user.role === "admin"));
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
        appState =
          serverState && typeof serverState === "object"
            ? serverState
            : loadState();
      })
      .catch((err) => {
        console.warn(
          "Failed to fetch server state, falling back to local state",
          err
        );
        appState = loadState();
      })
      .finally(() => bootPageFlow());
  } else {
    appState = loadState();
    bootPageFlow();
  }

  function bootPageFlow() {
    const page = document.body.dataset.page;
    if (page === "login") return;
    const user = getCurrentUser();
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    updateSessionDisplay(user);
    applyRolePermissions(user);
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
