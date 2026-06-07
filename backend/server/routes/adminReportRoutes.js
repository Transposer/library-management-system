const express = require("express");
const adminReportController = require("../controllers/adminReportController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
const adminOnly = [requireAuth, requireRole(["ADMIN"])];

router.get("/admin/dashboard/reports/borrowing", ...adminOnly, adminReportController.getMonthlyBorrowingReport);
router.get("/admin/dashboard/reports/borrowing/export", ...adminOnly, adminReportController.exportMonthlyBorrowingReport);
router.get("/admin/dashboard/reports/overdue", ...adminOnly, adminReportController.getOverdueStatsReport);
router.get("/admin/dashboard/reports/overdue/export", ...adminOnly, adminReportController.exportOverdueStatsReport);
router.get("/admin/dashboard/reports/usage", ...adminOnly, adminReportController.getUsageSummaryReport);
router.get("/admin/dashboard/reports/usage/export", ...adminOnly, adminReportController.exportUsageSummaryReport);

module.exports = router;
