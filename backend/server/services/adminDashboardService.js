const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime } = require("../utils/date");

const VALID_PERIODS = new Set(["7d", "30d", "90d"]);
const PERIOD_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizePeriod(period) {
  const value = period || "30d";
  if (!VALID_PERIODS.has(value)) {
    throw new AppError(400, "Invalid parameters: period must be 7d, 30d, or 90d");
  }
  return value;
}

function normalizeLimit(value, defaultValue, maxValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxValue) {
    throw new AppError(400, `Invalid parameters: limit must be an integer between 1 and ${maxValue}`);
  }

  return limit;
}

function buildDailySeries(days) {
  const today = startOfDay();
  const series = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    series.push({
      date: formatDateKey(date),
      checkouts: 0,
      returns: 0,
    });
  }

  return series;
}

async function getOverviewStats() {
  const todayStart = startOfDay();
  const monthStart = startOfMonth();
  const now = new Date();

  const [
    totalUsers,
    students,
    librarians,
    admins,
    totalBooks,
    booksAggregate,
    activeLoans,
    overdueLoans,
    todayCheckouts,
    todayReturns,
    pendingHolds,
    readyHolds,
    unpaidFinesAggregate,
    monthRevenueAggregate,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "LIBRARIAN" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.book.count(),
    prisma.book.aggregate({
      _sum: { availableCopies: true },
    }),
    prisma.loan.count({
      where: { status: { in: ["Borrowing", "Overdue"] } },
    }),
    prisma.loan.count({
      where: {
        OR: [
          { status: "Overdue" },
          {
            status: "Borrowing",
            returnDate: null,
            dueDate: { lt: now },
          },
        ],
      },
    }),
    prisma.loan.count({
      where: { checkoutDate: { gte: todayStart } },
    }),
    prisma.loan.count({
      where: { returnDate: { gte: todayStart } },
    }),
    prisma.hold.count({ where: { status: "WAITING" } }),
    prisma.hold.count({ where: { status: "READY" } }),
    prisma.loan.aggregate({
      where: {
        fineAmount: { gt: 0 },
        finePaid: false,
        fineForgiven: false,
      },
      _sum: { fineAmount: true },
    }),
    prisma.loan.aggregate({
      where: {
        finePaid: true,
        fineAmount: { gt: 0 },
        returnDate: { gte: monthStart },
      },
      _sum: { fineAmount: true },
    }),
  ]);

  const availableBooks = booksAggregate._sum.availableCopies || 0;
  const borrowedBooks = Math.max(activeLoans, 0);

  return {
    totalUsers,
    totalBooks,
    availableBooks,
    borrowedBooks,
    activeLoans,
    overdueLoans,
    todayCheckouts,
    todayReturns,
    pendingHolds,
    readyHolds,
    totalFinesUnpaid: Number(unpaidFinesAggregate._sum.fineAmount || 0),
    monthRevenue: Number(monthRevenueAggregate._sum.fineAmount || 0),
    usersByRole: {
      students,
      librarians,
      admins,
    },
  };
}

async function getLoanTrends(period) {
  const normalizedPeriod = normalizePeriod(period);
  const days = PERIOD_DAYS[normalizedPeriod];
  const todayStart = startOfDay();
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));

  const dailyMap = new Map(
    buildDailySeries(days).map((item) => [item.date, { ...item }]),
  );

  const loans = await prisma.loan.findMany({
    where: {
      OR: [
        { checkoutDate: { gte: rangeStart } },
        { returnDate: { gte: rangeStart } },
      ],
    },
    select: {
      checkoutDate: true,
      returnDate: true,
    },
  });

  loans.forEach((loan) => {
    if (loan.checkoutDate >= rangeStart) {
      const checkoutKey = formatDateKey(loan.checkoutDate);
      const checkoutBucket = dailyMap.get(checkoutKey);
      if (checkoutBucket) {
        checkoutBucket.checkouts += 1;
      }
    }

    if (loan.returnDate && loan.returnDate >= rangeStart) {
      const returnKey = formatDateKey(loan.returnDate);
      const returnBucket = dailyMap.get(returnKey);
      if (returnBucket) {
        returnBucket.returns += 1;
      }
    }
  });

  return {
    period: normalizedPeriod,
    daily: Array.from(dailyMap.values()),
  };
}

async function getPopularBooks(limit = 10) {
  const normalizedLimit = normalizeLimit(limit, 10, 50);

  const rows = await prisma.$queryRaw`
    SELECT
      l.bookId AS bookId,
      b.title AS title,
      b.author AS author,
      b.isbn AS isbn,
      COUNT(l.id) AS loanCount
    FROM "Loan" l
    INNER JOIN "Book" b ON b.id = l.bookId
    GROUP BY l.bookId, b.title, b.author, b.isbn
    ORDER BY loanCount DESC, b.title ASC, l.bookId ASC
    LIMIT ${normalizedLimit}
  `;

  return {
    list: rows.map((row, index) => ({
      rank: index + 1,
      bookId: row.bookId,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      loanCount: Number(row.loanCount),
    })),
  };
}

async function getRecentActivities(limit = 20) {
  const normalizedLimit = normalizeLimit(limit, 20, 100);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: normalizedLimit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return {
    list: logs.map((log) => ({
      id: log.id,
      operator: log.user ? log.user.name : "System",
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      createdAt: formatDateTime(log.createdAt),
    })),
  };
}

// ── Report helpers ──────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function normalizeMonth(month) {
  const value = (month || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new AppError(400, "Invalid month format. Use YYYY-MM");
  }
  const [y, m] = value.split("-").map(Number);
  const now = new Date();
  const target = new Date(y, m - 1, 1);
  if (target > now) {
    throw new AppError(400, "Month cannot be in the future");
  }
  return { year: y, month: m, key: value };
}

function buildMonthDailySeries(year, month) {
  const days = getDaysInMonth(year, month);
  const series = [];
  for (let d = 1; d <= days; d += 1) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    series.push({ date: `${year}-${mm}-${dd}`, checkouts: 0, returns: 0 });
  }
  return series;
}

// ── Report queries ──────────────────────────────────────────────

async function getMonthlyBorrowingReport(month) {
  const { year, month: mon, key } = normalizeMonth(month || "");
  const rangeStart = new Date(year, mon - 1, 1);
  const rangeEnd = new Date(year, mon, 1);

  const loans = await prisma.loan.findMany({
    where: {
      OR: [
        { checkoutDate: { gte: rangeStart, lt: rangeEnd } },
        { returnDate: { gte: rangeStart, lt: rangeEnd } },
      ],
    },
    select: { checkoutDate: true, returnDate: true, bookId: true },
  });

  const dailyMap = new Map(
    buildMonthDailySeries(year, mon).map((item) => [item.date, { ...item }]),
  );

  const bookCounts = new Map();
  let totalCheckouts = 0;
  let totalReturns = 0;

  loans.forEach((loan) => {
    if (loan.checkoutDate >= rangeStart && loan.checkoutDate < rangeEnd) {
      totalCheckouts += 1;
      const key = formatDateKey(loan.checkoutDate);
      const bucket = dailyMap.get(key);
      if (bucket) bucket.checkouts += 1;
    }
    if (loan.returnDate && loan.returnDate >= rangeStart && loan.returnDate < rangeEnd) {
      totalReturns += 1;
      const key = formatDateKey(loan.returnDate);
      const bucket = dailyMap.get(key);
      if (bucket) bucket.returns += 1;
    }
    if (loan.checkoutDate >= rangeStart && loan.checkoutDate < rangeEnd) {
      bookCounts.set(loan.bookId, (bookCounts.get(loan.bookId) || 0) + 1);
    }
  });

  const sortedBooks = Array.from(bookCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const bookIds = sortedBooks.map(([id]) => id);
  const books = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    select: { id: true, title: true, author: true },
  });
  const bookMap = new Map(books.map((b) => [b.id, b]));

  const topBooks = sortedBooks.map(([id, count], i) => {
    const book = bookMap.get(id) || {};
    return { rank: i + 1, bookId: id, title: book.title || "Unknown", author: book.author || "Unknown", loanCount: count };
  });

  const borrowerIds = new Set();
  loans.forEach((loan) => {
    if (loan.checkoutDate >= rangeStart && loan.checkoutDate < rangeEnd) {
      borrowerIds.add(loan.bookId);
    }
  });

  return {
    month: key,
    summary: {
      totalCheckouts,
      totalReturns,
      netBorrowed: totalCheckouts - totalReturns,
      activeBorrowers: borrowerIds.size,
    },
    dailyTrends: Array.from(dailyMap.values()),
    topBooks,
  };
}

async function getOverdueStatsReport(month) {
  const { year, month: mon, key } = normalizeMonth(month || "");
  const rangeStart = new Date(year, mon - 1, 1);
  const rangeEnd = new Date(year, mon, 1);

  const loans = await prisma.loan.findMany({
    where: {
      OR: [
        { status: "Overdue" },
        {
          status: { in: ["Returned"] },
          dueDate: { lt: rangeEnd },
          returnDate: { gte: rangeStart, lt: rangeEnd },
        },
      ],
      dueDate: { lt: rangeEnd },
    },
    select: { id: true, bookId: true, dueDate: true, returnDate: true, checkoutDate: true, fineAmount: true, finePaid: true },
  });

  const totalCheckouts = await prisma.loan.count({
    where: { checkoutDate: { gte: rangeStart, lt: rangeEnd } },
  });

  let overdueCount = 0;
  let totalFines = 0;
  let collectedFines = 0;
  let overdueDaysSum = 0;
  let overdueReturned = 0;
  const bookOverdues = new Map();
  const byDayMap = new Map();

  loans.forEach((loan) => {
    const dueDate = new Date(loan.dueDate);
    if (loan.status === "Overdue" || (loan.returnDate && new Date(loan.returnDate) > dueDate)) {
      overdueCount += 1;
      const overdueDays = loan.returnDate
        ? Math.max(0, Math.ceil((new Date(loan.returnDate) - dueDate) / (1000 * 60 * 60 * 24)))
        : Math.max(0, Math.ceil((rangeEnd - dueDate) / (1000 * 60 * 60 * 24)));
      overdueDaysSum += overdueDays;

      if (loan.returnDate) overdueReturned += 1;

      if (loan.fineAmount > 0) {
        totalFines += Number(loan.fineAmount);
        if (loan.finePaid) collectedFines += Number(loan.fineAmount);
      }

      const dayKey = formatDateKey(dueDate);
      if (dueDate >= rangeStart) {
        byDayMap.set(dayKey, (byDayMap.get(dayKey) || 0) + 1);
      }

      const entry = bookOverdues.get(loan.bookId) || { overdueCount: 0, totalDays: 0 };
      entry.overdueCount += 1;
      entry.totalDays += overdueDays;
      bookOverdues.set(loan.bookId, entry);
    }
  });

  const sortedBooks = Array.from(bookOverdues.entries())
    .sort((a, b) => b[1].overdueCount - a[1].overdueCount)
    .slice(0, 10);

  const bookIds = sortedBooks.map(([id]) => id);
  const books = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    select: { id: true, title: true },
  });
  const bookMap = new Map(books.map((b) => [b.id, b]));

  const topOverdueBooks = sortedBooks.map(([id, data]) => {
    const book = bookMap.get(id) || {};
    return {
      bookId: id,
      title: book.title || "Unknown",
      overdueCount: data.overdueCount,
      avgDays: Math.round(data.totalDays / data.overdueCount),
    };
  });

  const byDayOverdue = Array.from(byDayMap.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    month: key,
    summary: {
      overdueCount,
      totalFines: Math.round(totalFines * 100) / 100,
      collectedFines: Math.round(collectedFines * 100) / 100,
      avgOverdueDays: overdueReturned > 0 ? Math.round((overdueDaysSum / overdueReturned) * 10) / 10 : 0,
      overdueRate: totalCheckouts > 0 ? Math.round((overdueCount / totalCheckouts) * 1000) / 10 : 0,
    },
    topOverdueBooks,
    byDayOverdue,
  };
}

async function getUsageSummaryReport(month) {
  const { year, month: mon, key } = normalizeMonth(month || "");
  const rangeStart = new Date(year, mon - 1, 1);
  const rangeEnd = new Date(year, mon, 1);

  const loans = await prisma.loan.findMany({
    where: {
      checkoutDate: { gte: rangeStart, lt: rangeEnd },
    },
    select: { userId: true, checkoutDate: true, returnDate: true },
  });

  const dailyMap = new Map(
    buildMonthDailySeries(year, mon).map((item) => [item.date, { date: item.date, checkouts: 0, returns: 0, activeUsers: 0 }]),
  );

  const userCheckouts = new Map();
  const dailyUsers = new Map();

  loans.forEach((loan) => {
    userCheckouts.set(loan.userId, (userCheckouts.get(loan.userId) || 0) + 1);

    if (loan.checkoutDate >= rangeStart && loan.checkoutDate < rangeEnd) {
      const key = formatDateKey(loan.checkoutDate);
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.checkouts += 1;
        if (!dailyUsers.has(key)) dailyUsers.set(key, new Set());
        dailyUsers.get(key).add(loan.userId);
      }
    }
    if (loan.returnDate && loan.returnDate >= rangeStart && loan.returnDate < rangeEnd) {
      const key = formatDateKey(loan.returnDate);
      const bucket = dailyMap.get(key);
      if (bucket) bucket.returns += 1;
    }
  });

  for (const [key, users] of dailyUsers.entries()) {
    const bucket = dailyMap.get(key);
    if (bucket) bucket.activeUsers = users.size;
  }

  const totalCheckouts = loans.length;
  const activeBorrowers = userCheckouts.size;
  const avgLoansPerUser = activeBorrowers > 0 ? Math.round((totalCheckouts / activeBorrowers) * 10) / 10 : 0;

  let peakDay = key;
  let peakCount = 0;
  for (const [day, bucket] of dailyMap.entries()) {
    if (bucket.checkouts > peakCount) {
      peakCount = bucket.checkouts;
      peakDay = day;
    }
  }

  const newUsers = await prisma.user.count({
    where: {
      role: "STUDENT",
      createdAt: { gte: rangeStart, lt: rangeEnd },
    },
  });

  const sortedUsers = Array.from(userCheckouts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const userIds = sortedUsers.map(([id]) => id);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const topBorrowers = sortedUsers.map(([id, count], i) => {
    const user = userMap.get(id) || {};
    return { rank: i + 1, userId: id, name: user.name || "Unknown", email: user.email || "", loanCount: count };
  });

  return {
    month: key,
    summary: {
      totalCheckouts,
      activeBorrowers,
      avgLoansPerUser,
      newUsers,
      peakDay,
      peakCount,
    },
    dailyActivity: Array.from(dailyMap.values()),
    topBorrowers,
  };
}

module.exports = {
  getOverviewStats,
  getLoanTrends,
  getPopularBooks,
  getRecentActivities,
  getMonthlyBorrowingReport,
  getOverdueStatsReport,
  getUsageSummaryReport,
};
