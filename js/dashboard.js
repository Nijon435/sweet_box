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
      { present: 0, late: 0, absent: 0 }
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

// register renderer
window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["dashboard"] = renderDashboard;
