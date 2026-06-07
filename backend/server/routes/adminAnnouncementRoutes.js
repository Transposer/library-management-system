const express = require("express");
const adminAnnouncementController = require("../controllers/adminAnnouncementController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();
const adminOnly = [requireAuth, requireRole(["ADMIN"])];

router.get("/admin/announcements", ...adminOnly, adminAnnouncementController.listAnnouncements);
router.post("/admin/announcements", ...adminOnly, adminAnnouncementController.createAnnouncement);
router.put("/admin/announcements/:id", ...adminOnly, adminAnnouncementController.updateAnnouncement);
router.delete("/admin/announcements/:id", ...adminOnly, adminAnnouncementController.deleteAnnouncement);
router.put(
  "/admin/announcements/:id/publish",
  ...adminOnly,
  adminAnnouncementController.publishAnnouncement,
);
router.put(
  "/admin/announcements/:id/unpublish",
  ...adminOnly,
  adminAnnouncementController.unpublishAnnouncement,
);

module.exports = router;
