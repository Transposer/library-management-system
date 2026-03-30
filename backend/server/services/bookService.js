const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");

function parsePagination(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "参数错误");
  }

  return { page, size };
}

async function getAverageRatings(bookIds) {
  if (!bookIds.length) {
    return new Map();
  }

  const grouped = await prisma.rating.groupBy({
    by: ["bookId"],
    where: {
      bookId: { in: bookIds },
    },
    _avg: {
      stars: true,
    },
  });

  return new Map(
    grouped.map((item) => [item.bookId, item._avg.stars === null ? null : Number(item._avg.stars.toFixed(1))]),
  );
}

function toBookSummary(book, ratingMap) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    cover: book.cover,
    available: book.available,
    availableCopies: book.availableCopies,
    createdAt: formatDateTime(book.createdAt),
    ...(ratingMap.has(book.id) ? { averageRating: ratingMap.get(book.id) } : {}),
  };
}

async function listBooks(query) {
  const { page, size } = parsePagination(query || {});

  const [total, books] = await prisma.$transaction([
    prisma.book.count(),
    prisma.book.findMany({
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const ratingMap = await getAverageRatings(books.map((book) => book.id));

  return {
    total,
    page,
    size,
    list: books.map((book) => toBookSummary(book, ratingMap)),
  };
}

async function searchBooks(query) {
  const { keyword, type } = query || {};
  const { page, size } = parsePagination(query || {});

  if (!keyword || typeof keyword !== "string") {
    throw new AppError(400, "缺少 keyword 或参数错误");
  }

  if (type && !["title", "author"].includes(type)) {
    throw new AppError(400, "参数错误");
  }

  const searchConditions =
    type === "title"
      ? [{ title: { contains: keyword } }]
      : type === "author"
        ? [{ author: { contains: keyword } }]
        : [{ title: { contains: keyword } }, { author: { contains: keyword } }];

  const where = {
    OR: searchConditions,
  };

  const [total, books] = await prisma.$transaction([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const ratingMap = await getAverageRatings(books.map((book) => book.id));

  return {
    total,
    page,
    size,
    list: books.map((book) => toBookSummary(book, ratingMap)),
  };
}

async function getBookDetail(bookId) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new AppError(404, "图书不存在");
  }

  const average = await prisma.rating.aggregate({
    where: { bookId },
    _avg: {
      stars: true,
    },
  });

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    cover: book.cover,
    description: book.description,
    language: book.language,
    shelfLocation: book.shelfLocation,
    available: book.available,
    availableCopies: book.availableCopies,
    createdAt: formatDateTime(book.createdAt),
    averageRating: average._avg.stars === null ? null : Number(average._avg.stars.toFixed(1)),
  };
}

//新增获取图书列表，支持筛选排序分页
async function getBooksWithFilters(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);
  
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "参数错误");
  }
  
  const skip = (page - 1) * size;
  
  // 构建筛选条件
  let where = {};
  
  // 关键词搜索（书名或作者）
  if (query.keyword && typeof query.keyword === 'string') {
    where.OR = [
      { title: { contains: query.keyword } },
      { author: { contains: query.keyword } }
    ];
  }
  
  // 分类筛选
  if (query.genre) {
    where.genre = query.genre;
  }
  
  // 语言筛选
  if (query.language) {
    where.language = query.language;
  }
  
  // 是否可借筛选
  if (query.available !== undefined) {
    where.available = query.available === 'true';
  }
  
  // 获取总数和图书列表
  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      skip,
      take: size,
      include: {
        ratings: true  // 包含评分用于计算平均分
      }
    })
  ]);
  
  // 获取平均评分（如果books为空则直接返回）
  let ratingMap = new Map();
  if (books.length > 0) {
    const bookIds = books.map(b => b.id);
    const grouped = await prisma.rating.groupBy({
      by: ["bookId"],
      where: { bookId: { in: bookIds } },
      _avg: { stars: true }
    });
    ratingMap = new Map(
      grouped.map(item => [item.bookId, item._avg.stars === null ? null : Number(item._avg.stars.toFixed(1))])
    );
  }
  
  // 格式化列表
  let list = books.map(book => ({
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    cover: book.cover,
    description: book.description,
    language: book.language,
    shelfLocation: book.shelfLocation,
    available: book.available,
    availableCopies: book.availableCopies,
    createdAt: formatDateTime(book.createdAt),
    averageRating: ratingMap.get(book.id) || null
  }));
  
  // 排序处理（在内存中排序，因为评分是计算出来的）
  const sortBy = query.sortBy;
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  
  if (sortBy === 'rating') {
    list.sort((a, b) => sortOrder * ((a.averageRating || 0) - (b.averageRating || 0)));
  } else if (sortBy === 'createdAt') {
    list.sort((a, b) => sortOrder * (new Date(a.createdAt) - new Date(b.createdAt)));
  }
  // 如果没有指定排序，保持默认（已在数据库按创建时间倒序）
  
  return {
    total,
    page,
    size,
    list
  };
}

// 获取新书通报
async function getNewBooks(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);
  
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "参数错误");
  }
  
  const skip = (page - 1) * size;
  
  const [total, books] = await Promise.all([
    prisma.book.count(),
    prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: size
    })
  ]);
  
  const ratingMap = await getAverageRatings(books.map(book => book.id));
  
  return {
    total,
    page,
    size,
    list: books.map(book => toBookSummary(book, ratingMap))
  };
}

// 获取借阅排行榜
async function getRanking(query) {
  const period = query.period || 'month';
  const limit = Number(query.limit) || 10;
  
  // 计算时间范围
  const now = new Date();
  let startDate;
  if (period === 'week') {
    startDate = new Date(now.setDate(now.getDate() - 7));
  } else {
    startDate = new Date(now.setMonth(now.getMonth() - 1));
  }
  
  // 查询借阅记录并统计
  const rankings = await prisma.loan.groupBy({
    by: ['bookId'],
    where: {
      checkoutDate: { gte: startDate }
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit
  });
  
  if (rankings.length === 0) {
    return { list: [] };
  }
  
  // 获取图书详情
  const bookIds = rankings.map(r => r.bookId);
  const books = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    select: { id: true, title: true, author: true }
  });
  
  const bookMap = {};
  books.forEach(book => {
    bookMap[book.id] = book;
  });
  
  const list = rankings.map((ranking, index) => ({
    bookId: ranking.bookId,
    bookTitle: bookMap[ranking.bookId]?.title || '未知',
    bookAuthor: bookMap[ranking.bookId]?.author || '未知',
    loanCount: ranking._count.id,
    rank: index + 1
  }));
  
  return { list };
}

// 导出原有函数 + 新增函数
module.exports = {
  listBooks,
  searchBooks,
  getBookDetail,
  getBooksWithFilters,  
  getNewBooks,          
  getRanking            
};

