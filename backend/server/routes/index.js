const express = require("express");

const authRoutes = require("./authRoutes");
const bookRoutes = require("./bookRoutes");
const holdRoutes = require('./holdRoutes');
const loanRoutes = require("./loanRoutes");
const userRoutes = require("./userRoutes");
const wishlistRoutes = require("./wishlistRoutes");
const ratingRoutes = require("./ratingRoutes");  
const acquisitionRoutes = require("./acquisitionRoutes");  
const dashboardRoutes = require("./dashboardRoutes");      
const adminUserRoutes = require("./adminUserRoutes");
const adminDashboardRoutes = require("./adminDashboardRoutes");
const adminRoutes = require("./adminRoutes");
const announcementRoutes = require("./announcementRoutes");  // 公告路由
const librarianRoutes = require("./librarianRoutes");
const adminAuditRoutes = require("./adminAuditRoutes");
const adminConfigRoutes = require("./adminConfigRoutes");
const backupRoutes = require("./backupRoutes");
const adminAnnouncementRoutes = require("./adminAnnouncementRoutes");
const adminReportRoutes = require("./adminReportRoutes");
const adminAcquisitionRoutes = require("./adminAcquisitionRoutes");

const router = express.Router();

router.use(authRoutes);
router.use("/librarian", librarianRoutes);
router.use(bookRoutes);
router.use(holdRoutes);
router.use(loanRoutes);
router.use(userRoutes);
router.use(wishlistRoutes);
router.use(ratingRoutes);
router.use(acquisitionRoutes);   
router.use(dashboardRoutes);     
router.use(adminUserRoutes);
router.use(adminDashboardRoutes);
router.use(announcementRoutes);
router.use(adminAuditRoutes);
router.use(adminConfigRoutes);
router.use(backupRoutes);
router.use(adminAnnouncementRoutes);
router.use(adminReportRoutes);
router.use(adminAcquisitionRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
