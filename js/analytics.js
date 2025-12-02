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

  let totalSalesKpi = (appState.salesHistory || [])
    .filter((entry) => parseDateKey(entry.date) >= kpiCutoff)
    .reduce((sum, entry) => sum + (entry.total || 0), 0);

  // Calculate from orders if sales_history is empty
  if (totalSalesKpi === 0 && appState.orders && appState.orders.length > 0) {
    totalSalesKpi = appState.orders.reduce((sum, order) => {
      if (order.timestamp) {
        const orderDate = new Date(order.timestamp);
        if (orderDate >= kpiCutoff) {
          return sum + (order.total || 0);
        }
      }
      return sum;
    }, 0);
  }

  const totalAttendanceKpi = (appState.attendanceLogs || []).filter(
    (log) =>
      log.action === "in" &&
      new Date(log.timestamp) >= kpiCutoff &&
      !log.archived
  ).length;
  const weeklyUsage = (appState.inventoryTrends || []).reduce(
    (sum, item) => sum + (item.used || 0),
    0
  );
  const usageEstimate = Math.round(weeklyUsage * (kpiRangeDays / 7));

  // Calculate additional KPIs
  const ordersInPeriod = (appState.orders || []).filter((order) => {
    if (order.timestamp) {
      const orderDate = new Date(order.timestamp);
      return orderDate >= kpiCutoff;
    }
    return false;
  });

  const totalOrders = ordersInPeriod.length;

  // Calculate metrics for moved cards
  const inventoryItems = appState.inventory || [];
  const inventoryValue = inventoryItems.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.costPerUnit || 0);
  }, 0);
  const inventoryTurnover =
    inventoryValue > 0 ? (totalSalesKpi / inventoryValue).toFixed(1) : "0.0";
  const avgTicket = totalOrders > 0 ? totalSalesKpi / totalOrders : 0;
  const productivity =
    totalAttendanceKpi > 0
      ? (totalOrders / totalAttendanceKpi).toFixed(1)
      : "0.0";

  const kpiMap = {
    "kpi-sales": formatCurrency(totalSalesKpi),
    "kpi-attendance": `${totalAttendanceKpi} logs`,
    "kpi-stock": `${usageEstimate} units`,
    "analytics-turnover": `${inventoryTurnover}x`,
    "analytics-ticket": formatCurrency(avgTicket),
    "analytics-productivity": `${productivity} orders`,
  };
  Object.entries(kpiMap).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });

  // Render Peak Hour Efficiency Chart
  renderPeakHourChart(ordersInPeriod);

  // Calculate attendance trend from actual attendance logs
  const computeAttendanceTrend = () => {
    const trend = [];
    const daysToShow = 30; // Show last 30 days
    const today = new Date();

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];

      // Count logs for this day
      const dayLogs = (appState.attendanceLogs || []).filter(
        (log) => log.timestamp.startsWith(dateKey) && !log.archived
      );

      const present = dayLogs.filter((log) => log.action === "in").length;
      const late = dayLogs.filter(
        (log) =>
          log.action === "in" &&
          log.note &&
          log.note.toLowerCase().includes("late")
      ).length;
      const onLeave = dayLogs.filter((log) => log.action === "leave").length;

      trend.push({
        date: dateKey,
        present: present,
        late: late,
        onLeave: onLeave,
      });
    }

    return trend;
  };

  const attendanceTrendData = computeAttendanceTrend();
  const attendanceWindow = attendanceTrendData.slice(-attendanceRange);

  console.log("Attendance Trend Data:", {
    total: attendanceTrendData.length,
    window: attendanceWindow.length,
    sample: attendanceWindow[0],
    lastEntry: attendanceWindow[attendanceWindow.length - 1],
  });

  // Check if attendance trend has any actual data
  const hasAttendanceData = attendanceWindow.some(
    (day) => day.present > 0 || day.late > 0 || day.onLeave > 0
  );
  if (!hasAttendanceData && attendanceWindow.length > 0) {
    console.warn(
      "⚠️ Attendance trend contains 30 days but all counts are zero. The 'attendance_logs' table may be empty or contain no 'action=in' records. Use the Attendance page to clock in employees."
    );
  }

  console.log("Analytics Data Check:", {
    orders: appState.orders?.length || 0,
    salesHistory: appState.salesHistory?.length || 0,
    attendanceTrend: appState.attendanceTrend?.length || 0,
    sampleOrder: appState.orders?.[0],
    firstOrderFields: appState.orders?.[0]
      ? Object.keys(appState.orders[0])
      : [],
    firstOrderItemsJson_camelCase: appState.orders?.[0]?.itemsJson,
    firstOrderItemsJson_snakeCase: appState.orders?.[0]?.items_json,
    itemsJsonType: typeof appState.orders?.[0]?.itemsJson,
    attendanceTrendSample: appState.attendanceTrend?.[0],
  });

  // Calculate top selling products by revenue
  const productRevenue = {};
  (appState.orders || []).forEach((order) => {
    try {
      // Check multiple possible field names for items
      let items = null;

      if (order.itemsJson) {
        items = Array.isArray(order.itemsJson) ? order.itemsJson : null;
      } else if (order.items_json) {
        items = Array.isArray(order.items_json) ? order.items_json : null;
      } else if (order.items) {
        items =
          typeof order.items === "string"
            ? JSON.parse(order.items)
            : order.items;
      }

      // Ensure items is an array
      if (!Array.isArray(items) || items.length === 0) {
        return;
      }

      // Calculate revenue per item based on order total
      const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
      const orderTotal = order.total || 0;

      items.forEach((item) => {
        const key = item.name || "Unknown";
        // If unitPrice exists, use it; otherwise distribute order total proportionally
        const revenue = item.unitPrice
          ? (item.unitPrice || 0) * (item.qty || 0)
          : totalQty > 0
          ? (orderTotal * (item.qty || 0)) / totalQty
          : 0;
        productRevenue[key] = (productRevenue[key] || 0) + revenue;
      });
    } catch (e) {
      console.error("Error parsing order items:", e, "Order:", order);
    }
  });

  const topProducts = Object.entries(productRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  console.log("Top Selling Products:", {
    totalProducts: Object.keys(productRevenue).length,
    topProducts: topProducts,
    sampleRevenue: Object.entries(productRevenue).slice(0, 3),
    processedOrders: (appState.orders || []).length,
    ordersWithItems: (appState.orders || []).filter(
      (o) => o.itemsJson && Array.isArray(o.itemsJson) && o.itemsJson.length > 0
    ).length,
  });

  // Show message if no order items data exists
  if (topProducts.length === 0 && (appState.orders || []).length > 0) {
    console.warn(
      "⚠️ Orders exist but contain no item data. The 'items_json' column in the database may be NULL. New orders should populate this field."
    );
  }

  // Generate inventory recommendations
  const recommendationsDiv = document.getElementById(
    "inventory-recommendations"
  );
  if (recommendationsDiv) {
    if (topProducts.length === 0) {
      // Show message when no product data exists
      recommendationsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.2rem;">ℹ️</span>
          <span style="color: #1e40af;"><strong>No product data yet.</strong> Create new orders to see top selling products and recommendations.</span>
        </div>
      `;
    } else {
      const recommendations = [];
      topProducts.forEach((product) => {
        // Find matching inventory item
        const inventoryItem = appState.inventory?.find(
          (item) =>
            item.name?.toLowerCase().includes(product.name.toLowerCase()) ||
            product.name.toLowerCase().includes(item.name?.toLowerCase())
        );

        if (inventoryItem) {
          const threshold =
            inventoryItem.category === "supplies" ||
            inventoryItem.category === "beverages"
              ? 10
              : 5;
          if (inventoryItem.quantity < threshold) {
            recommendations.push(
              `<strong>${inventoryItem.name}</strong> is low stock (${
                inventoryItem.quantity
              } ${inventoryItem.unit || "units"})`
            );
          }
        }
      });

      if (recommendations.length > 0) {
        recommendationsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="font-size: 1.2rem;">⚠️</span>
          <strong style="color: #92400e;">Restock Recommendations:</strong>
        </div>
        <ul style="margin: 0; padding-left: 1.5rem; color: #78350f;">
          ${recommendations.map((rec) => `<li>${rec}</li>`).join("")}
        </ul>
      `;
      } else {
        recommendationsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.2rem;">✅</span>
          <span style="color: #15803d;"><strong>All good!</strong> Inventory levels are sufficient for top selling items.</span>
        </div>
      `;
      }
    }
  }

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
    if (order.timestamp) {
      const dayIndex = new Date(order.timestamp).getDay();
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
      labels:
        attendanceWindow.length > 0
          ? attendanceWindow.map((item) => item.label)
          : ["No Data"],
      datasets: [
        {
          label: "Present",
          data:
            attendanceWindow.length > 0
              ? attendanceWindow.map((item) => item.present)
              : [0],
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Late",
          data:
            attendanceWindow.length > 0
              ? attendanceWindow.map((item) => item.late)
              : [0],
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "On Leave",
          data:
            attendanceWindow.length > 0
              ? attendanceWindow.map((item) => item.onLeave || 0)
              : [0],
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "On Leave",
          data: attendanceWindow.map((item) => item.onLeave || 0),
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
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

  // Order Type Distribution (Dine-in vs Pickup vs Delivery)
  const orderTypes = { "dine-in": 0, pickup: 0, delivery: 0 };
  (appState.orders || []).forEach((order) => {
    const type = (order.orderType || order.type || "dine-in").toLowerCase();
    if (orderTypes.hasOwnProperty(type)) {
      orderTypes[type]++;
    }
  });

  ChartManager.plot("performanceChart", {
    type: "doughnut",
    data: {
      labels: ["Dine-in", "Pickup", "Delivery"],
      datasets: [
        {
          data: [
            orderTypes["dine-in"],
            orderTypes["pickup"],
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

// Render Peak Hour Efficiency Chart
function renderPeakHourChart(ordersInPeriod) {
  // Group orders by hour
  const hourlyOrders = {};
  for (let hour = 0; hour < 24; hour++) {
    hourlyOrders[hour] = 0;
  }

  ordersInPeriod.forEach((order) => {
    if (!order.timestamp) return;
    const hour = new Date(order.timestamp).getHours();
    hourlyOrders[hour]++;
  });

  // Find peak hours
  const peakHour = Object.entries(hourlyOrders).reduce(
    (max, [hour, count]) =>
      count > max.count ? { hour: parseInt(hour), count } : max,
    { hour: 0, count: 0 }
  );

  const formatHour = (h) => {
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}${period}`;
  };

  // Update insights
  const insightsDiv = document.getElementById("peak-hour-insights");
  if (insightsDiv) {
    const avgOrdersPerHour =
      ordersInPeriod.length > 0
        ? (ordersInPeriod.length / 24).toFixed(1)
        : "0.0";
    insightsDiv.innerHTML = `
      <strong>📊 Peak Hour:</strong> ${formatHour(peakHour.hour)} with ${
      peakHour.count
    } orders<br>
      <strong>📈 Average:</strong> ${avgOrdersPerHour} orders per hour
    `;
  }

  // Destroy existing chart
  const existingChart = Chart.getChart("peakHourChart");
  if (existingChart) existingChart.destroy();

  // Create chart
  const ctx = document.getElementById("peakHourChart");
  if (!ctx) return;

  const labels = Object.keys(hourlyOrders).map((h) => formatHour(parseInt(h)));
  const data = Object.values(hourlyOrders);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Orders",
          data,
          backgroundColor: "rgba(59, 130, 246, 0.5)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} orders`,
          },
        },
      },
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
}

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["analytics"] = renderAnalytics;
