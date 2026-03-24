const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");

async function addToWishlist(userId, bookId) {
  // 检查图书是否存在且可见
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new AppError(404, "图书不存在");
  }

  // 检查是否已存在心愿单记录
  const existingWishlist = await prisma.wishlist.findFirst({
    where: {
      userId,
      bookId,
    },
  });

  if (existingWishlist) {
    throw new AppError(400, "该书已在心愿单中");
  }

  // 创建心愿单记录
  const wishlist = await prisma.wishlist.create({
    data: {
      userId,
      bookId,
    },
    include: {
      book: true,
    },
  });

  return {
    id: wishlist.id,
    bookId: wishlist.bookId,
    bookTitle: wishlist.book.title,
    createdAt: formatDateTime(wishlist.createdAt),
  };
}

async function getWishlist(userId, page = 1, size = 10) {
  const skip = (page - 1) * size;
  
  const [wishlistItems, totalCount] = await Promise.all([
    prisma.wishlist.findMany({
      where: {
        userId,
      },
      include: {
        book: true,
      },
      orderBy: {
        createdAt: "desc", // 按加入时间倒序
      },
      skip,
      take: size,
    }),
    prisma.wishlist.count({
      where: {
        userId,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / size);
  
  return {
    total: totalCount,
    page,
    size,
    totalPages,
    list: wishlistItems.map((item) => ({
      id: item.id,
      bookId: item.bookId,
      bookTitle: item.book.title,
      bookAuthor: item.book.author,
      available: item.book.available,
      availableCopies: item.book.availableCopies,
      createdAt: formatDateTime(item.createdAt),
    })),
  };
}

async function removeFromWishlist(userId, wishlistId) {
  const wishlist = await prisma.wishlist.findUnique({
    where: { id: wishlistId },
  });

  if (!wishlist || wishlist.userId !== userId) {
    throw new AppError(404, "心愿单记录不存在或非当前用户");
  }

  await prisma.wishlist.delete({
    where: { id: wishlistId },
  });
}

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};
