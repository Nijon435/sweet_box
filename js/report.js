// ============================================
// REPORTS & EXPORTS MODULE
// Version: 2.0 - Fixed all scoping issues
// ============================================

console.log("🔄 Reports module loading...");

// Helper function to fetch data from export API
async function fetchExportData(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export/${endpoint}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching export data for ${endpoint}:`, error);
    throw error;
  }
}

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
    showNotification("Data not loaded yet. Please wait a moment and try again.", "error");
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
      showNotification("Please select a staff member", "error");
      return;
    }

    if (!monthValue) {
      showNotification("Please select a month", "error");
      return;
    }

    // Call async functions
    (async () => {
      try {
        if (type === "staff-attendance-excel") {
          await exportStaffAttendanceExcel(staffId, monthValue);
        } else {
          await exportStaffAttendanceWord(staffId, monthValue);
        }
      } catch (error) {
        console.error("Error exporting staff attendance:", error);
        showNotification(`Error exporting report: ${error.message}`, "error");
      }
    })();
    return;
  }

  // Check if XLSX library is loaded for Excel exports
  if (typeof XLSX === "undefined") {
    console.error("SheetJS library not loaded!");
    showNotification(
      "Excel export library (SheetJS) is not loaded. Please refresh the page.", "error"
    );
    return;
  }

  console.log(`Routing to export function for: ${type}`);

  // Route to appropriate export function - use async for API calls
  (async () => {
    try {
      switch (type) {
        case "inventory":
          await exportInventoryReport();
          break;
        case "inventory-usage":
          await exportInventoryUsageReport();
          break;
        case "low-stock":
          await exportLowStockReport();
          break;
        case "sales":
          await exportSalesReport();
          break;
        case "orders":
          await exportOrdersReport();
          break;
        case "financial":
          await exportFinancialReport();
          break;
        case "employees":
          await exportEmployeesReport();
          break;
        case "attendance":
          await exportAttendanceReport();
          break;
        default:
          console.error(`Unknown report type: ${type}`);
          showNotification(`Report type "${type}" not implemented yet`, "error");
      }
    } catch (error) {
      console.error(`Error exporting ${type}:`, error);
      showNotification(`Error exporting report: ${error.message}`, "error");
    }
  })();
}

// ========== EXPORT FUNCTIONS ==========

async function exportInventoryReport() {
  console.log("Exporting inventory report...");
  const inventory = await fetchExportData("inventory");

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

async function exportInventoryUsageReport() {
  console.log("Exporting inventory usage report...");
  const usageLogs = await fetchExportData("inventory-usage");
  const inventory = await fetchExportData("inventory");

  const sheetData = usageLogs.map((log) => {
    const item = inventory.find((i) => i.id === log.inventoryItemId);

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

async function exportLowStockReport() {
  console.log("Exporting low stock report...");
  const inventory = await fetchExportData("inventory");

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

async function exportSalesReport() {
  console.log("Exporting sales report...");
  const orders = await fetchExportData("orders");

  // Group orders by date
  const salesByDate = {};
  orders.forEach((order) => {
    const date = new Date(order.timestamp).toLocaleDateString();
    if (!salesByDate[date]) {
      salesByDate[date] = { total: 0, count: 0 };
    }
    salesByDate[date].total += order.total || 0;
    salesByDate[date].count += 1;
  });

  const sheetData = Object.entries(salesByDate).map(([date, data]) => ({
    Date: date,
    "Total Sales (₱)": data.total.toFixed(2),
    "Number of Orders": data.count,
    "Average Order Value (₱)": (data.total / data.count).toFixed(2),
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales");

  ws["!cols"] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];

  XLSX.writeFile(wb, `Sales_Summary_${todayKey()}.xlsx`);
}

async function exportOrdersReport() {
  console.log("Exporting orders report...");
  const orders = await fetchExportData("orders");
  console.log("Orders data:", orders);
  console.log("First order sample:", orders[0]);

  const sheetData = orders.map((order) => {
    // Get items from itemsJson (camelCase from backend)
    const items = order.itemsJson || order.items_json || order.items || [];
    console.log(`Order ${order.id} items:`, items);

    let itemsText = "No items";
    if (Array.isArray(items) && items.length > 0) {
      itemsText = items
        .map(
          (i) =>
            `${i.name || "Unknown"} (x${i.quantity || i.qty || i.count || 1})`
        )
        .join(", ");
    } else if (typeof items === "string") {
      // If items is a JSON string, parse it
      try {
        const parsed = JSON.parse(items);
        if (Array.isArray(parsed)) {
          itemsText = parsed
            .map(
              (i) =>
                `${i.name || "Unknown"} (x${
                  i.quantity || i.qty || i.count || 1
                })`
            )
            .join(", ");
        }
      } catch (e) {
        itemsText = items; // Use as is if can't parse
      }
    }

    return {
      "Order ID": order.id,
      Date: new Date(order.timestamp).toLocaleDateString(),
      Time: new Date(order.timestamp).toLocaleTimeString(),
      Type: order.orderType || order.type || "dine-in",
      Items: itemsText,
      Total: order.total?.toFixed(2) || "0.00",
    };
  });

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");

  ws["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 50 },
    { wch: 12 },
  ];

  XLSX.writeFile(wb, `Order_History_${todayKey()}.xlsx`);
}

async function exportFinancialReport() {
  console.log("Exporting financial report...");
  const orders = await fetchExportData("orders");
  const inventory = await fetchExportData("inventory");
  const users = await fetchExportData("users");

  const totalRevenue = orders.reduce(
    (sum, order) => sum + (order.total || 0),
    0
  );

  const inventoryValue = inventory.reduce(
    (sum, item) => sum + item.quantity * (item.cost || 0),
    0
  );

  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate last 30 days revenue
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30DaysOrders = orders.filter(
    (o) => new Date(o.timestamp) >= thirtyDaysAgo
  );
  const last30DaysRevenue = last30DaysOrders.reduce(
    (sum, o) => sum + (o.total || 0),
    0
  );
  const avgDailyRevenue =
    last30DaysOrders.length > 0 ? last30DaysRevenue / 30 : 0;

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
      Value: users.length,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Financial");

  ws["!cols"] = [{ wch: 35 }, { wch: 20 }];

  XLSX.writeFile(wb, `Financial_Snapshot_${todayKey()}.xlsx`);
}

async function exportEmployeesReport() {
  console.log("Exporting employees report...");
  const employees = await fetchExportData("users");

  const sheetData = employees.map((emp) => ({
    Name: emp.name,
    Email: emp.email || "N/A",
    Role: emp.permission || "staff",
    "Shift Start": emp.shiftStart || "N/A",
    "Date Hired":
      emp.dateHired || emp.createdAt
        ? new Date(emp.dateHired || emp.createdAt).toLocaleDateString()
        : "N/A",
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
    { wch: 15 },
    { wch: 10 },
  ];

  XLSX.writeFile(wb, `Employee_Directory_${todayKey()}.xlsx`);
}

async function exportAttendanceReport() {
  console.log("Exporting attendance report...");
  const attendanceLogs = await fetchExportData("attendance");
  const users = await fetchExportData("users");

  const sheetData = attendanceLogs.map((log) => {
    const employee = users.find((e) => e.id === log.employeeId);

    let status = "";
    if (log.action === "in") status = "Clock In";
    else if (log.action === "out") status = "Clock Out";
    else if (log.action === "leave") status = "On Leave";
    else if (log.action === "absent") status = "Absent";

    return {
      Date: new Date(log.timestamp).toLocaleDateString(),
      Time: new Date(log.timestamp).toLocaleTimeString(),
      Employee: employee ? employee.name : log.employeeId,
      Status: status,
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
    { wch: 15 },
    { wch: 30 },
  ];

  XLSX.writeFile(wb, `Attendance_Log_${todayKey()}.xlsx`);
}

// Export Staff Attendance Report as Excel (Daily Time Record format)
async function exportStaffAttendanceExcel(staffId, monthValue) {
  if (typeof XLSX === "undefined") {
    showNotification("SheetJS is required for Excel export", "error");
    return;
  }

  // Fetch users to get employee details
  const users = await fetchExportData("users");
  const employee = users.find((e) => e.id === staffId);
  if (!employee) {
    showNotification("Employee not found", "error");
    return;
  }

  const [year, month] = monthValue.split("-");
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  // Get number of days in month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Fetch attendance logs for this employee and month from API
  const response = await fetch(
    `${API_BASE_URL}/api/export/attendance?employee_id=${staffId}&month=${monthValue}`
  );
  if (!response.ok) {
    showNotification("Failed to fetch attendance data", "error");
    return;
  }
  const monthLogs = await response.json();

  // Build the report data
  const reportData = [];

  // Header rows
  reportData.push(["DAILY TIME RECORD"]);
  reportData.push([`For the Period: ${monthName} ${year}`]);
  reportData.push([]);
  reportData.push([`Name: ${employee.name}`]);
  reportData.push([`Department: ${employee.permission || "Staff"}`]);
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

  // Add total hours row - properly calculate sum from all days
  const allTotalHours = reportData
    .slice(8) // Skip header rows
    .filter((row) => row[5] && row[5] !== "") // Filter out empty strings
    .reduce((sum, row) => sum + parseFloat(row[5]), 0);

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
async function exportStaffAttendanceWord(staffId, monthValue) {
  // Fetch users to get employee details
  const users = await fetchExportData("users");
  const employee = users.find((e) => e.id === staffId);
  if (!employee) {
    showNotification("Employee not found", "error");
    return;
  }

  const [year, month] = monthValue.split("-");
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  // Get number of days in month
  const daysInMonth = new Date(year, month, 0).getDate();

  // Fetch attendance logs for this employee and month from API
  const response = await fetch(
    `${API_BASE_URL}/api/export/attendance?employee_id=${staffId}&month=${monthValue}`
  );
  if (!response.ok) {
    showNotification("Failed to fetch attendance data", "error");
    return;
  }
  const monthLogs = await response.json();

  // Build the report data first for calculations
  const reportData = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    const dayLogs = monthLogs.filter((log) =>
      log.timestamp.startsWith(dateStr)
    );

    dayLogs.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let amIn = "";
    let amOut = "";
    let pmIn = "";
    let pmOut = "";
    let totalHours = 0;

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
    reportData.push({ day, amIn, amOut, pmIn, pmOut, totalStr, totalHours });
  }

  // Calculate totals for each half
  const firstHalf = reportData.slice(0, 15);
  const secondHalf = reportData.slice(15);
  const firstHalfTotal = firstHalf.reduce(
    (sum, row) => sum + row.totalHours,
    0
  );
  const secondHalfTotal = secondHalf.reduce(
    (sum, row) => sum + row.totalHours,
    0
  );
  const totalHoursSum = firstHalfTotal + secondHalfTotal;

  // Build HTML content for Word
  let htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Daily Time Record</title>
      <style>
        @page {
          size: 8.5in 14in;
          margin: 0.5in;
        }
        body { 
          font-family: Arial, sans-serif; 
          font-size: 10pt;
        }
        .header-box {
          border: 2px solid black;
          padding: 8px;
          margin-bottom: 15px;
        }
        .header-row {
          margin: 3px 0;
        }
        .header-split {
          display: table;
          width: 100%;
        }
        .header-left {
          display: table-cell;
          width: 50%;
        }
        .header-right {
          display: table-cell;
          width: 50%;
          text-align: right;
        }
        h2 { 
          text-align: center; 
          margin: 10px 0;
          font-size: 12pt;
          font-weight: bold;
        }
        .subtitle {
          text-align: center;
          margin: 5px 0 15px 0;
          font-size: 10pt;
        }
        .tables-wrapper {
          width: 100%;
        }
        .table-column {
          display: inline-block;
          width: 48%;
          vertical-align: top;
          margin: 0 1%;
        }
        table { 
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        th, td { 
          border: 1px solid black; 
          padding: 4px 2px;
          text-align: center;
        }
        th { 
          font-weight: bold;
          font-size: 8pt;
        }
        .signature-section {
          margin-top: 40px;
          page-break-inside: avoid;
        }
        .sig-line {
          margin: 30px 0 5px 0;
          border-bottom: 1px solid black;
          height: 1px;
        }
        .sig-label {
          font-size: 9pt;
          margin-top: 3px;
        }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="header-row">
          <div class="header-split">
            <div class="header-left"><strong>Name:</strong> ${
              employee.name
            }</div>
            <div class="header-right"><strong>For the Period:</strong> ${monthName} ${year}</div>
          </div>
        </div>
        <div class="header-row">
          <div class="header-split">
            <div class="header-left"><strong>Role:</strong> ${
              employee.role || "Staff"
            }</div>
            <div class="header-right"><strong>Access:</strong> ${
              employee.permission || "Staff"
            }</div>
          </div>
        </div>
      </div>
      
      <h2>DAILY TIME RECORD</h2>
      <div class="subtitle">For the Period: ${monthName} ${year}</div>
      
      <div class="tables-wrapper">
        <div class="table-column">
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

  // Add rows for days 1-15 in first table
  for (let i = 0; i < 15 && i < reportData.length; i++) {
    const row = reportData[i];
    htmlContent += `
      <tr>
        <td>${row.day}</td>
        <td>${row.amIn}</td>
        <td>${row.amOut}</td>
        <td>${row.pmIn}</td>
        <td>${row.pmOut}</td>
        <td>${row.totalStr}</td>
      </tr>
    `;
  }

  // Close first table with Total Hours row
  htmlContent += `
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="5" style="text-align: right;">Total Hours:</td>
                <td>${firstHalfTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div class="table-column">
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

  // Add rows for days 16 to end of month
  for (let i = 15; i < reportData.length; i++) {
    const row = reportData[i];
    htmlContent += `
      <tr>
        <td>${row.day}</td>
        <td>${row.amIn}</td>
        <td>${row.amOut}</td>
        <td>${row.pmIn}</td>
        <td>${row.pmOut}</td>
        <td>${row.totalStr}</td>
      </tr>
    `;
  }

  htmlContent += `
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="5" style="text-align: right;">Total Hours:</td>
                <td>${secondHalfTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <div style="text-align: center; margin: 20px 0; font-weight: bold; font-size: 11pt;">
        Total Hours Rendered: ${totalHoursSum.toFixed(2)}
      </div>
      
      <div class="signature-section">
        <div style="margin-bottom: 50px;">
          <div class="sig-line"></div>
          <div class="sig-label">Name and Signature of Employee</div>
        </div>
        
        <div>
          <div class="sig-line"></div>
          <div class="sig-label">Name and Signature of Immediate Supervisor</div>
        </div>
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
