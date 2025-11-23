const STORAGE_KEY = "cake_restaurant_suite_v1";
const SESSION_KEY = "cake_restaurant_active_user";

const PREFER_SERVER_DATA = true;

const ACCOUNTS = [
  { id: "admin-1", name: "", role: "admin", pin: "4321" },
  { id: "staff-1", name: "", role: "inventory_manager", pin: "1111" },
  { id: "staff-2", name: "", role: "staff", pin: "2222" },
];

const getDefaultData = () => getEmptyData();

const getEmptyData = () => ({
  employees: [],
  attendanceLogs: [],
  inventory: [],
  orders: [],
  salesHistory: [],
  inventoryUsage: [],
  attendanceTrend: [],
  performanceScores: [],
  stockTrends: [],
});

async function fetchServerState() {
  const endpoint =
    (typeof window !== "undefined" && window.APP_STATE_ENDPOINT) ||
    "/api/state";
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch server state: ${res.status} ${res.statusText}`
    );
  }
  const json = await res.json();
  return json;
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
      return JSON.parse(raw);
    }
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
  role === "admin" ? "dashboard.html" : "attendance.html";

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
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
      if (!canvas || typeof Chart === "undefined") {
        return;
      }
      if (registry[id]) {
        registry[id].destroy();
      }
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

  if (!todayLogs.length) {
    return { status: "absent", timestamp: "No log" };
  }

  const firstIn = todayLogs.find((log) => log.action === "in");
  const latest = todayLogs[todayLogs.length - 1];
  if (!firstIn) {
    return { status: "absent", timestamp: formatTime(latest.timestamp) };
  }

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
  const groups = {
    cakes: [],
    ingredients: [],
    supplies: [],
    beverages: [],
  };
  appState.inventory.forEach((item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  });
  return groups;
};

const inventoryStats = () => {
  const value = appState.inventory.reduce(
    (sum, item) => sum + item.quantity * item.cost,
    0
  );
  const lowStock = appState.inventory.filter(
    (item) => item.quantity <= item.reorderPoint
  ).length;
  return {
    totalItems: appState.inventory.length,
    lowStock,
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
    .filter((item) => item.quantity <= item.reorderPoint)
    .sort((a, b) => a.quantity - b.quantity);

const highlightNavigation = () => {
  const page = document.body.dataset.page;
  document.querySelectorAll(".nav a[data-section]").forEach((link) => {
    if (link.dataset.section === page) {
      link.classList.add("active");
    }
  });
};

const mountLiveClock = () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || sidebar.querySelector(".live-clock")) {
    return;
  }
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
  if (!dateNode || !timeNode) {
    return;
  }
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
  if (liveClockTimer) {
    clearInterval(liveClockTimer);
  }
  liveClockTimer = setInterval(update, 1000);
};

const attachGlobalActions = () => {
  const refreshButton = document.getElementById("refresh-data");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => window.location.reload());
  }

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

/* Mobile sidebar toggle: inject hamburger button and backdrop, manage open/close */
function setupSidebarToggle() {
  const body = document.body;
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  // Backdrop
  let backdrop = document.querySelector(".sidebar-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  // Hamburger button
  let hamb = document.querySelector(".mobile-hamburger");
  if (!hamb) {
    hamb = document.createElement("button");
    hamb.className = "mobile-hamburger";
    hamb.setAttribute("aria-label", "Toggle navigation");
    hamb.innerHTML = "&#9776;";
    document.body.appendChild(hamb);
  }

  // Close button inside sidebar
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

  // Avoid adding duplicate handlers when this function runs multiple times
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

  // Close sidebar when a navigation link is clicked (helpful before page navigation)
  const navLinks = sidebar.querySelectorAll(".nav a[href]");
  navLinks.forEach((link) => {
    if (!link.dataset.closeBound) {
      link.addEventListener("click", (e) => {
        // close only on mobile widths
        const isMobileNow = window.matchMedia("(max-width: 1100px)").matches;
        if (isMobileNow) closeSidebar();
      });
      link.dataset.closeBound = "true";
    }
  });

  // show/hide control based on viewport
  const mq = window.matchMedia("(max-width: 1100px)");
  function updateControls() {
    const isMobile = mq.matches;
    hamb.style.display = isMobile ? "flex" : "none";
    closeBtn.style.display = isMobile ? "block" : "none";
    if (!isMobile) {
      // ensure sidebar is visible in desktop flows and reset inline transforms
      closeSidebar();
      sidebar.style.transform = "none";
      sidebar.style.position = "relative";
    } else {
      // restore overlay style
      sidebar.style.position = "fixed";
    }
  }
  updateControls();
  // Use addEventListener if available
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", updateControls);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(updateControls);
  }
}

function updateSessionDisplay(user) {
  const nameNode = document.getElementById("session-name");
  const roleNode = document.getElementById("session-role");
  const logoutButton = document.getElementById("logout-btn");
  if (!nameNode || !roleNode) {
    return;
  }
  if (!user) {
    nameNode.textContent = "Guest";
    roleNode.textContent = "Sign in required";
    if (logoutButton) logoutButton.disabled = true;
    return;
  }
  // Do not display personal names; show account id and role only
  nameNode.textContent = user.id || "";
  roleNode.textContent =
    user.role === "admin"
      ? "Administrator"
      : user.role === "inventory_manager"
      ? "Inventory Manager"
      : "Staff";
  if (logoutButton) logoutButton.disabled = false;
}

function applyRolePermissions(user) {
  const nodes = document.querySelectorAll("[data-role]");
  nodes.forEach((node) => {
    // support multiple allowed roles in the `data-role` attribute (comma-separated)
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
    if (hideWhenDenied) {
      node.style.removeProperty("display");
    }
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
      option.textContent = `${account.name} (${account.role})`;
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
      if (typeof authCallback === "function") {
        authCallback();
      }
    });
  }
  overlay.classList.add("active");
}

async function initApp() {
  mountLiveClock();
  highlightNavigation();
  attachGlobalActions();
  setupSidebarToggle();
  startLiveClock();

  if (
    typeof window !== "undefined" &&
    (window.SERVER_HAS_DATA || PREFER_SERVER_DATA)
  ) {
    try {
      const serverState = await fetchServerState();
      if (serverState && typeof serverState === "object") {
        appState = serverState;
      } else {
        appState = loadState();
      }
    } catch (err) {
      console.warn(
        "Failed to fetch server state, falling back to local state",
        err
      );
      appState = loadState();
    }
  } else {
    appState = loadState();
  }
  const page = document.body.dataset.page;
  const renderers = {
    dashboard: renderDashboard,
    attendance: renderAttendance,
    employees: renderEmployees,
    inventory: renderInventory,
    orders: renderOrders,
    analytics: renderAnalytics,
    report: renderReports,
  };
  if (page === "login") {
    return;
  }
  const bootPage = () => {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    updateSessionDisplay(user);
    applyRolePermissions(user);
    if (renderers[page]) {
      renderers[page]();
      applyRolePermissions(user);
    }
  };
  if (!getCurrentUser()) {
    window.location.href = "login.html";
    return;
  }
  bootPage();
}

document.addEventListener("DOMContentLoaded", initApp);

function renderDashboard() {
  const salesRangeSelect = document.getElementById("sales-range");
  if (salesRangeSelect && !salesRangeSelect.dataset.bound) {
    salesRangeSelect.dataset.bound = "true";
    salesRangeSelect.addEventListener("change", renderDashboard);
  }
  const salesRange = Number(salesRangeSelect?.value || 14);
  const salesWindow = appState.salesHistory.slice(-salesRange);

  const todaySales = salesToday();
  const yesterdaySales = salesYesterday();
  const delta = yesterdaySales
    ? (((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(1)
    : "0";
  const deltaValue = Number(delta);
  const metrics = inventoryStats();
  const attendance = getTodaysLogs();
  const orders = orderStats();

  const metricMap = {
    "metric-sales": formatCurrency(todaySales),
    "metric-orders": `${
      orders.pending + orders.preparing + orders.ready
    } active`,
    "metric-inventory": `${metrics.totalItems} items`,
    "sales-trend-note": `${delta}% vs. yesterday`,
    "stock-health-label": metrics.lowStock ? "Action needed" : "Healthy",
    "attendance-summary-label": `${attendance.length} time logs today`,
    "inventory-status-note": `${metrics.lowStock} low stock alerts`,
  };
  Object.entries(metricMap).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });

  ChartManager.plot("salesTrendChart", {
    type: "line",
    data: {
      labels: salesWindow.map((entry) => entry.date.slice(5)),
      datasets: [
        {
          label: "Daily Sales",
          data: salesWindow.map((entry) => entry.total),
          borderColor: "#f6c343",
          backgroundColor: "rgba(246,195,67,0.25)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });

  ChartManager.plot("inventoryStatusChart", {
    type: "doughnut",
    data: {
      labels: ["Safe", "Low"],
      datasets: [
        {
          data: [metrics.totalItems - metrics.lowStock, metrics.lowStock],
          backgroundColor: ["#ffd37c", "#f97316"],
          borderColor: ["#ffd37c", "#f97316"],
        },
      ],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });

  const attendanceCounts = appState.employees.reduce(
    (acc, emp) => {
      const status = computeEmployeeStatus(emp).status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0 }
  );

  const overview = document.getElementById("operations-overview");
  if (overview) {
    overview.innerHTML = "";
    const coveragePercent = appState.employees.length
      ? Math.round((attendanceCounts.present / appState.employees.length) * 100)
      : 0;
    const pendingTickets = orders.pending + orders.preparing;
    const lowStockCount = metrics.lowStock;
    const insights = [
      {
        label: "Staff coverage",
        detail: `${attendanceCounts.present} of ${appState.employees.length} on-site (${coveragePercent}%)`,
        flag: coveragePercent < 70 ? "warning" : "good",
        flagText: coveragePercent < 70 ? "Monitor" : "Stable",
      },
      {
        label: "Kitchen load",
        detail: `${pendingTickets} orders awaiting prep/finish`,
        flag: pendingTickets > 3 ? "warning" : "good",
        flagText: pendingTickets > 3 ? "High" : "Normal",
      },
      {
        label: "Stock alerts",
        detail: lowStockCount
          ? `${lowStockCount} items at/below reorder`
          : "All categories healthy",
        flag: lowStockCount > 3 ? "alert" : lowStockCount ? "warning" : "good",
        flagText: lowStockCount
          ? lowStockCount > 3
            ? "Action"
            : "Review"
          : "Clear",
      },
      {
        label: "Sales momentum",
        detail:
          deltaValue >= 0
            ? `Up ${Math.abs(deltaValue)}% vs yesterday`
            : `Down ${Math.abs(deltaValue)}% vs yesterday`,
        flag: deltaValue >= 0 ? "good" : "warning",
        flagText: deltaValue >= 0 ? "Positive" : "Slow",
      },
    ];
    insights.forEach((item) => {
      const li = document.createElement("li");
      li.className = "overview-item";
      li.innerHTML = `
				<div>
					<strong>${item.label}</strong>
					<p>${item.detail}</p>
				</div>
				<span class="overview-flag ${item.flag}">${item.flagText}</span>
			`;
      overview.appendChild(li);
    });
  }

  ChartManager.plot("attendanceDonutChart", {
    type: "pie",
    data: {
      labels: ["Present", "Late", "Absent"],
      datasets: [
        {
          data: [
            attendanceCounts.present,
            attendanceCounts.late,
            attendanceCounts.absent,
          ],
          backgroundColor: ["#22c55e", "#f97316", "#ef4444"],
          borderWidth: 0,
        },
      ],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });

  const lowStockContainer = document.getElementById("low-stock-list");
  if (lowStockContainer) {
    lowStockContainer.innerHTML = "";
    const items = lowStockItems();
    if (!items.length) {
      lowStockContainer.innerHTML = "<li>No low stock items today.</li>";
    } else {
      items.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${item.name}</span><span class="status late">${item.quantity}</span>`;
        lowStockContainer.appendChild(li);
      });
    }
  }

  const ordersList = document.getElementById("orders-list");
  if (ordersList) {
    ordersList.innerHTML = "";
    appState.orders
      .filter((o) => o.status !== "served")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 4)
      .forEach((order) => {
        const row = document.createElement("div");
        row.className = "order-row";
        row.innerHTML = `
					<div>
						<strong>${order.customer}</strong>
						<p>${order.items}</p>
					</div>
					<span class="status ${order.status}">${order.status}</span>
				`;
        ordersList.appendChild(row);
      });
  }

  const recentActivity = document.getElementById("recent-activity");
  if (recentActivity) {
    recentActivity.innerHTML = "";
    const activity = [
      ...appState.orders.map((order) => ({
        timestamp: order.timestamp,
        title: `${order.status.charAt(0).toUpperCase()}${order.status.slice(
          1
        )} order`,
        detail: `${order.customer} • ${formatCurrency(order.total)}`,
      })),
      ...appState.attendanceLogs.map((log) => {
        const employee = getEmployee(log.employeeId);
        const actionMeta = getAttendanceActionMeta(log.action);
        return {
          timestamp: log.timestamp,
          title: `${employee?.name || "Team member"} ${actionMeta.timeline}`,
          detail: log.note || log.shift || "Attendance update",
        };
      }),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);
    if (!activity.length) {
      recentActivity.innerHTML =
        '<li class="empty-state">No recent activity recorded.</li>';
    } else {
      activity.forEach((entry) => {
        const item = document.createElement("li");
        item.innerHTML = `
					<div class="activity-log__info">
						<strong>${entry.title}</strong>
						<p>${entry.detail}</p>
					</div>
					<span class="activity-log__time">${formatTime(entry.timestamp)}</span>
				`;
        recentActivity.appendChild(item);
      });
    }
  }
}

function renderAttendance() {
  const form = document.getElementById("attendance-form");
  const employeeSelect = document.getElementById("attendance-employee");
  const logFilter = document.getElementById("attendance-log-filter");
  const actionSelect = document.getElementById("attendance-action");
  const shiftField = document.getElementById("attendance-shift");
  const shiftGroup = document.getElementById("attendance-shift-group");
  const reasonGroup = document.getElementById("attendance-reason-group");
  const reasonField = document.getElementById("attendance-reason");

  const syncAttendanceFormFields = (actionValue) => {
    const needsReason = attendanceActionRequiresReason(actionValue);
    if (shiftGroup) shiftGroup.classList.toggle("hidden", needsReason);
    if (shiftField) {
      shiftField.disabled = needsReason;
      shiftField.required = !needsReason;
      if (needsReason) shiftField.value = "";
    }
    if (reasonGroup) reasonGroup.classList.toggle("hidden", !needsReason);
    if (reasonField) {
      reasonField.disabled = !needsReason;
      reasonField.required = needsReason;
      if (!needsReason) reasonField.value = "";
    }
  };

  if (actionSelect && !actionSelect.dataset.bound) {
    actionSelect.dataset.bound = "true";
    actionSelect.addEventListener("change", () =>
      syncAttendanceFormFields(actionSelect.value)
    );
  }
  syncAttendanceFormFields(actionSelect?.value || "");
  if (employeeSelect) {
    employeeSelect.innerHTML = "<option value=''>Select employee</option>";
    appState.employees.forEach((employee) => {
      const option = document.createElement("option");
      option.value = employee.id;
      option.textContent = `${employee.name} – ${employee.role}`;
      employeeSelect.appendChild(option);
    });
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isAdmin()) {
        alert("Only administrators can update attendance records.");
        return;
      }
      const data = new FormData(form);
      const employeeId = data.get("employee");
      const action = data.get("action");
      const shift = data.get("shift");
      const reason = (data.get("reason") || "").trim();
      const requiresReason = attendanceActionRequiresReason(action);
      if (!employeeId || !action || (requiresReason ? !reason : !shift)) {
        return;
      }
      appState.attendanceLogs.push({
        id: `att-${Date.now()}`,
        employeeId,
        action,
        timestamp: new Date().toISOString(),
        shift: requiresReason ? "" : shift,
        note: requiresReason ? reason : "",
      });
      saveState();
      form.reset();
      syncAttendanceFormFields(actionSelect?.value || "");
      renderAttendance();
    });
  }

  if (logFilter && !logFilter.dataset.bound) {
    logFilter.dataset.bound = "true";
    logFilter.addEventListener("change", renderAttendance);
  }

  const logFilterValue = logFilter?.value || "all";

  const employeeSnapshots = appState.employees.map((employee) => {
    const snapshot = computeEmployeeStatus(employee);
    // find latest log for today to determine whether last action was in/out
    const todaysLogs = appState.attendanceLogs
      .filter(
        (log) =>
          log.employeeId === employee.id && log.timestamp.startsWith(todayKey())
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const latestLog = todaysLogs[todaysLogs.length - 1];
    const latestAction = latestLog ? latestLog.action : null;
    return {
      employee,
      status: snapshot.status,
      timestamp: snapshot.timestamp,
      latestAction,
    };
  });

  const summary = employeeSnapshots.reduce(
    (acc, snap) => {
      acc[snap.status] = (acc[snap.status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0 }
  );

  ["attendance-present", "attendance-late", "attendance-absent"].forEach(
    (id, idx) => {
      const value = [summary.present, summary.late, summary.absent][idx];
      const node = document.getElementById(id);
      if (node) node.textContent = `${value} staff`;
    }
  );

  const boardBody = document.querySelector("#attendance-status-table tbody");
  if (boardBody) {
    boardBody.innerHTML = "";
    employeeSnapshots.forEach(
      ({ employee, status, timestamp, latestAction }) => {
        const row = document.createElement("tr");

        let displayLabel = "";
        if (latestAction === "in") {
          displayLabel = "Clocked in";
          if (status === "late") displayLabel += " — Late";
        } else if (latestAction === "out") {
          displayLabel = "Clocked out";
        } else {
          displayLabel = status.charAt(0).toUpperCase() + status.slice(1);
        }
        const cssClass = status || "absent";
        row.innerHTML = `
                <td>
                    <strong>${employee.name}</strong>
                    <small>${employee.role}</small>
                </td>
                <td><span class="status ${cssClass}">${displayLabel}</span></td>
                <td>${timestamp}</td>
            `;
        boardBody.appendChild(row);
      }
    );
  }

  const logBody = document.querySelector("#attendance-log-table tbody");
  if (logBody) {
    logBody.innerHTML = "";
    const filteredLogs = getTodaysLogs()
      .filter((log) => {
        if (logFilterValue === "all") return true;
        const shift = (log.shift || "").toLowerCase();
        if (!shift) return false;
        return logFilterValue === "morning"
          ? shift.includes("morning")
          : shift.includes("afternoon");
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    filteredLogs.forEach((log) => {
      const employee = getEmployee(log.employeeId);
      const actionMeta = getAttendanceActionMeta(log.action);
      const row = document.createElement("tr");
      row.innerHTML = `
					<td>${employee?.name || "Unknown"}</td>
					<td><span class="status ${actionMeta.badge}">${actionMeta.label}</span></td>
					<td>${formatTime(log.timestamp)}</td>
					<td>${log.shift || log.note || ""}</td>
				`;
      logBody.appendChild(row);
    });
    if (!logBody.children.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4" class="empty-state">No logs recorded for today yet.</td>`;
      logBody.appendChild(row);
    }
  }

  const alerts = document.getElementById("attendance-alerts");
  if (alerts) {
    alerts.innerHTML = "";
    const lateTeam = employeeSnapshots.filter((snap) => snap.status === "late");
    const absentTeam = employeeSnapshots.filter(
      (snap) => snap.status === "absent"
    );
    const alertEntries = [];
    if (lateTeam.length) {
      alertEntries.push({
        title: `${lateTeam.length} late ${
          lateTeam.length === 1 ? "arrival" : "arrivals"
        }`,
        detail: `${lateTeam
          .slice(0, 3)
          .map((snap) => snap.employee.name)
          .join(", ")}${
          lateTeam.length > 3 ? ` +${lateTeam.length - 3} more` : ""
        }`,
        badge: "warning",
      });
    }
    if (absentTeam.length) {
      alertEntries.push({
        title: `${absentTeam.length} not clocked in`,
        detail: `${absentTeam
          .slice(0, 3)
          .map((snap) => `${snap.employee.name} (${snap.employee.shiftStart})`)
          .join(", ")}${
          absentTeam.length > 3 ? ` +${absentTeam.length - 3} more` : ""
        }`,
        badge: "alert",
      });
    }
    if (!alertEntries.length) {
      alertEntries.push({
        title: "All clear",
        detail: "Everyone is accounted for today.",
        badge: "good",
      });
    }
    alertEntries.forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `
				<div>
					<strong>${entry.title}</strong>
					<p>${entry.detail}</p>
				</div>
				<span class="alert-badge ${entry.badge}">${
        entry.badge === "good"
          ? "Good"
          : entry.badge === "alert"
          ? "Alert"
          : "Watch"
      }</span>
			`;
      alerts.appendChild(li);
    });
  }
}

function renderEmployees() {
  const form = document.getElementById("employee-form");
  const roleSelect = document.getElementById("employee-role");
  const customRoleField = document.getElementById("custom-role-field");
  const customRoleInput = document.getElementById("employee-role-custom");
  const totalNode = document.getElementById("employee-total");
  const rolesNode = document.getElementById("employee-roles");
  const earliestNode = document.getElementById("employee-earliest");
  const roleList = document.getElementById("employee-role-list");
  const rosterBody = document.querySelector("#employee-table tbody");

  const uniqueRoles = () =>
    [
      ...new Set(appState.employees.map((emp) => emp.role).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

  const populateRoleOptions = () => {
    if (!roleSelect) return;
    const currentValue = roleSelect.value;
    roleSelect.innerHTML = "<option value=''>Select role</option>";
    uniqueRoles().forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      roleSelect.appendChild(option);
    });
    const customOption = document.createElement("option");
    customOption.value = "__custom";
    customOption.textContent = "Custom role";
    roleSelect.appendChild(customOption);
    if (currentValue) {
      const hasValue = [...roleSelect.options].some(
        (option) => option.value === currentValue
      );
      roleSelect.value = hasValue ? currentValue : "";
    }
    if (roleSelect.value === "__custom" && customRoleField) {
      customRoleField.classList.remove("hidden");
      if (customRoleInput) customRoleInput.required = true;
    }
  };

  populateRoleOptions();

  if (roleSelect && !roleSelect.dataset.bound) {
    roleSelect.dataset.bound = "true";
    roleSelect.addEventListener("change", () => {
      const useCustom = roleSelect.value === "__custom";
      if (customRoleField) {
        customRoleField.classList.toggle("hidden", !useCustom);
      }
      if (customRoleInput) {
        customRoleInput.required = useCustom;
        if (!useCustom) {
          customRoleInput.value = "";
        }
      }
    });
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isAdmin()) {
        alert("Only administrators can add employees.");
        return;
      }
      const data = new FormData(form);
      const name = data.get("name")?.trim();
      let role = data.get("role")?.trim();
      if (role === "__custom") {
        role = data.get("customRole")?.trim();
      }
      const shiftStart = data.get("shiftStart") || "08:00";
      if (!name || !role) {
        return;
      }
      appState.employees.push({
        id: `emp-${Date.now()}`,
        name,
        role,
        shiftStart,
      });
      saveState();
      form.reset();
      const shiftField = form.querySelector("[name=shiftStart]");
      if (shiftField) {
        shiftField.value = "08:00";
      }
      if (roleSelect) {
        roleSelect.value = "";
      }
      if (customRoleField) {
        customRoleField.classList.add("hidden");
      }
      if (customRoleInput) {
        customRoleInput.required = false;
        customRoleInput.value = "";
      }
      populateRoleOptions();
      renderEmployees();
    });
  }

  const totalStaff = appState.employees.length;
  const roles = uniqueRoles();
  const earliestShift = appState.employees.reduce((min, emp) => {
    if (!emp.shiftStart) return min;
    if (!min) return emp.shiftStart;
    return emp.shiftStart < min ? emp.shiftStart : min;
  }, "");
  if (totalNode) {
    totalNode.textContent = totalStaff;
  }
  if (rolesNode) {
    rolesNode.textContent = roles.length;
  }
  if (earliestNode) {
    earliestNode.textContent = earliestShift || "--:--";
  }
  if (roleList) {
    if (!roles.length) {
      roleList.innerHTML = '<span class="chip">No roles yet</span>';
    } else {
      roleList.innerHTML = roles
        .map((role) => `<span class="chip">${role}</span>`)
        .join("");
    }
  }

  if (rosterBody) {
    rosterBody.innerHTML = "";
    const sorted = [...appState.employees].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    if (!sorted.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4" class="empty-state">No employees registered yet.</td>`;
      rosterBody.appendChild(row);
    } else {
      sorted.forEach((employee) => {
        const row = document.createElement("tr");
        row.innerHTML = `
					<td>
						<strong>${employee.name}</strong>
					</td>
					<td>${employee.role}</td>
					<td>${employee.shiftStart}</td>
					<td>
						<button class="btn btn-outline" data-delete-employee="${employee.id}" data-role="admin">Remove</button>
					</td>
				`;
        rosterBody.appendChild(row);
      });
    }
  }

  const attachRemovalHandlers = () => {
    document.querySelectorAll("[data-delete-employee]").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        if (!isAdmin()) {
          alert("Only administrators can remove employees.");
          return;
        }
        const id = button.dataset.deleteEmployee;
        const target = appState.employees.find((emp) => emp.id === id);
        if (!target) return;
        const confirmed = confirm(`Remove ${target.name} from the roster?`);
        if (!confirmed) return;
        appState.employees = appState.employees.filter((emp) => emp.id !== id);
        saveState();
        renderEmployees();
      });
    });
  };

  attachRemovalHandlers();
}

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
      if (event.target === editModal) {
        closeEditModal();
      }
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
      if (idx >= 0) {
        appState.inventory[idx] = payload;
      } else {
        appState.inventory.push(payload);
      }
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
      alertPanel.innerHTML = `
				<strong>Inventory healthy</strong>
				<p>All categories are above their reorder points.</p>
			`;
    } else {
      const preview = lowItems
        .slice(0, 4)
        .map(
          (item) =>
            `<span class="alert-tag">${item.name} (${item.quantity})</span>`
        )
        .join("");
      const extraCount = lowItems.length - 4;
      alertPanel.innerHTML = `
				<strong>${lowItems.length} low-stock ${
        lowItems.length === 1 ? "item" : "items"
      }</strong>
				<p>Restock soon to avoid production gaps.</p>
				<div class="alert-tags">${preview}${
        extraCount > 0
          ? `<span class="alert-tag">+${extraCount} more</span>`
          : ""
      }</div>
			`;
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
				<td class="table-actions">
					<button class="btn btn-outline" data-edit="${item.id}">Edit</button>
					<button class="btn btn-secondary" data-delete="${item.id}">Delete</button>
				</td>
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
            inv.quantity = Number(inv.quantity || 0) - Number(it.qty || 0);
            if (inv.quantity < 0) inv.quantity = 0;
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
        }">
					${["pending", "preparing", "ready"]
            .map(
              (status) =>
                `<option value="${status}" ${
                  order.status === status ? "selected" : ""
                }>${status}</option>`
            )
            .join("")}
				</select>`;
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
    } else {
      completedOrders
        .sort(
          (a, b) =>
            new Date(b.servedAt || b.timestamp) -
            new Date(a.servedAt || a.timestamp)
        )
        .forEach((order) => {
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
						<td><button class="btn btn-outline" data-receipt="${
              order.id
            }">Receipt</button></td>
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
        if (ordersInStatus.length > 6) {
          details.innerHTML += `<div class="muted">+${
            ordersInStatus.length - 6
          } more</div>`;
        }
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
        if (receiptFields.itemCount) {
          receiptFields.itemCount.textContent = `${items.length || 0} ${
            items.length === 1 ? "item" : "items"
          }`;
        }
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
      if (receiptModal) {
        receiptModal.classList.add("active");
      }
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

  const closeReceipt = () => {
    selectedReceiptOrder = null;
    if (receiptModal) {
      receiptModal.classList.remove("active");
    }
  };

  if (receiptClose && !receiptClose.dataset.bound) {
    receiptClose.dataset.bound = "true";
    receiptClose.addEventListener("click", closeReceipt);
  }

  if (receiptModal && !receiptModal.dataset.bound) {
    receiptModal.dataset.bound = "true";
    receiptModal.addEventListener("click", (event) => {
      if (event.target === receiptModal) {
        closeReceipt();
      }
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

    // wire UI events
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

function renderAnalytics() {
  const attendanceRangeSelect = document.getElementById("attendance-range");
  if (attendanceRangeSelect && !attendanceRangeSelect.dataset.bound) {
    attendanceRangeSelect.dataset.bound = "true";
    attendanceRangeSelect.addEventListener("change", renderAnalytics);
  }
  const kpiRangeSelect = document.getElementById("kpi-range");
  if (kpiRangeSelect && !kpiRangeSelect.dataset.bound) {
    kpiRangeSelect.dataset.bound = "true";
    kpiRangeSelect.addEventListener("change", renderAnalytics);
  }
  const categoryTabs = document.querySelectorAll(".chart-category-tab");
  const chartSections = document.querySelectorAll("[data-chart-category]");
  const applyCategoryFilter = (filter) => {
    categoryTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.chartFilter === filter);
    });
    chartSections.forEach((section) => {
      const categories = (section.dataset.chartCategory || "")
        .split(",")
        .map((cat) => cat.trim());
      const matches = filter === "all" || categories.includes(filter);
      section.classList.toggle("hidden-category", !matches);
    });
  };
  const initialFilter =
    Array.from(categoryTabs).find((tab) => tab.classList.contains("active"))
      ?.dataset.chartFilter || "all";
  applyCategoryFilter(initialFilter);
  categoryTabs.forEach((tab) => {
    if (tab.dataset.bound) return;
    tab.dataset.bound = "true";
    tab.addEventListener("click", () => {
      const targetFilter = tab.dataset.chartFilter || "all";
      applyCategoryFilter(targetFilter);
    });
  });
  const attendanceRange = Number(attendanceRangeSelect?.value || 7);
  const kpiRangeDays = Number(kpiRangeSelect?.value || 7);
  const kpiCutoff = new Date();
  kpiCutoff.setHours(0, 0, 0, 0);
  kpiCutoff.setDate(kpiCutoff.getDate() - (kpiRangeDays - 1));
  const totalSalesKpi = appState.salesHistory
    .filter((entry) => parseDateKey(entry.date) >= kpiCutoff)
    .reduce((sum, entry) => sum + entry.total, 0);
  const totalAttendanceKpi = appState.attendanceLogs.filter(
    (log) => log.action === "in" && new Date(log.timestamp) >= kpiCutoff
  ).length;
  const weeklyUsage = appState.inventoryUsage.reduce(
    (sum, item) => sum + (item.used || 0),
    0
  );
  const usageEstimate = Math.round(weeklyUsage * (kpiRangeDays / 7));
  const kpiMap = {
    "kpi-sales": formatCurrency(totalSalesKpi),
    "kpi-attendance": `${totalAttendanceKpi} logs`,
    "kpi-stock": `${usageEstimate} units`,
  };
  Object.entries(kpiMap).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });
  const attendanceWindow = appState.attendanceTrend.slice(-attendanceRange);

  const inventorySummary = inventoryStats();
  const totalSales = appState.salesHistory.reduce(
    (acc, entry) => acc + entry.total,
    0
  );
  const turnover = inventorySummary.value
    ? (totalSales / inventorySummary.value).toFixed(1)
    : "0.0";
  const latestSales =
    appState.salesHistory[appState.salesHistory.length - 1]?.total || 0;
  const avgTicket = latestSales / (appState.orders.length || 1);
  const productivity = (
    appState.performanceScores.reduce(
      (acc, perf) => acc + perf.completedOrders,
      0
    ) / appState.performanceScores.length
  ).toFixed(0);

  const analyticsMap = {
    "analytics-turnover": `${turnover}x inventory turnover`,
    "analytics-ticket": `${formatCurrency(avgTicket)} avg ticket`,
    "analytics-productivity": `${productivity} tasks / staff`,
  };
  Object.entries(analyticsMap).forEach(([id, text]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  });

  ChartManager.plot("salesMixChart", {
    type: "bar",
    data: {
      labels: ["Cakes", "Restaurant", "Beverages"],
      datasets: [
        {
          data: [48, 38, 14],
          backgroundColor: ["#f6c343", "#f97316", "#5c2c06"],
          borderRadius: 12,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });

  ChartManager.plot("inventoryUsageChart", {
    type: "radar",
    data: {
      labels: appState.inventoryUsage.map((item) => item.label),
      datasets: [
        {
          data: appState.inventoryUsage.map((item) => item.used),
          borderColor: "#f6c343",
          backgroundColor: "rgba(246,195,67,0.25)",
          borderWidth: 2,
        },
      ],
    },
    options: { plugins: { legend: { display: false } } },
  });

  ChartManager.plot("attendanceTrendChart", {
    type: "line",
    data: {
      labels: attendanceWindow.map((item) => item.label),
      datasets: [
        {
          label: "Present",
          data: attendanceWindow.map((item) => item.present),
          borderColor: "#22c55e",
          tension: 0.4,
        },
        {
          label: "Late",
          data: attendanceWindow.map((item) => item.late),
          borderColor: "#f97316",
          tension: 0.4,
        },
        {
          label: "Absent",
          data: attendanceWindow.map((item) => item.absent),
          borderColor: "#ef4444",
          tension: 0.4,
        },
      ],
    },
    options: { responsive: true },
  });

  ChartManager.plot("performanceChart", {
    type: "polarArea",
    data: {
      labels: appState.performanceScores.map(
        (perf) => getEmployee(perf.employeeId)?.name || perf.employeeId
      ),
      datasets: [
        {
          data: appState.performanceScores.map((perf) => perf.rating),
          backgroundColor: [
            "#f6c343",
            "#f97316",
            "#5c2c06",
            "#22c55e",
            "#c084fc",
            "#14b8a6",
          ],
        },
      ],
    },
  });

  const stockTrendData = (
    appState.stockTrends && appState.stockTrends.length
      ? appState.stockTrends
      : getDefaultData().stockTrends
  ).slice(0, 8);

  ChartManager.plot("stockTrendsChart", {
    type: "bar",
    data: {
      labels: stockTrendData.map((entry) => entry.item),
      datasets: [
        {
          label: "Turnover",
          data: stockTrendData.map((entry) => entry.turnover),
          backgroundColor: stockTrendData.map(() => "rgba(246, 195, 67, 0.7)"),
          borderRadius: 8,
        },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { autoSkip: false } },
      },
    },
  });
}

function renderReports() {
  const buttons = document.querySelectorAll("[data-report]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => exportReport(button.dataset.report));
  });
}

function exportReport(type) {
  if (typeof XLSX === "undefined") {
    alert("SheetJS is required for exports");
    return;
  }
  let sheetData = [];
  const today = todayKey();
  switch (type) {
    case "inventory":
      sheetData = appState.inventory.map((item) => ({
        Category: item.category,
        Item: item.name,
        Quantity: `${item.quantity}`,
        "Reorder Point": item.reorderPoint,
        Cost: item.cost,
      }));
      break;
    case "sales":
      sheetData = appState.salesHistory.map((entry) => ({
        Date: entry.date,
        Total: entry.total,
      }));
      break;
    case "attendance":
      sheetData = getTodaysLogs().map((log) => ({
        Employee: getEmployee(log.employeeId)?.name || log.employeeId,
        Action: log.action,
        Timestamp: formatTime(log.timestamp),
        Shift: log.shift || log.note || "",
      }));
      break;
    case "financial":
      sheetData = [
        { Metric: "Revenue", Value: salesToday() },
        { Metric: "Average Daily", Value: salesYesterday() },
        { Metric: "Inventory Value", Value: inventoryStats().value },
      ];
      break;
    default:
      sheetData = [];
  }
  const sheet = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, `${type}-report`);
  XLSX.writeFile(wb, `${type}-report-${today}.xlsx`);
}

if (typeof window !== "undefined") {
  window.ACCOUNTS = ACCOUNTS;
  window.setSession = setSession;
  window.getCurrentUser = getCurrentUser;
  window.clearSession = clearSession;
  window.getLandingPageForRole = getLandingPageForRole;
}

function showConfirm(message, onConfirm) {
  const modal = document.getElementById("confirm-modal");
  const msg = document.getElementById("confirm-message");
  const ok = document.getElementById("confirm-ok");
  const cancel = document.getElementById("confirm-cancel");
  if (!modal || !msg || !ok || !cancel) {
    // fallback
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
