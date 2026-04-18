const express = require("express");

const authRoutes = require("./authRoutes");
const bookRoutes = require("./bookRoutes");
const holdRoutes = require('./holdRoutes');
const loanRoutes = require("./loanRoutes");
const userRoutes = require("./userRoutes");
const wishlistRoutes = require("./wishlistRoutes");
const ratingRoutes = require("./ratingRoutes");  // 评分路由
const adminUserRoutes = require("./adminUserRoutes");
const adminAuditRoutes = require("./adminAuditRoutes");
const librarianRoutes = require("./librarianRoutes");

const router = express.Router();

router.use(authRoutes);
router.use("/librarian", librarianRoutes);
router.use(bookRoutes);
router.use(holdRoutes);
router.use(loanRoutes);
router.use(userRoutes);
router.use(wishlistRoutes);
router.use(ratingRoutes);
router.use(adminUserRoutes);
router.use(adminAuditRoutes);

module.exports = router;
