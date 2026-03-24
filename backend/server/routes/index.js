const express = require("express");

const authRoutes = require("./authRoutes");
const bookRoutes = require("./bookRoutes");
const loanRoutes = require("./loanRoutes");
const userRoutes = require("./userRoutes");
const wishlistRoutes = require("./wishlistRoutes");
const router = express.Router();

router.use(authRoutes);
router.use(bookRoutes);
router.use(loanRoutes);
router.use(userRoutes);
router.use(wishlistRoutes);
module.exports = router;
