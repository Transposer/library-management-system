const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { formatDateTime, addDays } = require("../utils/date");

const DEFAULT_LOAN_DAYS = 30;
const OVERDUE_FINE_AMOUNT = 5;

async function syncOverdueLoansForUser(userId) {
  const now = new Date();

  await prisma.loan.updateMany({
    where: {
      userId,
      status: "Borrowing",
      returnDate: null,
      dueDate: { lt: now },
    },
    data: {
      status: "Overdue",
    },
  });
}
/**
 * 返回当前借阅
 * @param {} loan 
 * @returns 
 */
function toCurrentLoan(loan) {
  return {
    id: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.book.title,
    bookAuthor: loan.book.author,
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
    renewalCount: loan.renewalCount || 0,
    status: loan.status,
  };
}
/**
 * 返回历史借阅
 * @param {} loan 
 * @returns 
 */
function toHistoryLoan(loan) {
  return {
    id: loan.id,
    bookId: loan.book?.id || loan.bookId || null,
    bookTitle: loan.book?.title || "该图书已下架",
    bookAuthor: loan.book?.author || "-",
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
    returnDate: loan.returnDate ? formatDateTime(loan.returnDate) : null,
    status: loan.status,
    fineAmount: Number(loan.fineAmount),
    finePaid: loan.finePaid,
    fineForgiven: loan.fineForgiven,
  };
}

async function ensureNoUnpaidFines(
  userId,
  message = "该书当前不可借或您有未缴清罚款",
) {
  const unpaidFineLoan = await prisma.loan.findFirst({
    where: {
      userId,
      fineAmount: { gt: 0 },
      finePaid: false,
      fineForgiven: false,
    },
  });

  if (unpaidFineLoan) {
    throw new AppError(400, message);
  }
}

async function getCurrentLoans(userId) {
  await syncOverdueLoansForUser(userId);

  const loans = await prisma.loan.findMany({
    where: {
      userId,
      status: {
        in: ["Borrowing", "Overdue"],
      },
    },
    include: {
      book: true,
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  return {
    list: loans.map(toCurrentLoan),
  };
}

async function getHistoryLoans(userId, page = 1, size = 10) {
  await syncOverdueLoansForUser(userId);

  const skip = (page - 1) * size;
  
  const [loans, totalCount] = await Promise.all([
    prisma.loan.findMany({
      where: {
        userId,
      },
      include: {
        book: true,
      },
      orderBy: {
        checkoutDate: "desc",
      },
      skip,
      take: size,
    }),
    prisma.loan.count({
      where: {
        userId,
      },
    })
  ]);

  const totalPages = Math.ceil(totalCount / size);
  
  return {
    total: totalCount,
    page,
    size,
    totalPages,
    list: loans.map(toHistoryLoan),
  };
}

async function ensureBorrowAllowed(userId, bookId) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new AppError(404, "图书不存在");
  }

  if (!book.available || book.availableCopies <= 0) {
    throw new AppError(400, "该书当前不可借或您有未缴清罚款");
  }

  await ensureNoUnpaidFines(userId);

  return book;
}

async function createLoan(userId, payload) {
  const { bookId } = payload || {};

  if (!bookId) {
    throw new AppError(400, "参数错误");
  }

  const book = await ensureBorrowAllowed(userId, bookId);
  const checkoutDate = new Date();
  const dueDate = addDays(checkoutDate, DEFAULT_LOAN_DAYS);

  const loan = await prisma.$transaction(async (tx) => {
    const createdLoan = await tx.loan.create({
      data: {
        userId,
        bookId: book.id,
        checkoutDate,
        dueDate,
        renewalCount: 0,
        status: "Borrowing",
      },
      include: {
        book: true,
      },
    });

    const nextAvailableCopies = book.availableCopies - 1;

    await tx.book.update({
      where: { id: book.id },
      data: {
        availableCopies: nextAvailableCopies,
        available: nextAvailableCopies > 0,
      },
    });

    return createdLoan;
  });

  return {
    loanId: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.book.title,
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
  };
}

async function renewLoan(userId, loanId) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      book: true,
    },
  });

  if (!loan) {
    throw new AppError(404, "借阅记录不存在");
  }

  if (loan.userId !== userId) {
    throw new AppError(404, "借阅记录不存在或非当前用户");
  }

  if (loan.status === "Returned") {
    throw new AppError(400, "仅借阅中的图书可续借");
  }

  if (loan.renewalCount >= 1) {
    throw new AppError(400, "已达续借次数上限");
  }

  const now = new Date();
  if (loan.status === "Overdue" || loan.dueDate < now) {
    throw new AppError(400, "已逾期的图书不可续借");
  }

  if (loan.status !== "Borrowing") {
    throw new AppError(400, "仅借阅中的图书可续借");
  }

  await ensureNoUnpaidFines(userId, "您有未缴清罚款，不可续借");

  const otherHold = await prisma.hold.findFirst({
    where: {
      bookId: loan.bookId,
      userId: { not: userId },
      status: { in: ["WAITING", "READY"] },
    },
  });

  if (otherHold) {
    throw new AppError(400, "该书已被其他读者预约，不可续借");
  }

  const newDueDate = addDays(loan.dueDate, 30);
  const updatedLoan = await prisma.loan.update({
    where: { id: loanId },
    data: {
      dueDate: newDueDate,
      renewalCount: loan.renewalCount + 1,
    },
  });

  return {
    id: updatedLoan.id,
    dueDate: formatDateTime(updatedLoan.dueDate),
    renewalCount: updatedLoan.renewalCount,
  };
}

async function returnLoan(userId, loanId) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      book: true,
    },
  });

  if (!loan || loan.userId !== userId) {
    throw new AppError(404, "借阅记录不存在或非当前用户");
  }

  if (loan.status === "Returned" || loan.returnDate) {
    throw new AppError(400, "该借阅记录已归还");
  }

  if (!loan.book) {
    throw new AppError(404, "图书不存在");
  }

  const now = new Date();
  const fineAmount = loan.dueDate < now ? OVERDUE_FINE_AMOUNT : 0;

  const updatedLoan = await prisma.$transaction(async (tx) => {
    const returnedLoan = await tx.loan.update({
      where: { id: loanId },
      data: {
        returnDate: now,
        status: "Returned",
        fineAmount,
        finePaid: fineAmount === 0,
      },
      include: {
        book: true,
      },
    });

    const nextAvailableCopies = returnedLoan.book.availableCopies + 1;

    await tx.book.update({
      where: { id: returnedLoan.bookId },
      data: {
        availableCopies: nextAvailableCopies,
        available: true,
      },
    });

    return returnedLoan;
  });

  return {
    id: updatedLoan.id,
    bookId: updatedLoan.bookId,
    bookTitle: updatedLoan.book.title,
    returnDate: formatDateTime(updatedLoan.returnDate),
    status: updatedLoan.status,
    fineAmount: Number(updatedLoan.fineAmount),
  };
}

async function payFine(userId, loanId, payload) {
  const amountInput = payload?.amount;

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan || loan.userId !== userId) {
      throw new AppError(404, "借阅记录不存在或非当前用户");
    }

    const fineAmount = Number(loan.fineAmount);
    if (fineAmount <= 0 || loan.finePaid || loan.fineForgiven) {
      throw new AppError(400, "该笔借阅无待缴罚款或金额不足");
    }

    if (amountInput !== undefined) {
      const amount = Number(amountInput);
      if (!Number.isFinite(amount) || amount !== fineAmount) {
        throw new AppError(400, "该笔借阅无待缴罚款或金额不足");
      }
    }

    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: {
        finePaid: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "PAY_FINE",
        entity: "Loan",
        entityId: loanId,
        detail: JSON.stringify({
          amount: fineAmount,
          method: "SIMULATED",
        }),
      },
    });

    return {
      loanId: updatedLoan.id,
      fineAmount: Number(updatedLoan.fineAmount),
      finePaid: updatedLoan.finePaid,
    };
  });
}

module.exports = {
  getCurrentLoans,
  createLoan,
  getHistoryLoans,
  renewLoan,
  returnLoan,
  payFine,
  payFine,
};
