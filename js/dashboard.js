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
          backgroundColor: "rgba(246,195,67,0.15)",
          tension: 0.4,
          fill: true,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: "#f6c343",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverBackgroundColor: "#e0a10b",
          pointHoverBorderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(92, 44, 6, 0.9)",
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function (context) {
              return (
                "₱" +
                context.parsed.y.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })
              );
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "₱" + value.toLocaleString();
            },
          },
          grid: {
            color: "rgba(92, 44, 6, 0.1)",
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    },
  });

  ChartManager.plot("inventoryStatusChart", {
    type: "doughnut",
    data: {
      labels: ["Safe", "Low", "Soon to Expire", "Expired", "No Stock"],
      datasets: [
        {
          data: [
            metrics.totalItems -
              metrics.lowStock -
              metrics.outOfStock -
              metrics.soonToExpire -
              metrics.expired,
            metrics.lowStock,
            metrics.soonToExpire || 0,
            metrics.expired || 0,
            metrics.outOfStock,
          ],
          backgroundColor: [
            "#4ade80",
            "#fbbf24",
            "#fb923c",
            "#ef4444",
            "#94a3b8",
          ],
          borderColor: "#fff",
          borderWidth: 3,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { size: 10 },
            padding: 8,
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: "circle",
          },
          align: "center",
          display: true,
          maxWidth: 600,
        },
        tooltip: {
          backgroundColor: "rgba(92, 44, 6, 0.9)",
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
      layout: {
        padding: {
          bottom: 10,
        },
      },
    },
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

  // Render expired items, recently added items, and trending chart
  renderExpiredItems();
  renderRecentlyAddedItems();
  renderTrendingItemsChart();

  // Setup category checkboxes for trending items
  const checkboxContainer = document.getElementById(
    "trending-category-checkboxes"
  );
  if (checkboxContainer && !checkboxContainer.dataset.bound) {
    checkboxContainer.dataset.bound = "true";

    // Populate categories
    const categories = [
      ...new Set(appState.inventory.map((item) => item.category)),
    ]
      .filter(Boolean)
      .sort();

    // Add "All" checkbox
    const allCheckbox = document.createElement("div");
    allCheckbox.className = "trending-checkbox-item";
    allCheckbox.innerHTML = `
      <input type="checkbox" id="category-all" value="all" checked />
      <label for="category-all">All</label>
    `;
    checkboxContainer.appendChild(allCheckbox);

    // Add category checkboxes
    categories.forEach((cat) => {
      const checkboxItem = document.createElement("div");
      checkboxItem.className = "trending-checkbox-item";
      const id = `category-${cat.replace(/\s+/g, "-").toLowerCase()}`;
      checkboxItem.innerHTML = `
        <input type="checkbox" id="${id}" value="${cat}" checked />
        <label for="${id}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</label>
      `;
      checkboxContainer.appendChild(checkboxItem);
    });

    // Add event listeners
    checkboxContainer.addEventListener("change", (e) => {
      if (e.target.type === "checkbox") {
        const allCheckbox = document.getElementById("category-all");
        if (e.target.id === "category-all") {
          // If "All" is checked/unchecked, sync all other checkboxes
          const allChecked = e.target.checked;
          checkboxContainer
            .querySelectorAll('input[type="checkbox"]')
            .forEach((cb) => {
              cb.checked = allChecked;
            });
        } else {
          // If any category is unchecked, uncheck "All"
          const categoryCheckboxes = Array.from(
            checkboxContainer.querySelectorAll(
              'input[type="checkbox"]:not(#category-all)'
            )
          );
          const allCategoriesChecked = categoryCheckboxes.every(
            (cb) => cb.checked
          );
          allCheckbox.checked = allCategoriesChecked;
        }
        renderTrendingItemsChart();
      }
    });
  }
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
    .slice(0, 3);

  if (expiredItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align: center; padding: 1rem; color: #888;">No expired items</td></tr>';
    return;
  }

  tbody.innerHTML = expiredItems
    .map((item, index) => {
      const expireDate = new Date(item.useByDate);
      return `
        <tr>
          <td style="padding: 0.5rem;">${index + 1}</td>
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
    .slice(0, 3);

  if (recentItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align: center; padding: 1rem; color: #888;">No recent items</td></tr>';
    return;
  }

  tbody.innerHTML = recentItems
    .map((item, index) => {
      const dateAdded = new Date(item.createdAt || item.datePurchased);
      return `
        <tr>
          <td style="padding: 0.5rem;">${index + 1}</td>
          <td style="padding: 0.5rem;">${item.name}</td>
          <td style="padding: 0.5rem;">${item.category}</td>
          <td style="padding: 0.5rem;">${dateAdded.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}</td>
        </tr>
      `;
    })
    .join("");
}
// Render Top 10 Trending Items Pie Chart
function renderTrendingItemsChart() {
  const checkboxContainer = document.getElementById(
    "trending-category-checkboxes"
  );

  // Get selected categories from checkboxes
  let selectedCategories = [];
  if (checkboxContainer) {
    const allCheckbox = document.getElementById("category-all");
    if (allCheckbox && allCheckbox.checked) {
      selectedCategories = ["all"];
    } else {
      const checkedBoxes = checkboxContainer.querySelectorAll(
        'input[type="checkbox"]:checked:not(#category-all)'
      );
      selectedCategories = Array.from(checkedBoxes).map((cb) => cb.value);
    }
  }

  // Filter by selected categories
  let inventoryItems = [...appState.inventory];
  if (!selectedCategories.includes("all") && selectedCategories.length > 0) {
    inventoryItems = inventoryItems.filter((item) =>
      selectedCategories.includes(item.category)
    );
  }

  // Calculate trending items based on total_used (from database) or quantity as fallback
  const trendingItems = inventoryItems
    .map((item) => ({
      ...item,
      usageCount: item.totalUsed || item.total_used || 0,
    }))
    .filter((item) => item.usageCount > 0)
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 10);

  if (trendingItems.length === 0) {
    // If no usage data, show items sorted by quantity instead
    const topItemsByQty = inventoryItems
      .filter((item) => item.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    if (topItemsByQty.length === 0) {
      // Show placeholder if no data at all
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

    // Use quantity-based data
    const total = topItemsByQty.reduce((sum, item) => sum + item.quantity, 0);
    const colors = [
      "#f6c343",
      "#e0a10b",
      "#ffdb8a",
      "#d4a574",
      "#8b6914",
      "#ffd700",
      "#b8860b",
      "#daa520",
      "#f4a460",
      "#cd853f",
    ];

    ChartManager.plot("trendingItemsChart", {
      type: "pie",
      data: {
        labels: topItemsByQty.map((item) => item.name),
        datasets: [
          {
            data: topItemsByQty.map((item) => item.quantity),
            backgroundColor: colors.slice(0, topItemsByQty.length),
            borderColor: "#fff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        layout: {
          padding: {
            left: 80,
            right: 80,
            top: 60,
            bottom: 60,
          },
        },
        plugins: {
          legend: {
            display: false,
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
      plugins: [
        {
          id: "pieLabels",
          afterDraw: function (chart) {
            const ctx = chart.ctx;
            const dataset = chart.data.datasets[0];
            const meta = chart.getDatasetMeta(0);

            meta.data.forEach((element, index) => {
              const model = element;
              const midAngle = (element.startAngle + element.endAngle) / 2;
              const x = model.x + Math.cos(midAngle) * (model.outerRadius + 30);
              const y = model.y + Math.sin(midAngle) * (model.outerRadius + 30);

              const label = chart.data.labels[index];
              const value = dataset.data[index];
              const percentage = ((value / total) * 100).toFixed(1);
              const text = `${label}: ${percentage} %`;

              ctx.fillStyle = "#333";
              ctx.font = "11px Arial";
              ctx.textAlign = x < model.x ? "right" : "left";
              ctx.textBaseline = "middle";
              ctx.fillText(text, x, y);

              // Draw line from pie to label
              ctx.strokeStyle = "#999";
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(
                model.x + Math.cos(midAngle) * model.outerRadius,
                model.y + Math.sin(midAngle) * model.outerRadius
              );
              ctx.lineTo(x - (x < model.x ? 5 : -5), y);
              ctx.stroke();
            });
          },
        },
      ],
    });
    return;
  }

  // Use usage-based data
  const total = trendingItems.reduce((sum, item) => sum + item.usageCount, 0);

  const colors = [
    "#f6c343",
    "#e0a10b",
    "#ffdb8a",
    "#d4a574",
    "#8b6914",
    "#ffd700",
    "#b8860b",
    "#daa520",
    "#f4a460",
    "#cd853f",
  ];

  ChartManager.plot("trendingItemsChart", {
    type: "pie",
    data: {
      labels: trendingItems.map((item) => item.name),
      datasets: [
        {
          data: trendingItems.map((item) => item.usageCount),
          backgroundColor: colors.slice(0, trendingItems.length),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      layout: {
        padding: {
          left: 80,
          right: 80,
          top: 60,
          bottom: 60,
        },
      },
      plugins: {
        legend: {
          display: false,
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
    plugins: [
      {
        id: "pieLabels",
        afterDraw: function (chart) {
          const ctx = chart.ctx;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);

          meta.data.forEach((element, index) => {
            const model = element;
            const midAngle = (element.startAngle + element.endAngle) / 2;
            const x = model.x + Math.cos(midAngle) * (model.outerRadius + 30);
            const y = model.y + Math.sin(midAngle) * (model.outerRadius + 30);

            const label = chart.data.labels[index];
            const value = dataset.data[index];
            const percentage = ((value / total) * 100).toFixed(1);
            const text = `${label}: ${percentage} %`;

            ctx.fillStyle = "#333";
            ctx.font = "11px Arial";
            ctx.textAlign = x < model.x ? "right" : "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, x, y);

            // Draw line from pie to label
            ctx.strokeStyle = "#999";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(
              model.x + Math.cos(midAngle) * model.outerRadius,
              model.y + Math.sin(midAngle) * model.outerRadius
            );
            ctx.lineTo(x - (x < model.x ? 5 : -5), y);
            ctx.stroke();
          });
        },
      },
    ],
  });
}

// register renderer
window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["dashboard"] = renderDashboard;
