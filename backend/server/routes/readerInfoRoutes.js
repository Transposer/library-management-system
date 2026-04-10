const express = require("express");

const readerInfoController = require("../controllers/readerInfoController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

const studentOnly = [requireAuth, requireRole(["STUDENT"])];

// 3.1 System announcements (public list)
router.get("/announcements", readerInfoController.getAnnouncements);

// 3.2 Acquisition requests (reader own records)
router.post("/acquisition-requests", ...studentOnly, readerInfoController.createAcquisitionRequest);
router.get("/acquisition-requests", ...studentOnly, readerInfoController.getAcquisitionRequests);

// 3.4 Reader dashboard
router.get("/dashboard", ...studentOnly, readerInfoController.getDashboard);

module.exports = router;

