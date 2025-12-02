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
  const salesTrendRangeSelect = document.getElementById("sales-trend-range");
  if (salesTrendRangeSelect && !salesTrendRangeSelect.dataset.bound) {
    salesTrendRangeSelect.dataset.bound = "true";
    salesTrendRangeSelect.addEventListener("change", renderAnalytics);
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
  const totalSalesKpi = (appState.salesHistory || [])
    .filter((entry) => parseDateKey(entry.date) >= kpiCutoff)
    .reduce((sum, entry) => sum + entry.total, 0);
  const totalAttendanceKpi = (appState.attendanceLogs || []).filter(
    (log) => log.action === "in" && new Date(log.timestamp) >= kpiCutoff
  ).length;
  const weeklyUsage = (appState.inventoryTrends || []).reduce(
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
  const attendanceWindow = (appState.attendanceTrend || []).slice(
    -attendanceRange
  );

  const inventorySummary = inventoryStats();
  const totalSales = (appState.salesHistory || []).reduce(
    (acc, entry) => acc + entry.total,
    0
  );
  const turnover = inventorySummary.value
    ? (totalSales / inventorySummary.value).toFixed(1)
    : "0.0";
  const latestSales =
    (appState.salesHistory || [])[appState.salesHistory?.length - 1]?.total ||
    0;
  const avgTicket = latestSales / ((appState.orders || []).length || 1);
  const totalOrders = (appState.orders || []).length;
  const analyticsMap = {
    "analytics-turnover": `${turnover}x inventory turnover`,
    "analytics-ticket": `${formatCurrency(avgTicket)} avg ticket`,
    "analytics-productivity": `${totalOrders} total orders`,
  };
  Object.entries(analyticsMap).forEach(([id, text]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  });

  // Sales Trend Over Time
  const salesTrendRange = Number(salesTrendRangeSelect?.value || 7);
  const salesCutoff = new Date();
  salesCutoff.setHours(0, 0, 0, 0);
  salesCutoff.setDate(salesCutoff.getDate() - (salesTrendRange - 1));

  const salesTrendData = (appState.salesHistory || [])
    .filter((entry) => {
      const entryDate = parseDateKey(entry.date);
      return entryDate >= salesCutoff;
    })
    .sort((a, b) => parseDateKey(a.date) - parseDateKey(b.date))
    .map((entry) => ({
      date: entry.date,
      total: entry.total || 0,
    }));

  ChartManager.plot("salesTrendChart", {
    type: "line",
    data: {
      labels: salesTrendData.map((item) => formatDateShort(item.date)),
      datasets: [
        {
          label: "Daily Sales",
          data: salesTrendData.map((item) => item.total),
          borderColor: "#f6c343",
          backgroundColor: "rgba(246, 195, 67, 0.1)",
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#f6c343",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
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
        },
      },
    },
  });

  // Calculate top selling products by revenue
  const productRevenue = {};
  (appState.orders || []).forEach((order) => {
    if (order.status === "served" && order.items) {
      try {
        const items =
          typeof order.items === "string"
            ? JSON.parse(order.items)
            : order.items;
        items.forEach((item) => {
          const key = item.name || "Unknown";
          const revenue = (item.unitPrice || 0) * (item.qty || 0);
          productRevenue[key] = (productRevenue[key] || 0) + revenue;
        });
      } catch (e) {
        console.error("Error parsing order items:", e);
      }
    }
  });

  const topProducts = Object.entries(productRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  ChartManager.plot("salesMixChart", {
    type: "bar",
    data: {
      labels: topProducts.map((p) =>
        p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name
      ),
      datasets: [
        {
          label: "Revenue",
          data: topProducts.map((p) => p.revenue),
          backgroundColor: [
            "#f6c343",
            "#f97316",
            "#5c2c06",
            "#fb923c",
            "#fbbf24",
          ],
          borderRadius: 8,
        },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return (
                "₱" +
                context.parsed.x.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })
              );
            },
          },
        },
      },
      scales: {
        x: {
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

  // Revenue by day of week
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const revenueByDay = [0, 0, 0, 0, 0, 0, 0];
  (appState.orders || []).forEach((order) => {
    if (order.status === "served" && order.servedAt) {
      const dayIndex = new Date(order.servedAt).getDay();
      revenueByDay[dayIndex] += order.total || 0;
    }
  });

  ChartManager.plot("inventoryUsageChart", {
    type: "bar",
    data: {
      labels: dayNames,
      datasets: [
        {
          label: "Revenue",
          data: revenueByDay,
          backgroundColor: "#f6c343",
          borderRadius: 8,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
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
        },
      },
    },
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
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Late",
          data: attendanceWindow.map((item) => item.late),
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Absent",
          data: attendanceWindow.map((item) => item.absent),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  });

  // Order Type Distribution (Dine-in vs Takeout vs Delivery)
  const orderTypes = { "dine-in": 0, takeout: 0, delivery: 0 };
  (appState.orders || []).forEach((order) => {
    const type = (order.orderType || order.type || "dine-in").toLowerCase();
    if (orderTypes.hasOwnProperty(type)) {
      orderTypes[type]++;
    }
  });

  ChartManager.plot("performanceChart", {
    type: "doughnut",
    data: {
      labels: ["Dine-in", "Takeout", "Delivery"],
      datasets: [
        {
          data: [
            orderTypes["dine-in"],
            orderTypes["takeout"],
            orderTypes["delivery"],
          ],
          backgroundColor: ["#f6c343", "#f97316", "#5c2c06"],
          borderColor: "#fff",
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} orders (${percentage}%)`;
            },
          },
        },
      },
    },
  });

  // Low Stock & Expiring Items
  const lowStockList = lowStockItems();
  const expiringItems = (appState.inventory || []).filter((item) => {
    const expiryDate =
      item.expiryDate || item.expiry_date || item.useByDate || item.use_by_date;
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.floor(
      (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  });

  const stockLabels = [];
  const stockData = [];
  const stockColors = [];

  lowStockList.slice(0, 5).forEach((item) => {
    stockLabels.push(
      item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name
    );
    stockData.push(item.quantity);
    stockColors.push("#fbbf24");
  });

  expiringItems.slice(0, 3).forEach((item) => {
    stockLabels.push(
      item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name
    );
    stockData.push(item.quantity || 0);
    stockColors.push("#ef4444");
  });

  ChartManager.plot("stockTrendsChart", {
    type: "bar",
    data: {
      labels: stockLabels.length > 0 ? stockLabels : ["No alerts"],
      datasets: [
        {
          label: "Quantity",
          data: stockData.length > 0 ? stockData : [0],
          backgroundColor: stockColors.length > 0 ? stockColors : ["#94a3b8"],
          borderRadius: 8,
        },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `Quantity: ${context.parsed.x}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
        },
      },
    },
  });
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["analytics"] = renderAnalytics;
