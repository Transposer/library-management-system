const express = require("express");
const adminAuditController = require("../controllers/adminAuditController");
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const adminOnly = [requireAuth, requireRole(['ADMIN'])];

router.get("/admin/audit-logs", ...adminOnly, adminAuditController.listAuditLogs);

module.exports = router;