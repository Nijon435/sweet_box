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
      labels: ["Safe", "Low", "No Stock"],
      datasets: [
        {
          data: [
            metrics.totalItems - metrics.lowStock - metrics.outOfStock,
            metrics.lowStock,
            metrics.outOfStock,
          ],
          backgroundColor: ["#ffd37c", "#f97316", "#ef4444"],
          borderColor: ["#ffd37c", "#f97316", "#ef4444"],
        },
      ],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });

  const attendanceCounts = appState.users
    .filter((user) => user.permission !== "admin")
    .reduce(
      (acc, emp) => {
        const status = computeEmployeeStatus(emp).status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { present: 0, late: 0, absent: 0, "on-leave": 0 }
    );

  const overview = document.getElementById("operations-overview");
  if (overview) {
    overview.innerHTML = "";
    const nonAdminUsers = appState.users.filter(
      (user) => user.permission !== "admin"
    );
    const coveragePercent = nonAdminUsers.length
      ? Math.round((attendanceCounts.present / nonAdminUsers.length) * 100)
      : 0;
    const pendingTickets = orders.pending + orders.preparing;
    const lowStockCount = metrics.lowStock;
    const insights = [
      {
        label: "Staff coverage",
        detail: `${attendanceCounts.present} of ${nonAdminUsers.length} on-site (${coveragePercent}%)`,
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
      labels: ["Present", "Late", "Absent", "On Leave"],
      datasets: [
        {
          data: [
            attendanceCounts.present,
            attendanceCounts.late,
            attendanceCounts.absent,
            attendanceCounts["on-leave"],
          ],
          backgroundColor: ["#22c55e", "#f97316", "#ef4444", "#2563eb"],
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

// Render Purchase & Sales Bar Chart
function renderPurchaseSalesChart() {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Calculate monthly sales from salesHistory
  const monthlySales = Array(12).fill(0);
  const monthlyPurchases = Array(12).fill(0);

  appState.salesHistory.forEach((sale) => {
    const date = new Date(sale.date);
    const month = date.getMonth();
    monthlySales[month] += sale.total || 0;
  });

  // Calculate purchases from inventory date_purchased
  appState.inventory.forEach((item) => {
    if (item.datePurchased) {
      const date = new Date(item.datePurchased);
      const month = date.getMonth();
      const purchaseValue = (item.quantity || 0) * (item.cost || 0);
      monthlyPurchases[month] += purchaseValue;
    }
  });

  ChartManager.plot("purchaseSalesChart", {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        {
          label: "Purchases",
          data: monthlyPurchases,
          backgroundColor: "#94a3b8",
          borderColor: "#64748b",
          borderWidth: 1,
        },
        {
          label: "Sales",
          data: monthlySales,
          backgroundColor: "#4ade80",
          borderColor: "#22c55e",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top" },
        title: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "₱" + value.toLocaleString();
            },
          },
        },
      },
    },
  });
}

// Render Recently Added Items
function renderRecentlyAddedItems() {
  const tbody = document.getElementById("recently-added-items");
  if (!tbody) return;

  const recentItems = [...appState.inventory]
    .filter((item) => item.createdAt || item.datePurchased)
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.datePurchased);
      const dateB = new Date(b.createdAt || b.datePurchased);
      return dateB - dateA;
    })
    .slice(0, 5);

  if (recentItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align: center; padding: 1rem; color: #888;">No recent items</td></tr>';
    return;
  }

  tbody.innerHTML = recentItems
    .map((item, index) => {
      const salesPrice = item.cost ? (item.cost * 1.5).toFixed(2) : "0.00";
      return `
        <tr>
          <td style="padding: 0.5rem;">${index + 1}</td>
          <td style="padding: 0.5rem;">${item.name}</td>
          <td style="padding: 0.5rem; text-align: right;">₱${parseFloat(
            salesPrice
          ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    })
    .join("");
}

// Render Expired Items
function renderExpiredItems() {
  const tbody = document.getElementById("expired-items");
  if (!tbody) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiredItems = appState.inventory
    .filter((item) => {
      if (!item.useByDate) return false;
      const expireDate = new Date(item.useByDate);
      return expireDate < today;
    })
    .slice(0, 2);

  if (expiredItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 1rem; color: #888;">No expired items</td></tr>';
    return;
  }

  tbody.innerHTML = expiredItems
    .map((item, index) => {
      const expireDate = new Date(item.useByDate);
      return `
        <tr>
          <td style="padding: 0.5rem;">${index + 1}</td>
          <td style="padding: 0.5rem;">${item.id || "N/A"}</td>
          <td style="padding: 0.5rem;">${item.name}</td>
          <td style="padding: 0.5rem;">${item.category}</td>
          <td style="padding: 0.5rem;">${expireDate.toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" }
          )}</td>
        </tr>
      `;
    })
    .join("");
}

// Render Stock Alert
function renderStockAlert() {
  const tbody = document.getElementById("stock-alert-items");
  if (!tbody) return;

  const lowStockItems = appState.inventory
    .filter((item) => {
      const qty = item.quantity || 0;
      const reorderPoint = item.reorderPoint || 10;
      return qty <= reorderPoint && qty > 0;
    })
    .slice(0, 2);

  if (lowStockItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align: center; padding: 1rem; color: #888;">All items in stock</td></tr>';
    return;
  }

  tbody.innerHTML = lowStockItems
    .map(
      (item, index) => `
      <tr>
        <td style="padding: 0.5rem;">${index + 1}</td>
        <td style="padding: 0.5rem;">${item.name}</td>
        <td style="padding: 0.5rem;">${item.category}</td>
        <td style="padding: 0.5rem; text-align: right; color: #f97316; font-weight: 600;">${item.quantity.toFixed(
          2
        )}</td>
      </tr>
    `
    )
    .join("");
}

// Render Top 10 Trending Items Pie Chart
function renderTrendingItemsChart() {
  // Calculate trending items based on total_used or sales
  const trendingItems = [...appState.inventory]
    .filter((item) => item.totalUsed && item.totalUsed > 0)
    .sort((a, b) => (b.totalUsed || 0) - (a.totalUsed || 0))
    .slice(0, 10);

  if (trendingItems.length === 0) {
    // Show placeholder if no data
    ChartManager.plot("trendingItemsChart", {
      type: "pie",
      data: {
        labels: ["No Data"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["#e5e7eb"],
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "right" },
        },
      },
    });
    return;
  }

  const total = trendingItems.reduce(
    (sum, item) => sum + (item.totalUsed || 0),
    0
  );

  const colors = [
    "#60a5fa",
    "#1f2937",
    "#4ade80",
    "#fb923c",
    "#f472b6",
    "#a78bfa",
    "#fbbf24",
    "#ef4444",
    "#14b8a6",
    "#8b5cf6",
  ];

  ChartManager.plot("trendingItemsChart", {
    type: "pie",
    data: {
      labels: trendingItems.map((item) => {
        const percentage = ((item.totalUsed / total) * 100).toFixed(1);
        return `${item.name}: ${percentage} %`;
      }),
      datasets: [
        {
          data: trendingItems.map((item) => item.totalUsed),
          backgroundColor: colors.slice(0, trendingItems.length),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
          labels: {
            padding: 15,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.parsed;
              const percentage = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${value.toFixed(
                2
              )} units (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

// Update main renderDashboard to call new functions
const originalRenderDashboard = renderDashboard;
renderDashboard = function () {
  originalRenderDashboard();

  // Render new dashboard components
  renderPurchaseSalesChart();
  renderRecentlyAddedItems();
  renderExpiredItems();
  renderStockAlert();
  renderTrendingItemsChart();
};

// register renderer
window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["dashboard"] = renderDashboard;
