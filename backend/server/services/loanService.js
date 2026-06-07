const prisma = require("../db/prisma");
const { AppError } = require("../lib/errors");
const { getLoanPolicy } = require("../config/loanPolicy");
const { formatDateTime, addDays, overdueWholeDays } = require("../utils/date");
const auditLogService = require("./auditLogService");
const ACTIVE_LOAN_STATUSES = ["Borrowing", "Overdue"];
const OVERDUE_FINE_AMOUNT = 5;

async function computeOverdueFineAmount(loan, returnDate) {
  const days = overdueWholeDays(loan.dueDate, returnDate);
  if (days <= 0) return 0;
  return OVERDUE_FINE_AMOUNT;
}

async function syncOverdueLoans(where = {}) {
  const now = new Date();

  await prisma.loan.updateMany({
    where: {
      status: "Borrowing",
      returnDate: null,
      dueDate: { lt: now },
      ...where,
    },
    data: {
      status: "Overdue",
      fineAmount: OVERDUE_FINE_AMOUNT,
    },
  });
}

async function syncOverdueLoansForUser(userId) {
  await syncOverdueLoans({ userId });
}
/**
 * Return current loans.
 * @param {} loan
 * @returns
 */
function toCurrentLoan(loan) {
  return {
    id: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.book.title,
    bookAuthor: loan.book.author,
    barcode: loan.bookCopy?.barcode || null,
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
    renewalCount: loan.renewalCount || 0,
    status: loan.status,
  };
}
/**
 * Return loan history.
 * @param {} loan
 * @returns
 */
function toHistoryLoan(loan) {
  return {
    id: loan.id,
    bookId: loan.book?.id || loan.bookId || null,
    bookTitle: loan.book?.title || "This book is no longer available",
    bookAuthor: loan.book?.author || "-",
    barcode: loan.bookCopy?.barcode || null,
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
    returnDate: loan.returnDate ? formatDateTime(loan.returnDate) : null,
    status: loan.status,
    fineAmount: Number(loan.fineAmount),
    finePaid: loan.finePaid,
    fineForgiven: loan.fineForgiven,
  };
}

function toLibrarianLoan(loan) {
  return {
    id: loan.id,
    userId: loan.userId,
    userName: loan.user?.name || "Unknown user",
    userEmail: loan.user?.email || "-",
    bookId: loan.bookId,
    bookTitle: loan.book?.title || "This book is no longer available",
    bookAuthor: loan.book?.author || "-",
    isbn: loan.book?.isbn || "-",
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
    returnDate: loan.returnDate ? formatDateTime(loan.returnDate) : null,
    status: loan.status,
    fineAmount: Number(loan.fineAmount),
  };
}

async function ensureNoUnpaidFines(
  userId,
  message = "This book is currently unavailable, or you have unpaid fines",
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

async function ensureUserExists(userId) {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";

  if (!normalizedUserId) {
    throw new AppError(400, "User ID is required");
  }

  const user = await prisma.user.findUnique({
    where: { id: normalizedUserId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
}

async function findBookByIdentifier(payload) {
  const bookId = typeof payload?.bookId === "string" ? payload.bookId.trim() : "";
  const isbn = typeof payload?.isbn === "string" ? payload.isbn.trim() : "";
  const bookIdOrIsbn =
    typeof payload?.bookIdOrIsbn === "string" ? payload.bookIdOrIsbn.trim() : "";

  if (bookId) {
    return prisma.book.findUnique({
      where: { id: bookId },
    });
  }

  if (isbn) {
    return prisma.book.findUnique({
      where: { isbn },
    });
  }

  if (bookIdOrIsbn) {
    const bookById = await prisma.book.findUnique({
      where: { id: bookIdOrIsbn },
    });

    if (bookById) {
      return bookById;
    }

    return prisma.book.findUnique({
      where: { isbn: bookIdOrIsbn },
    });
  }

  return null;
}

async function ensureBorrowAllowed(
  userId,
  payload,
  options = {},
) {
  const {
    missingBookMessage = "Book not found",
    unavailableMessage = "This book is currently unavailable, or you have unpaid fines",
    unpaidFineMessage = "This book is currently unavailable, or you have unpaid fines",
  } = options;

  const book = await findBookByIdentifier(payload);

  if (!book) {
    throw new AppError(404, missingBookMessage);
  }

  if (!book.available || book.availableCopies <= 0) {
    throw new AppError(400, unavailableMessage);
  }

  await ensureNoUnpaidFines(userId, unpaidFineMessage);

  return book;
}

async function createLoanRecord({ userId, book, actorUserId, action, detail }) {
  const checkoutDate = new Date();
  const { maxDays } = await getLoanPolicy();
  const dueDate = addDays(checkoutDate, maxDays);
  const nextAvailableCopies = book.availableCopies - 1;

  const availableCopy = await prisma.bookCopy.findFirst({
    where: { bookId: book.id, available: true },
  });

  const loan = await prisma.$transaction(async (tx) => {
    const createdLoan = await tx.loan.create({
      data: {
        userId,
        bookId: book.id,
        bookCopyId: availableCopy?.id || null,
        checkoutDate,
        dueDate,
        renewalCount: 0,
        status: "Borrowing",
      },
      include: {
        book: true,
        user: true,
        bookCopy: true,
      },
    });

    if (availableCopy) {
      await tx.bookCopy.update({
        where: { id: availableCopy.id },
        data: { available: false },
      });
    }

    await tx.book.update({
      where: { id: book.id },
      data: {
        availableCopies: nextAvailableCopies,
        available: nextAvailableCopies > 0,
      },
    });

    if (actorUserId && action) {
      await auditLogService.recordWithClient(
        tx,
        actorUserId,
        action,
        "Loan",
        createdLoan.id,
        detail || null,
      );
    }

    return createdLoan;
  });

  return {
    loan,
    nextAvailableCopies,
  };
}

async function finalizeLoanReturn(loan, actorUserId, action, detail) {
  const now = new Date();
  const computedFine = await computeOverdueFineAmount(loan, now);
  const existingFine = Number(loan.fineAmount) || 0;
  const fineAmount = Math.max(existingFine, computedFine);
  const nextAvailableCopies = loan.book.availableCopies + 1;

  const updatedLoan = await prisma.$transaction(async (tx) => {
    const returnedLoan = await tx.loan.update({
      where: { id: loan.id },
      data: {
        returnDate: now,
        status: "Returned",
        fineAmount,
        finePaid: loan.finePaid || fineAmount === 0,
      },
      include: {
        book: true,
        user: true,
      },
    });

    if (loan.bookCopyId) {
      await tx.bookCopy.update({
        where: { id: loan.bookCopyId },
        data: { available: true },
      });
    }

    await tx.book.update({
      where: { id: loan.bookId },
      data: {
        availableCopies: nextAvailableCopies,
        available: true,
      },
    });

    if (actorUserId && action) {
      await auditLogService.recordWithClient(
        tx,
        actorUserId,
        action,
        "Loan",
        loan.id,
        detail || null,
      );
    }

    return returnedLoan;
  });

  return {
    loan: updatedLoan,
    nextAvailableCopies,
  };
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
      bookCopy: true,
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
        bookCopy: true,
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

async function getLibrarianLoans(query = {}) {
  await syncOverdueLoans();

  const page = Number(query.page || 1);
  const size = Number(query.size || 50);
  const status = typeof query.status === "string" ? query.status.trim() : "";
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : "";

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1) {
    throw new AppError(400, "Invalid pagination parameters");
  }

  const where = {};

  if (!status || status === "ACTIVE") {
    where.status = {
      in: ACTIVE_LOAN_STATUSES,
    };
  } else if (status !== "ALL") {
    where.status = status;
  }

  if (keyword) {
    where.OR = [
      { id: { contains: keyword } },
      { user: { name: { contains: keyword } } },
      { user: { email: { contains: keyword } } },
      { book: { title: { contains: keyword } } },
      { book: { isbn: { contains: keyword } } },
    ];
  }

  const skip = (page - 1) * size;

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      include: {
        book: true,
        user: true,
      },
      orderBy: [
        { dueDate: "asc" },
        { checkoutDate: "desc" },
      ],
      skip,
      take: size,
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    total,
    page,
    size,
    list: loans.map(toLibrarianLoan),
  };
}

async function createLoan(userId, payload) {
  const { bookId } = payload || {};

  if (!bookId) {
    throw new AppError(400, "Invalid parameters");
  }

  await syncOverdueLoansForUser(userId);

  const { maxBooks } = await getLoanPolicy();
  const activeLoanCount = await prisma.loan.count({
    where: {
      userId,
      returnDate: null,
      status: { in: ACTIVE_LOAN_STATUSES },
    },
  });

  if (activeLoanCount >= maxBooks) {
    const unit = maxBooks === 1 ? "book" : "books";
    throw new AppError(
      400,
      `You have reached the borrowing limit (${maxBooks} ${unit}). Please return some books before borrowing more.`,
    );
  }

  const book = await ensureBorrowAllowed(userId, { bookId });
  const { loan, nextAvailableCopies } = await createLoanRecord({
    userId,
    book,
    actorUserId: userId,
    action: "USER_BORROW",
    detail: {
      borrowerId: userId,
      bookId: book.id,
    },
  });

  return {
    loanId: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.book.title,
    barcode: loan.bookCopy?.barcode || null,
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
    availableCopies: nextAvailableCopies,
  };
}

async function librarianCheckoutLoan(payload, actorUserId) {
  const borrower = await ensureUserExists(payload?.userId);

  await syncOverdueLoansForUser(borrower.id);

  const { maxBooks } = await getLoanPolicy();
  const activeLoanCount = await prisma.loan.count({
    where: {
      userId: borrower.id,
      returnDate: null,
      status: { in: ACTIVE_LOAN_STATUSES },
    },
  });

  if (activeLoanCount >= maxBooks) {
    const unit = maxBooks === 1 ? "book" : "books";
    throw new AppError(
      400,
      `You have reached the borrowing limit (${maxBooks} ${unit}). Please return some books before borrowing more.`,
    );
  }

  const book = await ensureBorrowAllowed(
    borrower.id,
    payload,
    {
      missingBookMessage: "Book not found",
      unavailableMessage: "Book is not available for checkout",
      unpaidFineMessage: "User has unpaid fines",
    },
  );

  const { loan, nextAvailableCopies } = await createLoanRecord({
    userId: borrower.id,
    book,
    actorUserId,
    action: "LIBRARIAN_CHECKOUT",
    detail: {
      borrowerId: borrower.id,
      bookId: book.id,
      bookIdentifier: payload?.bookId || payload?.isbn || payload?.bookIdOrIsbn || book.id,
    },
  });

  return {
    loanId: loan.id,
    userId: borrower.id,
    userName: borrower.name,
    bookId: loan.bookId,
    bookTitle: loan.book.title,
    isbn: loan.book.isbn,
    checkoutDate: formatDateTime(loan.checkoutDate),
    dueDate: formatDateTime(loan.dueDate),
    availableCopies: nextAvailableCopies,
  };
}

async function renewLoan(userId, loanId) {
  await syncOverdueLoansForUser(userId);

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      book: true,
    },
  });

  if (!loan) {
    throw new AppError(404, "Loan record not found");
  }

  if (loan.userId !== userId) {
    throw new AppError(404, "Loan record not found or does not belong to the current user");
  }

  if (!["Borrowing", "Overdue"].includes(loan.status)) {
    throw new AppError(400, "Only borrowed books can be renewed");
  }

  if (loan.renewalCount >= 1) {
    throw new AppError(400, "Renewal limit reached");
  }

  const now = new Date();
  if (loan.status === "Overdue" || loan.dueDate < now) {
    throw new AppError(400, "Overdue books cannot be renewed");
  }

  if (loan.status !== "Borrowing") {
    throw new AppError(400, "Only borrowed books can be renewed");
  }

  await ensureNoUnpaidFines(userId, "You have unpaid fines and cannot renew");

  const otherHold = await prisma.hold.findFirst({
    where: {
      bookId: loan.bookId,
      userId: { not: userId },
      status: { in: ["WAITING", "READY"] },
    },
  });

  if (otherHold) {
    throw new AppError(400, "This book has been reserved by another reader and cannot be renewed");
  }

  const { maxDays } = await getLoanPolicy();
  const newDueDate = addDays(loan.dueDate, maxDays);
  const updatedLoan = await prisma.loan.update({
    where: { id: loanId },
    data: {
      dueDate: newDueDate,
      renewalCount: loan.renewalCount + 1,
    },
  });

  await auditLogService.record(userId, "USER_RENEW_LOAN", "Loan", loanId, {
    oldDueDate: formatDateTime(loan.dueDate),
    newDueDate: formatDateTime(updatedLoan.dueDate),
    renewalCount: updatedLoan.renewalCount,
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
      user: true,
      bookCopy: true,
    },
  });

  if (!loan || loan.userId !== userId) {
    throw new AppError(404, "Loan record not found or does not belong to the current user");
  }

  if (loan.status === "Returned" || loan.returnDate) {
    throw new AppError(400, "This loan record has already been returned");
  }

  if (!loan.book) {
    throw new AppError(404, "Book not found");
  }

  const now = new Date();
  const computedFine = await computeOverdueFineAmount(loan, now);
  const existingFine = Number(loan.fineAmount) || 0;
  const fineAmount = Math.max(existingFine, computedFine);
  let nextAvailableCopies;

  const updatedLoan = await prisma.$transaction(async (tx) => {
    const returnedLoan = await tx.loan.update({
      where: { id: loanId },
      data: {
        returnDate: now,
        status: "Returned",
        fineAmount,
        finePaid: loan.finePaid || fineAmount === 0,
      },
      include: {
        book: true,
        bookCopy: true,
      },
    });

    if (returnedLoan.bookCopyId) {
      await tx.bookCopy.update({
        where: { id: returnedLoan.bookCopyId },
        data: { available: true },
      });
    }

    nextAvailableCopies = returnedLoan.book.availableCopies + 1;

    await tx.book.update({
      where: { id: returnedLoan.bookId },
      data: {
        availableCopies: nextAvailableCopies,
        available: true,
      },
    });

    await auditLogService.recordWithClient(tx, userId, "USER_RETURN", "Loan", returnedLoan.id, {
      borrowerId: userId,
      bookId: returnedLoan.bookId,
      bookCopyId: returnedLoan.bookCopyId,
      fineAmount,
    });

    return returnedLoan;
  });

  return {
    id: updatedLoan.id,
    bookId: updatedLoan.bookId,
    bookTitle: updatedLoan.book.title,
    barcode: updatedLoan.bookCopy?.barcode || null,
    returnDate: formatDateTime(updatedLoan.returnDate),
    status: updatedLoan.status,
    fineAmount: Number(updatedLoan.fineAmount),
    availableCopies: nextAvailableCopies,
  };
}

async function librarianReturnLoan(payload, actorUserId) {
  const loanId = typeof payload?.loanId === "string" ? payload.loanId.trim() : "";

  if (!loanId) {
    throw new AppError(400, "Loan record ID is required");
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      book: true,
      user: true,
      bookCopy: true,
    },
  });

  if (!loan) {
    throw new AppError(404, "Loan record not found");
  }

  if (loan.status === "Returned" || loan.returnDate) {
    throw new AppError(400, "This loan record has already been returned");
  }

  if (!loan.book) {
    throw new AppError(404, "Book not found");
  }

  const { loan: updatedLoan, nextAvailableCopies } = await finalizeLoanReturn(
    loan,
    actorUserId,
    "LIBRARIAN_RETURN",
    JSON.stringify({
      borrowerId: loan.userId,
      bookId: loan.bookId,
      bookCopyId: loan.bookCopyId,
    }),
  );

  return {
    loanId: updatedLoan.id,
    userId: updatedLoan.userId,
    userName: updatedLoan.user?.name || "Unknown user",
    bookId: updatedLoan.bookId,
    bookTitle: updatedLoan.book.title,
    returnDate: formatDateTime(updatedLoan.returnDate),
    status: updatedLoan.status,
    fineAmount: Number(updatedLoan.fineAmount),
    availableCopies: nextAvailableCopies,
  };
}

async function returnLoanByBarcode(userId, barcode) {
  if (!barcode || typeof barcode !== "string" || !barcode.trim()) {
    throw new AppError(400, "Barcode is required");
  }

  const normalizedBarcode = barcode.trim();

  const bookCopy = await prisma.bookCopy.findUnique({
    where: { barcode: normalizedBarcode },
    include: { book: true },
  });

  if (!bookCopy) {
    throw new AppError(404, "No book copy found with this barcode");
  }

  const activeLoan = await prisma.loan.findFirst({
    where: {
      userId,
      bookCopyId: bookCopy.id,
      status: { in: ACTIVE_LOAN_STATUSES },
    },
    orderBy: { checkoutDate: "desc" },
  });

  if (!activeLoan) {
    throw new AppError(404, "No active loan found for this book copy. You may not have borrowed this copy, or it has already been returned.");
  }

  return returnLoan(userId, activeLoan.id);
}

async function payFine(userId, loanId, payload) {
  const amountInput = payload?.amount;

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan || loan.userId !== userId) {
      throw new AppError(404, "Loan record not found or does not belong to the current user");
    }

    const fineAmount = Number(loan.fineAmount);
    if (fineAmount <= 0 || loan.finePaid || loan.fineForgiven) {
      throw new AppError(400, "This loan has no payable fine, or the payment amount is insufficient");
    }

    if (amountInput !== undefined) {
      const amount = Number(amountInput);
      if (!Number.isFinite(amount) || amount !== fineAmount) {
        throw new AppError(400, "This loan has no payable fine, or the payment amount is insufficient");
      }
    }

    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: {
        finePaid: true,
      },
    });

    await auditLogService.recordWithClient(tx, userId, "PAY_FINE", "Loan", loanId, {
      amount: fineAmount,
      method: "SIMULATED",
    });

    return {
      loanId: updatedLoan.id,
      fineAmount: Number(updatedLoan.fineAmount),
      finePaid: updatedLoan.finePaid,
    };
  });
}

async function librarianPayFine(loanId, payload, actorUserId) {
  const amountInput = payload?.amount;
  const authCode = typeof payload?.authCode === "string" ? payload.authCode.trim() : "";
  const isSandboxAuthCode = !authCode || /^28\d{14,22}$/.test(authCode);

  if (!isSandboxAuthCode) {
    throw new AppError(400, "Invalid Alipay payment code");
  }

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        book: true,
        user: true,
      },
    });

    if (!loan) {
      throw new AppError(404, "Loan record not found");
    }

    const fineAmount = Number(loan.fineAmount);
    if (fineAmount <= 0 || loan.finePaid || loan.fineForgiven) {
      throw new AppError(400, "This loan has no payable fine, or the payment amount is insufficient");
    }

    if (amountInput !== undefined) {
      const amount = Number(amountInput);
      if (!Number.isFinite(amount) || amount !== fineAmount) {
        throw new AppError(400, "This loan has no payable fine, or the payment amount is insufficient");
      }
    }

    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: {
        finePaid: true,
      },
      include: {
        book: true,
        user: true,
      },
    });

    const outTradeNo = `FINE-${loanId}`;
    const alipayTradeNo = `ALI${Date.now()}${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;

    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: "PAY_FINE",
        entity: "Loan",
        entityId: loanId,
        detail: JSON.stringify({
          amount: fineAmount,
          method: "ALIPAY",
          borrowerId: loan.userId,
          confirmationMode: authCode ? "AUTH_CODE" : "QR_CONFIRMATION",
          ...(authCode ? { authCodeTail: authCode.slice(-4) } : {}),
          outTradeNo,
          alipayTradeNo,
        }),
      },
    });

    return {
      loanId: updatedLoan.id,
      userId: updatedLoan.userId,
      userName: updatedLoan.user?.name || "Unknown user",
      bookId: updatedLoan.bookId,
      bookTitle: updatedLoan.book?.title || "This book is no longer available",
      fineAmount: Number(updatedLoan.fineAmount),
      finePaid: updatedLoan.finePaid,
      paymentMethod: "ALIPAY",
      outTradeNo,
      alipayTradeNo,
    };
  });
}

module.exports = {
  getCurrentLoans,
  createLoan,
  getHistoryLoans,
  getLibrarianLoans,
  librarianCheckoutLoan,
  renewLoan,
  returnLoan,
  librarianReturnLoan,
  returnLoanByBarcode,
  payFine,
  librarianPayFine,
};
