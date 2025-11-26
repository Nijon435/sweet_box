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
  const totalSalesKpi = (appState.salesHistory || [])
    .filter((entry) => parseDateKey(entry.date) >= kpiCutoff)
    .reduce((sum, entry) => sum + entry.total, 0);
  const totalAttendanceKpi = (appState.attendanceLogs || []).filter(
    (log) => log.action === "in" && new Date(log.timestamp) >= kpiCutoff
  ).length;
  const weeklyUsage = (appState.inventoryUsage || []).reduce(
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
      labels: (appState.inventoryUsage || []).map((item) => item.label),
      datasets: [
        {
          data: (appState.inventoryUsage || []).map((item) => item.used),
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

  // Performance and stock trends charts removed - data not necessary for POS system
  // Charts can be re-added if needed with calculated data from orders/inventory
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["analytics"] = renderAnalytics;
