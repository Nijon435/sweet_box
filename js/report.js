function renderReports() {
  const buttons = document.querySelectorAll("[data-report]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => exportReport(button.dataset.report));
  });

  // Populate staff selector
  populateStaffSelector();

  // Set default month to current month
  const monthInput = document.getElementById("attendance-month");
  if (monthInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    monthInput.value = `${year}-${month}`;
  }
}

function populateStaffSelector() {
  const staffSelect = document.getElementById("staff-select");
  if (!staffSelect) return;

  const employees = (appState.employees || []).filter((e) => !e.archived);

  staffSelect.innerHTML = '<option value="">Select Staff...</option>';
  employees.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.id;
    option.textContent = `${emp.name} - ${emp.permission || "staff"}`;
    staffSelect.appendChild(option);
  });
}

function exportReport(type) {
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

  if (typeof XLSX === "undefined") {
    alert("SheetJS is required for exports");
    return;
  }
  let sheetData = [];
  const today = todayKey();
  switch (type) {
    case "inventory":
      sheetData = appState.inventory.map((item) => ({
        Category: item.category,
        Item: item.name,
        Quantity: `${item.quantity}`,
        "Reorder Point": item.reorderPoint,
        Cost: item.cost,
      }));
      break;
    case "sales":
      sheetData = appState.salesHistory.map((entry) => ({
        Date: entry.date,
        Total: entry.total,
      }));
      break;
    case "attendance":
      sheetData = getTodaysLogs().map((log) => ({
        Employee: getEmployee(log.employeeId)?.name || log.employeeId,
        Action: log.action,
        Timestamp: formatTime(log.timestamp),
        Shift: log.shift || log.note || "",
      }));
      break;
    case "financial":
      sheetData = [
        { Metric: "Revenue", Value: salesToday() },
        { Metric: "Average Daily", Value: salesYesterday() },
        { Metric: "Inventory Value", Value: inventoryStats().value },
      ];
      break;
    default:
      sheetData = [];
  }
  const sheet = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, `${type}-report`);
  XLSX.writeFile(wb, `${type}-report-${today}.xlsx`);
}

// Export Staff Attendance Report as Excel (Daily Time Record format)
function exportStaffAttendanceExcel(staffId, monthValue) {
  if (typeof XLSX === "undefined") {
    alert("SheetJS is required for Excel export");
    return;
  }

  const employee = (appState.employees || []).find((e) => e.id === staffId);
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
  const monthLogs = (appState.attendanceLogs || []).filter((log) => {
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
  const employee = (appState.employees || []).find((e) => e.id === staffId);
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
  const monthLogs = (appState.attendanceLogs || []).filter((log) => {
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

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["report"] = renderReports;
