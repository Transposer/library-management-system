const ExcelJS = require("exceljs");
const adminDashboardService = require("../services/adminDashboardService");
const { sendSuccess } = require("../lib/response");

function headerStyle() {
  return { font: { bold: true, color: { argb: "FFFFFFFF" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } } };
}

function autoWidth(worksheet) {
  worksheet.columns.forEach((col) => {
    let max = 10;
    col.values.forEach((v) => {
      const len = String(v || "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 60);
  });
}

async function sendExcel(res, fileName, buildFn) {
  const workbook = new ExcelJS.Workbook();
  await buildFn(workbook);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  await workbook.xlsx.write(res);
  res.end();
}

// ── Monthly Borrowing ───────────────────────────────────────────

async function getMonthlyBorrowingReport(req, res, next) {
  try {
    const data = await adminDashboardService.getMonthlyBorrowingReport(req.query.month);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function exportMonthlyBorrowingReport(req, res, next) {
  try {
    const data = await adminDashboardService.getMonthlyBorrowingReport(req.query.month);
    await sendExcel(res, `borrowing-report-${data.month}.xlsx`, async (wb) => {
      const s1 = wb.addWorksheet("Summary");
      s1.columns = [
        { header: "Metric", key: "metric" },
        { header: "Value", key: "value" },
      ];
      s1.addRows([
        { metric: "Total Checkouts", value: data.summary.totalCheckouts },
        { metric: "Total Returns", value: data.summary.totalReturns },
        { metric: "Net Borrowed", value: data.summary.netBorrowed },
        { metric: "Active Borrowers", value: data.summary.activeBorrowers },
      ]);
      s1.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s1);

      const s2 = wb.addWorksheet("Daily Trends");
      s2.columns = [
        { header: "Date", key: "date" },
        { header: "Checkouts", key: "checkouts" },
        { header: "Returns", key: "returns" },
      ];
      s2.addRows(data.dailyTrends);
      s2.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s2);

      const s3 = wb.addWorksheet("Top Books");
      s3.columns = [
        { header: "Rank", key: "rank" },
        { header: "Title", key: "title" },
        { header: "Author", key: "author" },
        { header: "Loan Count", key: "loanCount" },
      ];
      s3.addRows(data.topBooks);
      s3.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s3);
    });
  } catch (error) {
    next(error);
  }
}

// ── Overdue Stats ───────────────────────────────────────────────

async function getOverdueStatsReport(req, res, next) {
  try {
    const data = await adminDashboardService.getOverdueStatsReport(req.query.month);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function exportOverdueStatsReport(req, res, next) {
  try {
    const data = await adminDashboardService.getOverdueStatsReport(req.query.month);
    await sendExcel(res, `overdue-report-${data.month}.xlsx`, async (wb) => {
      const s1 = wb.addWorksheet("Summary");
      s1.columns = [
        { header: "Metric", key: "metric" },
        { header: "Value", key: "value" },
      ];
      s1.addRows([
        { metric: "Overdue Count", value: data.summary.overdueCount },
        { metric: "Total Fines (CNY)", value: data.summary.totalFines },
        { metric: "Collected Fines (CNY)", value: data.summary.collectedFines },
        { metric: "Avg Overdue Days", value: data.summary.avgOverdueDays },
        { metric: "Overdue Rate (%)", value: data.summary.overdueRate },
      ]);
      s1.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s1);

      const s2 = wb.addWorksheet("Top Overdue Books");
      s2.columns = [
        { header: "Title", key: "title" },
        { header: "Overdue Count", key: "overdueCount" },
        { header: "Avg Days", key: "avgDays" },
      ];
      s2.addRows(data.topOverdueBooks);
      s2.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s2);
    });
  } catch (error) {
    next(error);
  }
}

// ── Usage Summary ───────────────────────────────────────────────

async function getUsageSummaryReport(req, res, next) {
  try {
    const data = await adminDashboardService.getUsageSummaryReport(req.query.month);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function exportUsageSummaryReport(req, res, next) {
  try {
    const data = await adminDashboardService.getUsageSummaryReport(req.query.month);
    await sendExcel(res, `usage-report-${data.month}.xlsx`, async (wb) => {
      const s1 = wb.addWorksheet("Summary");
      s1.columns = [
        { header: "Metric", key: "metric" },
        { header: "Value", key: "value" },
      ];
      s1.addRows([
        { metric: "Total Checkouts", value: data.summary.totalCheckouts },
        { metric: "Active Borrowers", value: data.summary.activeBorrowers },
        { metric: "Avg Loans Per User", value: data.summary.avgLoansPerUser },
        { metric: "New Users", value: data.summary.newUsers },
        { metric: "Peak Day", value: data.summary.peakDay },
        { metric: "Peak Count", value: data.summary.peakCount },
      ]);
      s1.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s1);

      const s2 = wb.addWorksheet("Daily Activity");
      s2.columns = [
        { header: "Date", key: "date" },
        { header: "Checkouts", key: "checkouts" },
        { header: "Returns", key: "returns" },
        { header: "Active Users", key: "activeUsers" },
      ];
      s2.addRows(data.dailyActivity);
      s2.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s2);

      const s3 = wb.addWorksheet("Top Borrowers");
      s3.columns = [
        { header: "Rank", key: "rank" },
        { header: "Name", key: "name" },
        { header: "Email", key: "email" },
        { header: "Loan Count", key: "loanCount" },
      ];
      s3.addRows(data.topBorrowers);
      s3.getRow(1).eachCell((c) => Object.assign(c, headerStyle()));
      autoWidth(s3);
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMonthlyBorrowingReport,
  exportMonthlyBorrowingReport,
  getOverdueStatsReport,
  exportOverdueStatsReport,
  getUsageSummaryReport,
  exportUsageSummaryReport,
};
