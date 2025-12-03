// ============================================
// REPORTS & EXPORTS MODULE
// Version: 2.0 - Fixed all scoping issues
// ============================================

console.log("🔄 Reports module loading...");

function renderReports() {
  console.log("📊 Reports page initialized");
  console.log("Current appState:", appState);
  console.log("Users available:", appState?.users?.length || 0);

  // Attach click handlers to all export buttons
  const buttons = document.querySelectorAll("[data-report]");
  console.log(`Found ${buttons.length} export buttons`);

  buttons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const reportType = button.dataset.report;
      console.log(`Button clicked for report: ${reportType}`);
      exportReport(reportType);
    });
  });

  // Populate staff selector with retry mechanism - wait longer for appState
  setTimeout(() => {
    populateStaffSelector();
  }, 2000);

  // Set default month to current month
  const monthInput = document.getElementById("attendance-month");
  if (monthInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    monthInput.value = `${year}-${month}`;
  }
}

function populateStaffSelector(retries = 0) {
  const staffSelect = document.getElementById("staff-select");
  if (!staffSelect) {
    console.warn("Staff select element not found");
    return;
  }

  // Ensure appState is loaded - check both getAppState() and global appState
  const currentState =
    getAppState() || (typeof appState !== "undefined" ? appState : null);

  if (!currentState || !currentState.users || currentState.users.length === 0) {
    if (retries < 10) {
      console.warn(
        `Users not loaded yet (attempt ${retries + 1}/10), retrying...`
      );
      setTimeout(() => populateStaffSelector(retries + 1), 500);
      return;
    } else {
      console.error("Failed to load users after 10 attempts");
      staffSelect.innerHTML = '<option value="">No employees found</option>';
      return;
    }
  }

  const users = currentState.users || [];
  const employees = users.filter((e) => !e.archived);

  console.log(
    `Total users: ${users.length}, Active employees: ${employees.length}`
  );

  if (employees.length === 0) {
    staffSelect.innerHTML = '<option value="">No active employees</option>';
    return;
  }

  staffSelect.innerHTML = '<option value="">Choose staff member...</option>';
  employees.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.id;
    option.textContent = `${emp.name} - ${
      emp.permission || emp.role || "staff"
    }`;
    staffSelect.appendChild(option);
  });

  console.log(`✅ Loaded ${employees.length} employees into dropdown`);
}

// Helper function to get appState from correct source
function getAppState() {
  return window.appState || (typeof appState !== "undefined" ? appState : null);
}

function exportReport(type) {
  console.log(`📤 Exporting report: ${type}`);

  // Get appState from window or global scope
  const currentState =
    getAppState() || (typeof appState !== "undefined" ? appState : null);

  if (!currentState) {
    alert("Data not loaded yet. Please wait a moment and try again.");
    console.error("appState is not available");
    return;
  }

  console.log("Available data:", {
    users: currentState.users?.length || 0,
    inventory: currentState.inventory?.length || 0,
    orders: currentState.orders?.length || 0,
    attendanceLogs: currentState.attendanceLogs?.length || 0,
    salesHistory: currentState.salesHistory?.length || 0,
    inventoryUsageLogs: currentState.inventoryUsageLogs?.length || 0,
  });

  // Handle staff attendance reports separately
  if (type === "staff-attendance-excel" || type === "staff-attendance-word") {
    const staffId = document.getElementById("staff-select")?.value;
    const monthValue = document.getElementById("attendance-month")?.value;

    if (!staffId) {
      alert("Please select a staff member");
      return;
    }

    if (!monthValue) {
      alert("Please select a month");
      return;
    }

    if (type === "staff-attendance-excel") {
      exportStaffAttendanceExcel(staffId, monthValue);
    } else {
      exportStaffAttendanceWord(staffId, monthValue);
    }
    return;
  }

  // Check if XLSX library is loaded for Excel exports
  if (typeof XLSX === "undefined") {
    console.error("SheetJS library not loaded!");
    alert(
      "Excel export library (SheetJS) is not loaded. Please refresh the page."
    );
    return;
  }

  console.log(`Routing to export function for: ${type}`);

  // Route to appropriate export function
  try {
    switch (type) {
      case "inventory":
        exportInventoryReport();
        break;
      case "inventory-usage":
        exportInventoryUsageReport();
        break;
      case "low-stock":
        exportLowStockReport();
        break;
      case "sales":
        exportSalesReport();
        break;
      case "orders":
        exportOrdersReport();
        break;
      case "financial":
        exportFinancialReport();
        break;
      case "employees":
        exportEmployeesReport();
        break;
      case "attendance":
        exportAttendanceReport();
        break;
      default:
        console.error(`Unknown report type: ${type}`);
        alert(`Report type "${type}" not implemented yet`);
    }
  } catch (error) {
    console.error(`Error exporting ${type}:`, error);
    alert(`Error exporting report: ${error.message}`);
  }
}

// ========== EXPORT FUNCTIONS ==========

function exportInventoryReport() {
  console.log("Exporting inventory report...");
  const inventory = (getAppState().inventory || []).filter(
    (item) => !item.archived
  );

  const sheetData = inventory.map((item) => ({
    Category: item.category || "N/A",
    "Item Name": item.name,
    Quantity: item.quantity,
    Unit: item.unit || "units",
    "Unit Cost (₱)": item.cost || 0,
    "Total Value (₱)": (item.quantity * (item.cost || 0)).toFixed(2),
    "Reorder Point": item.reorderPoint || 10,
    Status:
      item.quantity < (item.reorderPoint || 10) ? "Low Stock" : "In Stock",
    "Date Purchased": item.datePurchased || "N/A",
    "Use By Date": item.useByDate || "N/A",
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");

  ws["!cols"] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.writeFile(wb, `Inventory_Ledger_${todayKey()}.xlsx`);
}

function exportInventoryUsageReport() {
  console.log("Exporting inventory usage report...");
  const usageLogs = (getAppState().inventoryUsageLogs || []).filter(
    (log) => !log.archived
  );

  const sheetData = usageLogs.map((log) => {
    const item = (getAppState().inventory || []).find(
      (i) => i.id === log.inventoryItemId
    );

    // Use createdAt (camelCase) as primary field
    const dateValue = log.createdAt || log.created_at || log.timestamp;

    return {
      Date: dateValue ? new Date(dateValue).toLocaleDateString() : "N/A",
      Time: dateValue ? new Date(dateValue).toLocaleTimeString() : "N/A",
      "Item Name": item ? item.name : "Unknown",
      Quantity: log.quantity,
      Unit: item?.unit || "units",
      Reason: log.reason || "N/A",
      Notes: log.notes || "",
      "Recorded By": log.createdBy || "System",
    };
  });

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Usage Logs");

  ws["!cols"] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
    { wch: 30 },
    { wch: 20 },
  ];

  XLSX.writeFile(wb, `Inventory_Usage_${todayKey()}.xlsx`);
}

function exportLowStockReport() {
  console.log("Exporting low stock report...");
  const inventory = (getAppState().inventory || []).filter(
    (item) => !item.archived
  );

  const lowStockItems = inventory.filter((item) => {
    const reorderPoint = item.reorderPoint || 10;
    return item.quantity < reorderPoint;
  });

  const sheetData = lowStockItems.map((item) => ({
    Category: item.category || "N/A",
    "Item Name": item.name,
    "Current Quantity": item.quantity,
    Unit: item.unit || "units",
    "Reorder Point": item.reorderPoint || 10,
    Deficit: (item.reorderPoint || 10) - item.quantity,
    "Unit Cost (₱)": item.cost || 0,
    "Restock Cost (₱)": (
      ((item.reorderPoint || 10) - item.quantity) *
      (item.cost || 0)
    ).toFixed(2),
    Urgency: item.quantity === 0 ? "CRITICAL" : "Low",
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Low Stock");

  ws["!cols"] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 15 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 10 },
  ];

  XLSX.writeFile(wb, `Low_Stock_Alert_${todayKey()}.xlsx`);
}

function exportSalesReport() {
  console.log("Exporting sales report...");
  const salesHistory = getAppState().salesHistory || [];

  const sheetData = salesHistory.map((entry) => ({
    Date: entry.date,
    "Total Sales (₱)": entry.total.toFixed(2),
    "Number of Orders": entry.orderCount || 0,
    "Average Order Value (₱)":
      entry.orderCount > 0 ? (entry.total / entry.orderCount).toFixed(2) : 0,
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales");

  ws["!cols"] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];

  XLSX.writeFile(wb, `Sales_Summary_${todayKey()}.xlsx`);
}

function exportOrdersReport() {
  console.log("Exporting orders report...");
  const orders = getAppState().orders || [];

  const sheetData = orders.map((order) => ({
    "Order ID": order.id,
    Date: new Date(order.timestamp).toLocaleDateString(),
    Time: new Date(order.timestamp).toLocaleTimeString(),
    Customer: order.customerName || "Walk-in",
    Type: order.orderType || order.type || "dine-in",
    Items:
      order.items?.map((i) => `${i.name} (${i.quantity})`).join(", ") || "",
    Subtotal: order.subtotal?.toFixed(2) || 0,
    Tax: order.tax?.toFixed(2) || 0,
    Total: order.total?.toFixed(2) || 0,
    "Payment Method": order.paymentMethod || "cash",
    Status: order.status || "completed",
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");

  ws["!cols"] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 40 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 15 },
    { wch: 12 },
  ];

  XLSX.writeFile(wb, `Order_History_${todayKey()}.xlsx`);
}

function exportFinancialReport() {
  console.log("Exporting financial report...");
  const totalRevenue = (getAppState().salesHistory || []).reduce(
    (sum, entry) => sum + entry.total,
    0
  );

  const inventoryValue = (getAppState().inventory || [])
    .filter((item) => !item.archived)
    .reduce((sum, item) => sum + item.quantity * (item.cost || 0), 0);

  const totalOrders = (getAppState().orders || []).length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const last30Days = (getAppState().salesHistory || []).slice(-30);
  const last30DaysRevenue = last30Days.reduce(
    (sum, entry) => sum + entry.total,
    0
  );
  const avgDailyRevenue =
    last30Days.length > 0 ? last30DaysRevenue / last30Days.length : 0;

  const sheetData = [
    { Metric: "Total Revenue", Value: `₱${totalRevenue.toFixed(2)}` },
    { Metric: "Total Orders", Value: totalOrders },
    { Metric: "Average Order Value", Value: `₱${avgOrderValue.toFixed(2)}` },
    { Metric: "Inventory Value", Value: `₱${inventoryValue.toFixed(2)}` },
    {
      Metric: "Average Daily Revenue (Last 30 Days)",
      Value: `₱${avgDailyRevenue.toFixed(2)}`,
    },
    {
      Metric: "Total Employees",
      Value: (getAppState().users || []).filter((e) => !e.archived).length,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Financial");

  ws["!cols"] = [{ wch: 35 }, { wch: 20 }];

  XLSX.writeFile(wb, `Financial_Snapshot_${todayKey()}.xlsx`);
}

function exportEmployeesReport() {
  console.log("Exporting employees report...");
  const employees = (getAppState().users || []).filter((e) => !e.archived);

  const sheetData = employees.map((emp) => ({
    Name: emp.name,
    Email: emp.email || "N/A",
    Role: emp.permission || "staff",
    "Shift Start": emp.shiftStart || "N/A",
    "Shift End": emp.shiftEnd || "N/A",
    "Date Hired": emp.dateHired || "N/A",
    Status: emp.archived ? "Archived" : "Active",
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");

  ws["!cols"] = [
    { wch: 25 },
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 10 },
  ];

  XLSX.writeFile(wb, `Employee_Directory_${todayKey()}.xlsx`);
}

function exportAttendanceReport() {
  console.log("Exporting attendance report...");
  const attendanceLogs = (getAppState().attendanceLogs || []).filter(
    (log) => !log.archived
  );

  const sheetData = attendanceLogs.map((log) => {
    const employee = (getAppState().users || []).find(
      (e) => e.id === log.employeeId
    );

    return {
      Date: new Date(log.timestamp).toLocaleDateString(),
      Time: new Date(log.timestamp).toLocaleTimeString(),
      Employee: employee ? employee.name : log.employeeId,
      Action: log.action === "in" ? "Clock In" : "Clock Out",
      Shift: log.shift || "N/A",
      Notes: log.note || "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  ws["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 25 },
    { wch: 12 },
    { wch: 15 },
    { wch: 30 },
  ];

  XLSX.writeFile(wb, `Attendance_Log_${todayKey()}.xlsx`);
}

// Export Staff Attendance Report as Excel (Daily Time Record format)
function exportStaffAttendanceExcel(staffId, monthValue) {
  if (typeof XLSX === "undefined") {
    alert("SheetJS is required for Excel export");
    return;
  }

  const employee = (getAppState().users || []).find((e) => e.id === staffId);
  if (!employee) {
    alert("Employee not found");
    return;
  }

  const [year, month] = monthValue.split("-");
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  // Get number of days in month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Get all attendance logs for this employee in this month
  const monthLogs = (getAppState().attendanceLogs || []).filter((log) => {
    if (log.employeeId !== staffId || log.archived) return false;
    const logDate = new Date(log.timestamp);
    return (
      logDate.getFullYear() === parseInt(year) &&
      logDate.getMonth() === parseInt(month) - 1
    );
  });

  // Build the report data
  const reportData = [];

  // Header rows
  reportData.push(["DAILY TIME RECORD"]);
  reportData.push([`Student Assistantship Program`]);
  reportData.push([`For the Period: ${monthName} ${year}`]);
  reportData.push([]);
  reportData.push([`Name: ${employee.name}`]);
  reportData.push([`Dept/Office: ${employee.permission || "Staff"}`]);
  reportData.push([]);

  // Column headers
  reportData.push(["Day", "AM In", "AM Out", "PM In", "PM Out", "Total"]);

  // Data rows for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    // Get logs for this specific day
    const dayLogs = monthLogs.filter((log) =>
      log.timestamp.startsWith(dateStr)
    );

    // Sort by timestamp
    dayLogs.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let amIn = "";
    let amOut = "";
    let pmIn = "";
    let pmOut = "";
    let totalHours = 0;

    // Categorize clock-ins and clock-outs
    dayLogs.forEach((log) => {
      const time = new Date(log.timestamp);
      const hours = time.getHours();
      const timeStr = time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      if (log.action === "in") {
        if (hours < 12) {
          amIn = timeStr;
        } else {
          pmIn = timeStr;
        }
      } else if (log.action === "out") {
        if (hours < 12) {
          amOut = timeStr;
        } else {
          pmOut = timeStr;
        }
      }
    });

    // Calculate total hours
    if (amIn && amOut) {
      const inTime = new Date(`${dateStr}T${amIn}`);
      const outTime = new Date(`${dateStr}T${amOut}`);
      totalHours += (outTime - inTime) / (1000 * 60 * 60);
    }
    if (pmIn && pmOut) {
      const inTime = new Date(`${dateStr}T${pmIn}`);
      const outTime = new Date(`${dateStr}T${pmOut}`);
      totalHours += (outTime - inTime) / (1000 * 60 * 60);
    }

    const totalStr = totalHours > 0 ? totalHours.toFixed(2) : "";

    reportData.push([day, amIn, amOut, pmIn, pmOut, totalStr]);
  }

  // Add total hours row
  const allTotalHours = reportData
    .slice(8) // Skip header rows
    .filter((row) => row[5])
    .reduce((sum, row) => sum + parseFloat(row[5] || 0), 0);

  reportData.push([]);
  reportData.push(["Total Hours:", "", "", "", "", allTotalHours.toFixed(2)]);
  reportData.push(["Total Hours Rendered:", allTotalHours.toFixed(2)]);

  // Create worksheet and workbook
  const ws = XLSX.utils.aoa_to_sheet(reportData);

  // Set column widths
  ws["!cols"] = [
    { wch: 5 }, // Day
    { wch: 8 }, // AM In
    { wch: 8 }, // AM Out
    { wch: 8 }, // PM In
    { wch: 8 }, // PM Out
    { wch: 8 }, // Total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  // Download file
  XLSX.writeFile(
    wb,
    `DTR_${employee.name.replace(/\s/g, "_")}_${monthName}_${year}.xlsx`
  );
}

// Export Staff Attendance Report as Word (Daily Time Record format)
function exportStaffAttendanceWord(staffId, monthValue) {
  const employee = (getAppState().users || []).find((e) => e.id === staffId);
  if (!employee) {
    alert("Employee not found");
    return;
  }

  const [year, month] = monthValue.split("-");
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  // Get number of days in month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Get all attendance logs for this employee in this month
  const monthLogs = (getAppState().attendanceLogs || []).filter((log) => {
    if (log.employeeId !== staffId || log.archived) return false;
    const logDate = new Date(log.timestamp);
    return (
      logDate.getFullYear() === parseInt(year) &&
      logDate.getMonth() === parseInt(month) - 1
    );
  });

  // Build HTML content for Word
  let htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Daily Time Record</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid black; padding: 8px; text-align: center; }
        th { background-color: #f0f0f0; font-weight: bold; }
        h2 { text-align: center; margin: 5px 0; }
        .header-info { margin: 10px 0; }
      </style>
    </head>
    <body>
      <h2>DAILY TIME RECORD</h2>
      <h3 style="text-align: center; margin: 5px 0;">Student Assistantship Program</h3>
      <h3 style="text-align: center; margin: 5px 0;">For the Period: ${monthName} ${year}</h3>
      
      <div class="header-info">
        <p><strong>Name:</strong> ${employee.name}</p>
        <p><strong>Dept/Office:</strong> ${employee.permission || "Staff"}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>AM<br>In</th>
            <th>AM<br>Out</th>
            <th>PM<br>In</th>
            <th>PM<br>Out</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  let totalHoursSum = 0;

  // Add rows for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    // Get logs for this specific day
    const dayLogs = monthLogs.filter((log) =>
      log.timestamp.startsWith(dateStr)
    );

    // Sort by timestamp
    dayLogs.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let amIn = "";
    let amOut = "";
    let pmIn = "";
    let pmOut = "";
    let totalHours = 0;

    // Categorize clock-ins and clock-outs
    dayLogs.forEach((log) => {
      const time = new Date(log.timestamp);
      const hours = time.getHours();
      const timeStr = time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      if (log.action === "in") {
        if (hours < 12) {
          amIn = timeStr;
        } else {
          pmIn = timeStr;
        }
      } else if (log.action === "out") {
        if (hours < 12) {
          amOut = timeStr;
        } else {
          pmOut = timeStr;
        }
      }
    });

    // Calculate total hours
    if (amIn && amOut) {
      const inTime = new Date(`${dateStr}T${amIn}`);
      const outTime = new Date(`${dateStr}T${amOut}`);
      totalHours += (outTime - inTime) / (1000 * 60 * 60);
    }
    if (pmIn && pmOut) {
      const inTime = new Date(`${dateStr}T${pmIn}`);
      const outTime = new Date(`${dateStr}T${pmOut}`);
      totalHours += (outTime - inTime) / (1000 * 60 * 60);
    }

    totalHoursSum += totalHours;
    const totalStr = totalHours > 0 ? totalHours.toFixed(2) : "";

    htmlContent += `
      <tr>
        <td>${day}</td>
        <td>${amIn}</td>
        <td>${amOut}</td>
        <td>${pmIn}</td>
        <td>${pmOut}</td>
        <td>${totalStr}</td>
      </tr>
    `;
  }

  htmlContent += `
        </tbody>
      </table>
      
      <div style="margin-top: 20px;">
        <p><strong>Total Hours:</strong> ${totalHoursSum.toFixed(2)}</p>
        <p><strong>Total Hours Rendered:</strong> ${totalHoursSum.toFixed(
          2
        )}</p>
      </div>
    </body>
    </html>
  `;

  // Create a Blob and download as .doc file
  const blob = new Blob([htmlContent], {
    type: "application/msword",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `DTR_${employee.name.replace(
    /\s/g,
    "_"
  )}_${monthName}_${year}.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ========== Utility Functions ==========
// Note: todayKey() is defined in common.js and used here

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["report"] = renderReports;
