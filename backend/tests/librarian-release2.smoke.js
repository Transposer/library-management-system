const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
let librarianToken;
let borrowerId;
const createdBookIds = [];
const createdLoanIds = [];
const createdUserIds = [];
const uniqueSuffix = Date.now();

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

async function loginByEmail(email, password) {
  return request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: email,
      password,
    }),
  });
}

async function cleanup() {
  if (createdLoanIds.length) {
    await prisma.loan.deleteMany({
      where: {
        id: {
          in: createdLoanIds,
        },
      },
    });
  }

  if (createdBookIds.length) {
    await prisma.book.deleteMany({
      where: {
        id: {
          in: createdBookIds,
        },
      },
    });
  }

  if (createdUserIds.length) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdUserIds,
        },
      },
    });
  }

  await prisma.$disconnect();

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main() {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  const checkoutBook = await prisma.book.create({
    data: {
      title: `Librarian Release2 Checkout ${uniqueSuffix}`,
      author: "Codex Librarian",
      isbn: `978${String(uniqueSuffix).slice(-10)}`,
      genre: "Technology",
      language: "English",
      shelfLocation: "LIB-R2-001",
      available: true,
      availableCopies: 1,
    },
  });
  createdBookIds.push(checkoutBook.id);
  const checkoutBookCopy = await prisma.bookCopy.create({
    data: {
      bookId: checkoutBook.id,
      barcode: `BC${String(uniqueSuffix).slice(-9)}`,
      shelfLocation: "LIB-R2-001",
      available: true,
    },
  });

  const unavailableBook = await prisma.book.create({
    data: {
      title: `Librarian Release2 Unavailable ${uniqueSuffix}`,
      author: "Codex Librarian",
      isbn: `librarian-r2-unavailable-${uniqueSuffix}`,
      genre: "Technology",
      language: "English",
      shelfLocation: "LIB-R2-002",
      available: false,
      availableCopies: 0,
    },
  });
  createdBookIds.push(unavailableBook.id);

  const fineBook = await prisma.book.create({
    data: {
      title: `Librarian Release2 Fine ${uniqueSuffix}`,
      author: "Codex Librarian",
      isbn: `librarian-r2-fine-${uniqueSuffix}`,
      genre: "Science",
      language: "English",
      shelfLocation: "LIB-R2-003",
      available: true,
      availableCopies: 1,
    },
  });
  createdBookIds.push(fineBook.id);

  const borrowerEmail = `librarian.release2.student.${uniqueSuffix}@example.com`;
  const registerBorrower = await request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Librarian Release2 Borrower",
      email: borrowerEmail,
      password: "student123",
      studentId: `LR2${uniqueSuffix}`,
    }),
  });
  assert.equal(registerBorrower.response.status, 200);
  borrowerId = registerBorrower.body.data.userId;
  createdUserIds.push(borrowerId);

  const librarianLogin = await loginByEmail("librarian@library.com", "lib123");
  assert.equal(librarianLogin.response.status, 200);
  librarianToken = librarianLogin.body.data.token;

  const isbnSearch = await request(
    `/api/librarian/books?keyword=${encodeURIComponent(checkoutBook.isbn)}&type=isbn`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(isbnSearch.response.status, 200);
  assert.equal(isbnSearch.body.data.total, 1);
  assert.equal(isbnSearch.body.data.list[0].id, checkoutBook.id);
  assert.equal(isbnSearch.body.data.list[0].displayStatus, "AVAILABLE");
  assert.equal(isbnSearch.body.data.list[0].borrowedCopies, 0);

  const unavailableBookStatus = await request(
    `/api/librarian/books?keyword=${encodeURIComponent(unavailableBook.isbn)}&type=isbn`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(unavailableBookStatus.response.status, 200);
  assert.equal(unavailableBookStatus.body.data.list[0].id, unavailableBook.id);
  assert.equal(unavailableBookStatus.body.data.list[0].displayStatus, "UNAVAILABLE");
  assert.equal(unavailableBookStatus.body.data.list[0].borrowedCopies, 0);

  const isbnSearchMiss = await request(
    `/api/librarian/books?keyword=${encodeURIComponent(`missing-isbn-${uniqueSuffix}`)}&type=isbn`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(isbnSearchMiss.response.status, 200);
  assert.equal(isbnSearchMiss.body.data.total, 0);
  assert.deepEqual(isbnSearchMiss.body.data.list, []);

  const scanByIsbn = await request(
    `/api/librarian/books/scan?isbn=${encodeURIComponent(checkoutBook.isbn)}`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(scanByIsbn.response.status, 200);
  assert.equal(scanByIsbn.body.data.id, checkoutBook.id);

  const scanByBarcode = await request(
    `/api/librarian/books/scan?isbn=${encodeURIComponent(checkoutBookCopy.barcode)}`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(scanByBarcode.response.status, 200);
  assert.equal(scanByBarcode.body.data.id, checkoutBook.id);

  const scanMiss = await request(
    `/api/librarian/books/scan?isbn=${encodeURIComponent(`MISS${String(uniqueSuffix).slice(-8)}`)}`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(scanMiss.response.status, 404);

  const invalidUserCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: "missing-user-id",
      bookId: checkoutBook.id,
    }),
  });
  assert.equal(invalidUserCheckout.response.status, 404);
  assert.equal(invalidUserCheckout.body.message, "User not found");

  const invalidBookCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: "missing-book-id",
    }),
  });
  assert.equal(invalidBookCheckout.response.status, 404);
  assert.equal(invalidBookCheckout.body.message, "Book not found");

  const unavailableCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: unavailableBook.id,
    }),
  });
  assert.equal(unavailableCheckout.response.status, 400);
  assert.equal(unavailableCheckout.body.message, "Book is not available for checkout");

  const checkoutResult = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookIdOrIsbn: checkoutBook.isbn,
    }),
  });
  assert.equal(checkoutResult.response.status, 200);
  assert.equal(checkoutResult.body.message, "Checkout successful");
  assert.equal(checkoutResult.body.data.userId, borrowerId);
  assert.equal(checkoutResult.body.data.bookId, checkoutBook.id);
  const checkoutLoanId = checkoutResult.body.data.loanId;
  createdLoanIds.push(checkoutLoanId);

  const borrowedCheckoutBook = await prisma.book.findUnique({
    where: { id: checkoutBook.id },
  });
  assert.equal(borrowedCheckoutBook.availableCopies, 0);
  assert.equal(borrowedCheckoutBook.available, false);

  const borrowedBookStatus = await request(
    `/api/librarian/books?keyword=${encodeURIComponent(checkoutBook.isbn)}&type=isbn`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(borrowedBookStatus.response.status, 200);
  assert.equal(borrowedBookStatus.body.data.list[0].displayStatus, "BORROWED");
  assert.equal(borrowedBookStatus.body.data.list[0].borrowedCopies, 1);

  const loanList = await request("/api/librarian/loans", {
    headers: {
      Authorization: `Bearer ${librarianToken}`,
    },
  });
  assert.equal(loanList.response.status, 200);
  assert.ok(
    loanList.body.data.list.some(
      (loan) => loan.id === checkoutLoanId && loan.userId === borrowerId && loan.bookId === checkoutBook.id,
    ),
  );

  const returnResult = await request("/api/librarian/loans/return", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      loanId: checkoutLoanId,
    }),
  });
  assert.equal(returnResult.response.status, 200);
  assert.equal(returnResult.body.message, "Return successful");
  assert.equal(returnResult.body.data.fineAmount, 0);

  const returnedCheckoutBook = await prisma.book.findUnique({
    where: { id: checkoutBook.id },
  });
  assert.equal(returnedCheckoutBook.availableCopies, 1);
  assert.equal(returnedCheckoutBook.available, true);

  const returnedBookStatus = await request(
    `/api/librarian/books?keyword=${encodeURIComponent(checkoutBook.isbn)}&type=isbn`,
    {
      headers: {
        Authorization: `Bearer ${librarianToken}`,
      },
    },
  );
  assert.equal(returnedBookStatus.response.status, 200);
  assert.equal(returnedBookStatus.body.data.list[0].displayStatus, "AVAILABLE");
  assert.equal(returnedBookStatus.body.data.list[0].borrowedCopies, 0);

  const duplicateReturn = await request("/api/librarian/loans/return", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      loanId: checkoutLoanId,
    }),
  });
  assert.equal(duplicateReturn.response.status, 400);
  assert.equal(duplicateReturn.body.message, "This loan record has already been returned");

  const fineCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: fineBook.id,
    }),
  });
  assert.equal(fineCheckout.response.status, 200);
  const fineLoanId = fineCheckout.body.data.loanId;
  createdLoanIds.push(fineLoanId);

  await prisma.loan.update({
    where: { id: fineLoanId },
    data: {
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  const overdueReturn = await request("/api/librarian/loans/return", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      loanId: fineLoanId,
    }),
  });
  assert.equal(overdueReturn.response.status, 200);
  assert.equal(overdueReturn.body.data.fineAmount, 5);

  const fineDashboard = await request("/api/librarian/fine-dashboard", {
    headers: {
      Authorization: `Bearer ${librarianToken}`,
    },
  });
  assert.equal(fineDashboard.response.status, 200);
  assert.ok(fineDashboard.body.data.totalBooks >= fineDashboard.body.data.booksInLibrary);
  assert.ok(fineDashboard.body.data.booksInLibrary >= 2);
  assert.equal(typeof fineDashboard.body.data.checkedOutBooks, "number");
  assert.ok(fineDashboard.body.data.unpaidFineTotal >= 5);
  assert.ok(fineDashboard.body.data.fineDueToday >= 5);
  assert.ok(
    fineDashboard.body.data.fineItems.some(
      (item) =>
        item.loanId === fineLoanId &&
        item.userId === borrowerId &&
        item.fineAmount === 5,
    ),
  );

  const blockedCheckout = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: checkoutBook.id,
    }),
  });
  assert.equal(blockedCheckout.response.status, 400);
  assert.equal(blockedCheckout.body.message, "User has unpaid fines");

  const alipayFine = await request(`/api/librarian/loans/${fineLoanId}/pay-fine`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 5,
      method: "ALIPAY",
      authCode: "281234567890123456",
    }),
  });
  assert.equal(alipayFine.response.status, 200);
  assert.equal(alipayFine.body.message, "Fine paid successfully via Alipay");
  assert.equal(alipayFine.body.data.finePaid, true);
  assert.equal(alipayFine.body.data.paymentMethod, "ALIPAY");
  assert.ok(alipayFine.body.data.outTradeNo.startsWith("FINE-"));
  assert.ok(alipayFine.body.data.alipayTradeNo.startsWith("ALI"));

  const paidFineLoan = await prisma.loan.findUnique({
    where: { id: fineLoanId },
  });
  assert.equal(paidFineLoan.finePaid, true);

  const alipayAuditLog = await prisma.auditLog.findFirst({
    where: {
      userId: librarianLogin.body.data.userId,
      action: "PAY_FINE",
      entity: "Loan",
      entityId: fineLoanId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  assert.ok(alipayAuditLog);
  assert.equal(JSON.parse(alipayAuditLog.detail).method, "ALIPAY");

  const fineDashboardAfterAlipay = await request("/api/librarian/fine-dashboard", {
    headers: {
      Authorization: `Bearer ${librarianToken}`,
    },
  });
  assert.equal(fineDashboardAfterAlipay.response.status, 200);
  assert.ok(fineDashboardAfterAlipay.body.data.paidFineTotal >= 5);
  assert.ok(fineDashboardAfterAlipay.body.data.paidThisWeek >= 5);
  assert.ok(fineDashboardAfterAlipay.body.data.paidThisYear >= 5);
  assert.ok(
    fineDashboardAfterAlipay.body.data.paidFineItems.some(
      (item) =>
        item.loanId === fineLoanId &&
        item.userId === borrowerId &&
        item.paidAmount === 5,
    ),
  );
  assert.ok(
    !fineDashboardAfterAlipay.body.data.fineItems.some((item) => item.loanId === fineLoanId),
  );

  const checkoutAfterAlipay = await request("/api/librarian/loans/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${librarianToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: borrowerId,
      bookId: checkoutBook.id,
    }),
  });
  assert.equal(checkoutAfterAlipay.response.status, 200);
  createdLoanIds.push(checkoutAfterAlipay.body.data.loanId);

  console.log("Librarian Release2 smoke test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
