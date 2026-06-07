const express = require("express");
const adminDashboardController = require("../controllers/adminDashboardController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
const adminOnly = [requireAuth, requireRole(["ADMIN"])];

router.get("/admin/dashboard/overview", ...adminOnly, adminDashboardController.getOverviewStats);
router.get("/admin/dashboard/loan-trends", ...adminOnly, adminDashboardController.getLoanTrends);
router.get("/admin/dashboard/popular-books", ...adminOnly, adminDashboardController.getPopularBooks);
router.get(
  "/admin/dashboard/recent-activities",
  ...adminOnly,
  adminDashboardController.getRecentActivities,
);

module.exports = router;
