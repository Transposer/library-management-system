const express = require("express");
const adminAcquisitionController = require("../controllers/adminAcquisitionController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
const adminOnly = [requireAuth, requireRole(["ADMIN"])];

router.get("/admin/acquisition-requests", ...adminOnly, adminAcquisitionController.listAllRequests);
router.put("/admin/acquisition-requests/:id/approve", ...adminOnly, adminAcquisitionController.approveRequest);
router.put("/admin/acquisition-requests/:id/reject", ...adminOnly, adminAcquisitionController.rejectRequest);

module.exports = router;
