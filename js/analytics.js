async function renderAnalytics() {
  const universalRangeSelect = document.getElementById("universal-range");
  if (universalRangeSelect && !universalRangeSelect.dataset.bound) {
    universalRangeSelect.dataset.bound = "true";
    universalRangeSelect.addEventListener("change", renderAnalytics);
  }

  const universalRange = Number(universalRangeSelect?.value || 7);
  const kpiCutoff = new Date();
  kpiCutoff.setHours(0, 0, 0, 0);
  kpiCutoff.setDate(kpiCutoff.getDate() - (universalRange - 1));

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

  // Calculate additional KPIs
  const ordersInPeriod = (appState.orders || []).filter((order) => {
    if (order.timestamp) {
      const orderDate = new Date(order.timestamp);
      return orderDate >= kpiCutoff;
    }
    return false;
  });

  const totalOrders = ordersInPeriod.length;

  // Calculate metrics for KPIs
  const inventoryItems = appState.inventory || [];
  const inventoryValue = inventoryItems.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.cost || 0);
  }, 0);
  const inventoryTurnover =
    inventoryValue > 0 ? (totalSalesKpi / inventoryValue).toFixed(1) : "0.0";
  const avgTicket = totalOrders > 0 ? totalSalesKpi / totalOrders : 0;

  const kpiMap = {
    "kpi-sales": formatCurrency(totalSalesKpi),
    "kpi-orders": `${totalOrders} orders`,
    "analytics-turnover": `${inventoryTurnover}x`,
    "analytics-ticket": formatCurrency(avgTicket),
  };
  Object.entries(kpiMap).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });

  // Render Peak Hour Efficiency Chart using universal filter
  const ordersForPeakHour = (appState.orders || []).filter((order) => {
    if (order.timestamp) {
      const orderDate = new Date(order.timestamp);
      return orderDate >= kpiCutoff;
    }
    return false;
  });
  renderPeakHourChart(ordersForPeakHour);

  // Calculate attendance trend from actual attendance logs
  const computeAttendanceTrend = () => {
    const trend = [];
    const daysToShow = universalRange;
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
  const attendanceWindow = attendanceTrendData;

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

  // Revenue by day of week - filtered by universal range
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Calculate cutoff date based on universal range
  const revenueCutoff = new Date();
  revenueCutoff.setHours(0, 0, 0, 0);
  revenueCutoff.setDate(revenueCutoff.getDate() - (universalRange - 1));

  // Determine number of weeks to display based on filter
  let weeksToShow = 1;
  if (universalRange === 14) weeksToShow = 2;
  else if (universalRange === 30) weeksToShow = 4;

  // Create arrays for each week
  const weeklyData = [];
  for (let week = 0; week < weeksToShow; week++) {
    weeklyData.push([0, 0, 0, 0, 0, 0, 0]);
  }

  // Filter orders by date range and group by week and day
  (appState.orders || []).forEach((order) => {
    if (order.timestamp) {
      const orderDate = new Date(order.timestamp);
      if (orderDate >= revenueCutoff) {
        const dayIndex = orderDate.getDay();
        const daysAgo = Math.floor(
          (new Date() - orderDate) / (1000 * 60 * 60 * 24)
        );
        const weekIndex = Math.floor(daysAgo / 7);
        if (weekIndex < weeksToShow) {
          weeklyData[weekIndex][dayIndex] += order.total || 0;
        }
      }
    }
  });

  // Create datasets for each week
  const datasets = [];
  const weekColors = ["#f6c343", "#f97316", "#fb923c", "#fbbf24"];
  for (let week = 0; week < weeksToShow; week++) {
    datasets.push({
      label: weeksToShow === 1 ? "This Week" : `Week ${weeksToShow - week}`,
      data: weeklyData[week],
      backgroundColor: weekColors[week],
      borderRadius: 8,
    });
  }

  ChartManager.plot("inventoryUsageChart", {
    type: "bar",
    data: {
      labels: dayNames,
      datasets: datasets,
    },
    options: {
      plugins: {
        legend: { display: weeksToShow > 1 },
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

  // Attendance Trend - Multi-line chart showing daily frequency of each status
  // Fetch attendance data directly from database with date range
  const attendanceDays = universalRange;
  const attendanceLabels = [];
  const presentData = [];
  const lateData = [];
  const absentData = [];
  const leaveData = [];

  // Calculate date range
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 1); // Include today
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - attendanceDays + 1);

  try {
    // Fetch attendance logs from database
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];
    const baseUrl =
      typeof window !== "undefined" && window.APP_STATE_ENDPOINT
        ? window.APP_STATE_ENDPOINT.replace("/api/state", "")
        : "";

    const response = await fetch(
      `${baseUrl}/api/attendance-logs?start_date=${startDateStr}&end_date=${endDateStr}&limit=5000`,
      { credentials: "include" }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch attendance logs: ${response.status}`);
    }

    const attendanceLogs = await response.json();
    console.log(
      `Fetched ${attendanceLogs.length} attendance logs for date range ${startDateStr} to ${endDateStr}`
    );

    // Build date labels and calculate status counts
    for (let i = attendanceDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      const month = date.getMonth() + 1;
      const day = date.getDate();
      attendanceLabels.push(`${month}/${day}`);

      // Get all logs for this day
      const dayLogs = (attendanceLogs || []).filter(
        (log) => log.timestamp.startsWith(dateKey) && !log.archived
      );

      // Count clock-ins with late notes
      const lateCount = dayLogs.filter(
        (log) =>
          log.action === "in" &&
          log.note &&
          (log.note.toLowerCase().includes("late") ||
            log.note.toLowerCase().includes("Late"))
      ).length;

      // Count present (clock-ins that are not late)
      const clockInCount = dayLogs.filter((log) => log.action === "in").length;
      const presentCount = clockInCount - lateCount;

      // Count leave logs
      const leaveCount = dayLogs.filter((log) => log.action === "leave").length;

      // Count absent logs
      const absentCount = dayLogs.filter(
        (log) => log.action === "absent"
      ).length;

      presentData.push(presentCount);
      lateData.push(lateCount);
      absentData.push(absentCount);
      leaveData.push(leaveCount);
    }
  } catch (error) {
    console.error("Error fetching attendance logs for trend chart:", error);
    // Fill with zeros if fetch fails
    for (let i = 0; i < attendanceDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (attendanceDays - 1 - i));
      const month = date.getMonth() + 1;
      const day = date.getDate();
      attendanceLabels.push(`${month}/${day}`);
      presentData.push(0);
      lateData.push(0);
      absentData.push(0);
      leaveData.push(0);
    }
  }

  ChartManager.plot("attendanceTrendChart", {
    type: "line",
    data: {
      labels: attendanceLabels,
      datasets: [
        {
          label: "Present",
          data: presentData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: "#10b981",
          borderWidth: 2,
        },
        {
          label: "Late",
          data: lateData,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: "#f59e0b",
          borderWidth: 2,
        },
        {
          label: "Absent",
          data: absentData,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: "#ef4444",
          borderWidth: 2,
        },
        {
          label: "Leave",
          data: leaveData,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          tension: 0.4,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: "#6366f1",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            usePointStyle: true,
            padding: 15,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${context.parsed.y} employees`,
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

  // Order Type Distribution pie chart (in top row)
  const orderTypes = { "dine-in": 0, pickup: 0, delivery: 0 };
  (appState.orders || []).forEach((order) => {
    const type = (order.orderType || order.type || "dine-in").toLowerCase();
    if (orderTypes.hasOwnProperty(type)) {
      orderTypes[type]++;
    }
  });

  ChartManager.plot("orderTypeChart", {
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

  // Category Distribution pie chart
  const categoryCount = {};
  (appState.orders || []).forEach((order) => {
    if (order.itemsJson && Array.isArray(order.itemsJson)) {
      order.itemsJson.forEach((item) => {
        const category = item.category || "Other";
        categoryCount[category] =
          (categoryCount[category] || 0) + item.quantity;
      });
    }
  });

  const categoryLabels = Object.keys(categoryCount);
  const categoryData = Object.values(categoryCount);
  const categoryColors = [
    "#f6c343",
    "#f97316",
    "#5c2c06",
    "#fb923c",
    "#fbbf24",
    "#fdba74",
  ];

  ChartManager.plot("categoryDistributionChart", {
    type: "doughnut",
    data: {
      labels: categoryLabels,
      datasets: [
        {
          data: categoryData,
          backgroundColor: categoryColors.slice(0, categoryLabels.length),
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
              return `${context.label}: ${context.parsed} items (${percentage}%)`;
            },
          },
        },
      },
    },
  });

  // Render Best Products Chart
  renderBestProductsChart();
}

// Best Products Chart with category filter (progress bars)
function renderBestProductsChart(filterCategory = "all") {
  // Setup filter event listener
  const categoryFilter = document.getElementById(
    "best-products-category-filter"
  );
  if (categoryFilter && !categoryFilter.dataset.bound) {
    categoryFilter.dataset.bound = "true";
    categoryFilter.addEventListener("change", (e) => {
      renderBestProductsChart(e.target.value);
    });
  }

  // Aggregate product sales
  const productSales = {};
  (appState.orders || []).forEach((order) => {
    if (order.itemsJson && Array.isArray(order.itemsJson)) {
      order.itemsJson.forEach((item) => {
        const category = item.category || "other";
        if (
          filterCategory === "all" ||
          category.toLowerCase() === filterCategory.toLowerCase()
        ) {
          const key = item.name;
          if (!productSales[key]) {
            productSales[key] = { quantity: 0, revenue: 0, category: category };
          }
          productSales[key].quantity += item.quantity || 0;
          productSales[key].revenue += (item.quantity || 0) * (item.price || 0);
        }
      });
    }
  });

  // Sort by quantity and get top 5
  const topProducts = Object.entries(productSales)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const container = document.getElementById("best-products-chart-container");
  if (!container) return;

  if (topProducts.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: #999; padding: 2rem;">No product data available</p>';
    return;
  }

  const maxQuantity = topProducts[0].quantity;

  container.innerHTML = topProducts
    .map((product, index) => {
      const percentage = (product.quantity / maxQuantity) * 100;
      const barColors = ["#f6c343", "#f97316", "#fb923c", "#fbbf24", "#fdba74"];
      return `
      <div style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <span style="font-weight: 600; font-size: 0.9rem;">${product.name}</span>
          <span style="font-size: 0.85rem; color: #666;">${product.quantity} sold</span>
        </div>
        <div style="background: #f3f4f6; border-radius: 8px; height: 24px; overflow: hidden;">
          <div style="background: ${barColors[index]}; height: 100%; width: ${percentage}%; transition: width 0.3s ease; border-radius: 8px;"></div>
        </div>
      </div>
    `;
    })
    .join("");
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
      maintainAspectRatio: true,
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
