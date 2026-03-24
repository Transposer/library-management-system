const express = require("express");
const wishlistController = require("../controllers/wishlistController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/wishlist", requireAuth, wishlistController.addToWishlist);
router.get("/wishlist", requireAuth, wishlistController.getWishlist);
router.delete("/wishlist/:id", requireAuth, wishlistController.removeFromWishlist);

module.exports = router;
