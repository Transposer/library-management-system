// backend/controllers/ratingController.js
const ratingService = require('../services/ratingService');
const { AppError } = require('../lib/errors');
const { sendSuccess } = require('../lib/response');  // 改成 sendSuccess

class RatingController {
  /**
   * POST /api/books/:bookId/rating
   * 对图书评分
   */
  async createOrUpdateRating(req, res, next) {
    try {
      const { bookId } = req.params;
      const { stars } = req.body;
      const userId = req.currentUser.id;

      if (!stars || stars < 1 || stars > 5) {
        throw new AppError(400, '评分必须在1-5之间');
      }

      const book = await ratingService.checkBookExists(bookId);
      if (!book) {
        throw new AppError(404, '图书不存在');
      }

      const hasBorrowed = await ratingService.hasUserBorrowedBook(userId, bookId);
      if (!hasBorrowed) {
        throw new AppError(400, '只有借阅过该图书的读者才能评分');
      }

      const { rating, isUpdate } = await ratingService.upsertRating(userId, bookId, stars);

      // 改成 sendSuccess，注意参数顺序：sendSuccess(res, data, message)
      sendSuccess(res, {
        id: rating.id,
        bookId: rating.bookId,
        stars: rating.stars,
        createdAt: rating.createdAt
      }, isUpdate ? '评分已更新' : '评分成功');

    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/books/:bookId/ratings
   * 获取某本书的所有评分
   */
  async getBookRatings(req, res, next) {
    try {
      const { bookId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const size = parseInt(req.query.size) || 10;
      const book = await ratingService.checkBookExists(bookId);
      if (!book) {
        throw new AppError(404, '图书不存在');
      }
      const ratings = await ratingService.getBookRatings(bookId, page, size);
      const stats = await ratingService.getBookRatingStats(bookId);
      sendSuccess(res, {
        ...stats,
        ...ratings
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/me/ratings
   * 获取当前用户的评分记录
   */
  async getMyRatings(req, res, next) {
    try {
      const userId = req.currentUser.id;
      const page = parseInt(req.query.page) || 1;
      const size = parseInt(req.query.size) || 10;

      const ratings = await ratingService.getUserRatings(userId, page, size);
      sendSuccess(res, ratings);

    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/books/:bookId/rating/stats
   * 仅获取某本书的评分统计
   */
  async getBookRatingStats(req, res, next) {
    try {
      const { bookId } = req.params;

      const book = await ratingService.checkBookExists(bookId);
      if (!book) {
        throw new AppError(404, '图书不存在');
      }

      const stats = await ratingService.getBookRatingStats(bookId);
      sendSuccess(res, stats);

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RatingController();