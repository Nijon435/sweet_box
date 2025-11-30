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

  // Calculate staff coverage
  const nonAdminUsers = appState.users.filter(
    (user) => user.permission !== "admin"
  );
  const attendanceCounts = nonAdminUsers.reduce(
    (acc, emp) => {
      const status = computeEmployeeStatus(emp).status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0, "on-leave": 0 }
  );
  const coveragePercent = nonAdminUsers.length
    ? Math.round((attendanceCounts.present / nonAdminUsers.length) * 100)
    : 0;

  const metricMap = {
    "metric-sales": formatCurrency(todaySales),
    "metric-orders": `${
      orders.pending + orders.preparing + orders.ready
    } active`,
    "metric-coverage": `${coveragePercent}%`,
    "coverage-note": `${attendanceCounts.present} of ${nonAdminUsers.length} present`,
    "sales-trend-note": `${delta}% vs. yesterday`,
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

  // Render expired items and trending chart
  renderExpiredItems();
  renderTrendingItemsChart();
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
    .slice(0, 5);

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

// register renderer
window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["dashboard"] = renderDashboard;
