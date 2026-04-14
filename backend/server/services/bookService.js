const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");

function parsePagination(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "Invalid parameters");
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
    throw new AppError(400, "Missing keyword or invalid parameters");
  }

  if (type && !["title", "author"].includes(type)) {
    throw new AppError(400, "Invalid parameters");
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
    throw new AppError(404, "Book not found");
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

// Added book list retrieval with filtering, sorting, and pagination.
function normalizeBookLanguage(language) {
  if (!language || typeof language !== 'string') {
    return null;
  }

  const normalized = language.trim().toLowerCase();
  if (['english', 'en'].includes(normalized)) {
    return 'English';
  }
  if (['chinese', 'zh', '中文'].includes(normalized)) {
    return 'Chinese';
  }
  if (['spanish', 'french', 'others', 'other'].includes(normalized)) {
    return 'Others';
  }
  return null;
}

async function getBooksWithFilters(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);
  
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "Invalid parameters");
  }
  
  const skip = (page - 1) * size;
  
  // Build filter conditions.
  let where = {};
  
  // Keyword search (title or author).
  if (query.keyword && typeof query.keyword === 'string') {
    where.OR = [
      { title: { contains: query.keyword } },
      { author: { contains: query.keyword } }
    ];
  }
  
  // Genre filter.
  if (query.genre) {
    where.genre = query.genre;
  }
  
  // Language filter.
  if (query.language) {
    const normalizedLanguage = normalizeBookLanguage(query.language);
    if (!normalizedLanguage) {
      throw new AppError(400, "Invalid language filter");
    }
    where.language = normalizedLanguage;
  }
  
  // Availability filter.
  if (query.available !== undefined) {
    where.available = query.available === 'true';
  }
  
  // Get total count and book list.
  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      skip,
      take: size,
      include: {
        ratings: true  // Include ratings to calculate average score.
      }
    })
  ]);
  
  // Get average rating (return directly if books is empty).
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
  
  // Format list.
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
  
  // Handle sorting in memory because ratings are computed.
  const sortBy = query.sortBy;
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  
  if (sortBy === 'rating') {
    list.sort((a, b) => sortOrder * ((a.averageRating || 0) - (b.averageRating || 0)));
  } else if (sortBy === 'createdAt') {
    list.sort((a, b) => sortOrder * (new Date(a.createdAt) - new Date(b.createdAt)));
  }
  // If no sorting is specified, keep the default order (already sorted by creation time descending in the database).
  
  return {
    total,
    page,
    size,
    list
  };
}

// Get new books announcement.
async function getNewBooks(query) {
  const page = Number(query.page || 1);
  const size = Number(query.size || 10);
  
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "Invalid parameters");
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

// Get loan ranking.
async function getRanking(query) {
  const period = query.period || 'month';
  const limit = Number(query.limit) || 10;
  
  // Calculate time range.
  const now = new Date();
  let startDate;
  if (period === 'week') {
    startDate = new Date(now.setDate(now.getDate() - 7));
  } else {
    startDate = new Date(now.setMonth(now.getMonth() - 1));
  }
  
  // Query loan records and aggregate.
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
  
  // Get book details.
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
    bookTitle: bookMap[ranking.bookId]?.title || 'Unknown',
    bookAuthor: bookMap[ranking.bookId]?.author || 'Unknown',
    loanCount: ranking._count.id,
    rank: index + 1
  }));
  
  return { list };
}

// Export original functions plus newly added functions.
module.exports = {
  listBooks,
  searchBooks,
  getBookDetail,
  getBooksWithFilters,  
  getNewBooks,          
  getRanking            
};

