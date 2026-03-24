const wishlistService = require("../services/wishlistService");
const { sendSuccess } = require("../lib/response");

async function addToWishlist(req, res, next) {
  try {
    const data = await wishlistService.addToWishlist(
      req.currentUser.id,
      req.body.bookId
    );
    sendSuccess(res, data, "已加入心愿单");
  } catch (error) {
    next(error);
  }
}

async function getWishlist(req, res, next) {
  try {
    const { page = 1, size = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(size, 10);
    const data = await wishlistService.getWishlist(
      req.currentUser.id,
      pageNum,
      pageSize
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function removeFromWishlist(req, res, next) {
  try {
    const { id } = req.params;
    await wishlistService.removeFromWishlist(req.currentUser.id, id);
    sendSuccess(res, null, "已从心愿单移除");
  } catch (error) {
    next(error);
  }
}

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};
