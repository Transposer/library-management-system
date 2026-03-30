// backend/routes/ratingRoutes.js
const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { requireAuth } = require('../middleware/auth');


router.post('/books/:bookId/rating', requireAuth, ratingController.createOrUpdateRating);
router.get('/books/:bookId/ratings', ratingController.getBookRatings);
router.get('/books/:bookId/rating/stats', ratingController.getBookRatingStats);
router.get('/users/me/ratings', requireAuth, ratingController.getMyRatings);

module.exports = router;