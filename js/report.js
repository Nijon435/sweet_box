function renderReports() {
  const buttons = document.querySelectorAll("[data-report]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => exportReport(button.dataset.report));
  });
}

function exportReport(type) {
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

window.pageRenderers = window.pageRenderers || {};
window.pageRenderers["report"] = renderReports;
