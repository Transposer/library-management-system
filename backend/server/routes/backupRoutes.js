const express = require("express");
const backupController = require("../controllers/backupController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
const adminOnly = [requireAuth, requireRole(["ADMIN"])];

router.post("/admin/backup", ...adminOnly, backupController.createBackup);
router.get("/admin/backup", ...adminOnly, backupController.listBackups);
router.get("/admin/backup/:id/download", ...adminOnly, backupController.downloadBackup);
router.delete("/admin/backup/:id", ...adminOnly, backupController.deleteBackup);

module.exports = router;
