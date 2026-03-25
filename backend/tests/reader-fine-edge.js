const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
const createdBookIds = [];
const createdUserIds = [];
const uniqueSuffix = Date.now();

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

function authHeaders(token, extraHeaders = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
}

async function registerAndLogin(label) {
  const email = `reader.fine.${label}.${uniqueSuffix}@example.com`;
  const studentId = `${label.toUpperCase()}${uniqueSuffix}`;

  const registerResult = await request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Fine ${label}`,
      email,
      password: "reader123",
      studentId,
    }),
  });
  assert.equal(registerResult.response.status, 200);

  const userId = registerResult.body.data.userId;
  createdUserIds.push(userId);

  const loginResult = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: email,
      password: "reader123",
    }),
  });
  assert.equal(loginResult.response.status, 200);
  assert.ok(loginResult.body.data.token);

  return {
    email,
    token: loginResult.body.data.token,
    userId,
  };
}

async function createBook(label, availableCopies = 1) {
  const book = await prisma.book.create({
    data: {
      title: `Fine Edge ${label} ${uniqueSuffix}`,
      author: "Codex Reader",
      isbn: `fine-edge-${label}-${uniqueSuffix}`,
      genre: "Technology",
      cover: `/covers/fine-edge-${label}.jpg`,
      description: `Fine edge test book ${label}.`,
      language: "English",
      shelfLocation: `EDGE-${label.toUpperCase()}`,
      available: true,
      availableCopies,
    },
  });

  createdBookIds.push(book.id);
  return book;
}

async function borrowBook(token, bookId) {
  const result = await request("/api/loans", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ bookId }),
  });

  assert.equal(result.response.status, 200);
  return result.body.data.loanId;
}

async function returnLoan(token, loanId) {
  return request(`/api/loans/${loanId}/return`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

async function renewLoan(token, loanId) {
  return request(`/api/loans/${loanId}/renew`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

async function payFine(token, loanId, payload) {
  return request(`/api/loans/${loanId}/pay-fine`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function getHistory(token, size = 50) {
  return request(`/api/loans/history?page=1&size=${size}`, {
    headers: authHeaders(token),
  });
}

async function getCurrentLoans(token) {
  return request("/api/loans/current", {
    headers: authHeaders(token),
  });
}

async function logout(token) {
  return request("/api/logout", {
    method: "POST",
    headers: authHeaders(token),
  });
}

async function forceDueDate(loanId, dueDate) {
  await prisma.loan.update({
    where: { id: loanId },
    data: { dueDate },
  });
}

async function createReturnedLoan(token, bookId, dueDate) {
  const loanId = await borrowBook(token, bookId);
  if (dueDate) {
    await forceDueDate(loanId, dueDate);
  }

  const result = await returnLoan(token, loanId);
  assert.equal(result.response.status, 200);
  return {
    loanId,
    result,
  };
}

async function cleanup() {
  if (createdUserIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        userId: {
          in: createdUserIds,
        },
      },
    });
  }

  if (createdBookIds.length > 0 || createdUserIds.length > 0) {
    await prisma.loan.deleteMany({
      where: {
        OR: [
          createdBookIds.length > 0
            ? {
                bookId: {
                  in: createdBookIds,
                },
              }
            : undefined,
          createdUserIds.length > 0
            ? {
                userId: {
                  in: createdUserIds,
                },
              }
            : undefined,
        ].filter(Boolean),
      },
    });
  }

  if (createdBookIds.length > 0) {
    await prisma.book.deleteMany({
      where: {
        id: {
          in: createdBookIds,
        },
      },
    });
  }

  if (createdUserIds.length > 0) {
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

  const primaryUser = await registerAndLogin("primary");
  const peerUser = await registerAndLogin("peer");
  const renewableBook = await createBook("renewable");
  const fineFlowBook = await createBook("fine-flow");
  const borrowTargetBook = await createBook("borrow-target");
  const overdueRenewBook = await createBook("overdue-renew");

  const unauthenticatedPayResult = await request(
    `/api/loans/missing-loan-${uniqueSuffix}/pay-fine`,
    { method: "POST" },
  );
  assert.equal(unauthenticatedPayResult.response.status, 401);

  const missingLoanPayResult = await payFine(
    primaryUser.token,
    `missing-loan-${uniqueSuffix}`,
  );
  assert.equal(missingLoanPayResult.response.status, 404);

  const renewableLoanId = await borrowBook(primaryUser.token, renewableBook.id);

  const noFineLoan = await createReturnedLoan(primaryUser.token, fineFlowBook.id);
  assert.equal(noFineLoan.result.body.data.status, "Returned");
  assert.equal(noFineLoan.result.body.data.fineAmount, 0);
  const noFineLoanRecord = await prisma.loan.findUnique({
    where: { id: noFineLoan.loanId },
  });
  assert.equal(Number(noFineLoanRecord.fineAmount), 0);
  assert.equal(noFineLoanRecord.finePaid, true);

  const payNoFineResult = await payFine(primaryUser.token, noFineLoan.loanId);
  assert.equal(payNoFineResult.response.status, 400);
  assert.equal(payNoFineResult.body.message, "该笔借阅无待缴罚款或金额不足");

  const futureBoundaryLoan = await createReturnedLoan(
    primaryUser.token,
    fineFlowBook.id,
    new Date(Date.now() + 60 * 1000),
  );
  assert.equal(futureBoundaryLoan.result.body.data.fineAmount, 0);
  const futureBoundaryRecord = await prisma.loan.findUnique({
    where: { id: futureBoundaryLoan.loanId },
  });
  assert.equal(Number(futureBoundaryRecord.fineAmount), 0);
  assert.equal(futureBoundaryRecord.finePaid, true);

  const exactAmountLoan = await createReturnedLoan(
    primaryUser.token,
    fineFlowBook.id,
    new Date(Date.now() - 60 * 1000),
  );
  assert.equal(exactAmountLoan.result.body.data.fineAmount, 5);
  const exactAmountPayResult = await payFine(primaryUser.token, exactAmountLoan.loanId, {
    amount: 5,
  });
  assert.equal(exactAmountPayResult.response.status, 200);
  assert.equal(exactAmountPayResult.body.data.fineAmount, 5);
  assert.equal(exactAmountPayResult.body.data.finePaid, true);

  const stringAmountLoan = await createReturnedLoan(
    primaryUser.token,
    fineFlowBook.id,
    new Date(Date.now() - 60 * 1000),
  );
  assert.equal(stringAmountLoan.result.body.data.fineAmount, 5);
  const stringAmountPayResult = await payFine(primaryUser.token, stringAmountLoan.loanId, {
    amount: "5",
  });
  assert.equal(stringAmountPayResult.response.status, 200);
  assert.equal(stringAmountPayResult.body.data.finePaid, true);

  const mainFineLoan = await createReturnedLoan(
    primaryUser.token,
    fineFlowBook.id,
    new Date(Date.now() - 60 * 1000),
  );
  assert.equal(mainFineLoan.result.body.data.fineAmount, 5);

  const prePaymentHistoryResult = await getHistory(primaryUser.token);
  assert.equal(prePaymentHistoryResult.response.status, 200);
  const prePaymentHistoryLoan = prePaymentHistoryResult.body.data.list.find(
    (loan) => loan.id === mainFineLoan.loanId,
  );
  assert.ok(prePaymentHistoryLoan);
  assert.equal(prePaymentHistoryLoan.fineAmount, 5);
  assert.equal(prePaymentHistoryLoan.finePaid, false);
  assert.equal(prePaymentHistoryLoan.fineForgiven, false);

  const blockedBorrowResult = await request("/api/loans", {
    method: "POST",
    headers: authHeaders(primaryUser.token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      bookId: borrowTargetBook.id,
    }),
  });
  assert.equal(blockedBorrowResult.response.status, 400);
  assert.equal(blockedBorrowResult.body.message, "该书当前不可借或您有未缴清罚款");

  const blockedRenewResult = await renewLoan(primaryUser.token, renewableLoanId);
  assert.equal(blockedRenewResult.response.status, 400);
  assert.equal(blockedRenewResult.body.message, "您有未缴清罚款，不可续借");

  const unauthorizedPayResult = await payFine(peerUser.token, mainFineLoan.loanId);
  assert.equal(unauthorizedPayResult.response.status, 404);

  const invalidAmounts = [4, 6, 0, -1, "abc", 5.000001, 4.999999];
  for (const amount of invalidAmounts) {
    const invalidAmountResult = await payFine(primaryUser.token, mainFineLoan.loanId, {
      amount,
    });
    assert.equal(invalidAmountResult.response.status, 400);
    assert.equal(invalidAmountResult.body.message, "该笔借阅无待缴罚款或金额不足");
  }

  const mainFinePayResult = await payFine(primaryUser.token, mainFineLoan.loanId);
  assert.equal(mainFinePayResult.response.status, 200);
  assert.equal(mainFinePayResult.body.message, "罚款已缴纳");
  assert.equal(mainFinePayResult.body.data.loanId, mainFineLoan.loanId);
  assert.equal(mainFinePayResult.body.data.fineAmount, 5);
  assert.equal(mainFinePayResult.body.data.finePaid, true);

  const postPaymentHistoryResult = await getHistory(primaryUser.token);
  assert.equal(postPaymentHistoryResult.response.status, 200);
  const postPaymentHistoryLoan = postPaymentHistoryResult.body.data.list.find(
    (loan) => loan.id === mainFineLoan.loanId,
  );
  assert.ok(postPaymentHistoryLoan);
  assert.equal(postPaymentHistoryLoan.fineAmount, 5);
  assert.equal(postPaymentHistoryLoan.finePaid, true);
  assert.equal(postPaymentHistoryLoan.fineForgiven, false);

  const paidLoanRecord = await prisma.loan.findUnique({
    where: { id: mainFineLoan.loanId },
  });
  assert.ok(paidLoanRecord);
  assert.equal(Number(paidLoanRecord.fineAmount), 5);
  assert.equal(paidLoanRecord.finePaid, true);

  const auditLog = await prisma.auditLog.findFirst({
    where: {
      userId: primaryUser.userId,
      action: "PAY_FINE",
      entity: "Loan",
      entityId: mainFineLoan.loanId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  assert.ok(auditLog);
  assert.equal(
    auditLog.detail,
    JSON.stringify({ amount: 5, method: "SIMULATED" }),
  );

  const duplicatePayResult = await payFine(primaryUser.token, mainFineLoan.loanId, {
    amount: 5,
  });
  assert.equal(duplicatePayResult.response.status, 400);

  const borrowAfterPaymentLoanId = await borrowBook(primaryUser.token, borrowTargetBook.id);
  const borrowAfterPaymentReturn = await returnLoan(primaryUser.token, borrowAfterPaymentLoanId);
  assert.equal(borrowAfterPaymentReturn.response.status, 200);

  const renewAfterPaymentResult = await renewLoan(primaryUser.token, renewableLoanId);
  assert.equal(renewAfterPaymentResult.response.status, 200);
  assert.equal(renewAfterPaymentResult.body.message, "续借成功");
  assert.equal(renewAfterPaymentResult.body.data.id, renewableLoanId);
  assert.equal(renewAfterPaymentResult.body.data.renewalCount, 1);

  const renewLimitResult = await renewLoan(primaryUser.token, renewableLoanId);
  assert.equal(renewLimitResult.response.status, 400);
  assert.equal(renewLimitResult.body.message, "已达续借次数上限");

  const overdueRenewLoanId = await borrowBook(primaryUser.token, overdueRenewBook.id);
  await forceDueDate(overdueRenewLoanId, new Date(Date.now() - 60 * 1000));

  const overdueCurrentLoansResult = await getCurrentLoans(primaryUser.token);
  assert.equal(overdueCurrentLoansResult.response.status, 200);
  const overdueCurrentLoan = overdueCurrentLoansResult.body.data.list.find(
    (loan) => loan.id === overdueRenewLoanId,
  );
  assert.ok(overdueCurrentLoan);
  assert.equal(overdueCurrentLoan.status, "Overdue");

  const overdueHistoryResult = await getHistory(primaryUser.token);
  assert.equal(overdueHistoryResult.response.status, 200);
  const overdueHistoryLoan = overdueHistoryResult.body.data.list.find(
    (loan) => loan.id === overdueRenewLoanId,
  );
  assert.ok(overdueHistoryLoan);
  assert.equal(overdueHistoryLoan.status, "Overdue");

  const overdueRenewResult = await renewLoan(primaryUser.token, overdueRenewLoanId);
  assert.equal(overdueRenewResult.response.status, 400);
  assert.equal(overdueRenewResult.body.message, "已逾期的图书不可续借");

  const overdueReturnResult = await returnLoan(primaryUser.token, overdueRenewLoanId);
  assert.equal(overdueReturnResult.response.status, 200);
  assert.equal(overdueReturnResult.body.data.status, "Returned");
  assert.equal(overdueReturnResult.body.data.fineAmount, 5);

  const overdueReturnHistoryResult = await getHistory(primaryUser.token);
  assert.equal(overdueReturnHistoryResult.response.status, 200);
  const overdueReturnedLoan = overdueReturnHistoryResult.body.data.list.find(
    (loan) => loan.id === overdueRenewLoanId,
  );
  assert.ok(overdueReturnedLoan);
  assert.equal(overdueReturnedLoan.status, "Returned");
  assert.equal(overdueReturnedLoan.fineAmount, 5);
  assert.equal(overdueReturnedLoan.finePaid, false);

  const overdueBorrowBlockedResult = await request("/api/loans", {
    method: "POST",
    headers: authHeaders(primaryUser.token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      bookId: overdueRenewBook.id,
    }),
  });
  assert.equal(overdueBorrowBlockedResult.response.status, 400);
  assert.equal(overdueBorrowBlockedResult.body.message, "该书当前不可借或您有未缴清罚款");

  const overdueFinePayResult = await payFine(primaryUser.token, overdueRenewLoanId, {
    amount: 5,
  });
  assert.equal(overdueFinePayResult.response.status, 200);
  assert.equal(overdueFinePayResult.body.data.finePaid, true);

  const overdueBorrowAfterPaymentLoanId = await borrowBook(
    primaryUser.token,
    overdueRenewBook.id,
  );
  const overdueBorrowAfterPaymentReturn = await returnLoan(
    primaryUser.token,
    overdueBorrowAfterPaymentLoanId,
  );
  assert.equal(overdueBorrowAfterPaymentReturn.response.status, 200);

  const logoutFineLoan = await createReturnedLoan(
    primaryUser.token,
    fineFlowBook.id,
    new Date(Date.now() - 60 * 1000),
  );
  assert.equal(logoutFineLoan.result.body.data.fineAmount, 5);

  const logoutResult = await logout(primaryUser.token);
  assert.equal(logoutResult.response.status, 200);

  const payAfterLogoutResult = await payFine(primaryUser.token, logoutFineLoan.loanId);
  assert.equal(payAfterLogoutResult.response.status, 401);

  console.log("Reader fine edge test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
