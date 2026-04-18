const express = require("express");
const adminAuditController = require("../controllers/adminAuditController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

router.get("/admin/audit-logs",
  requireAuth,
  requireRole("ADMIN"),
  adminAuditController.listAuditLogs
);

module.exports = router;