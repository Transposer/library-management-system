const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
let authToken;
let testBookId;
let registeredUserId;
const uniqueSuffix = Date.now();
const testEmail = `reader.release1.${uniqueSuffix}@example.com`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

async function cleanup() {
  if (testBookId) {
    await prisma.loan.deleteMany({
      where: { bookId: testBookId },
    });
    await prisma.book.deleteMany({
      where: { id: testBookId },
    });
  }

  if (registeredUserId) {
    await prisma.loan.deleteMany({
      where: { userId: registeredUserId },
    });
    await prisma.user.deleteMany({
      where: { id: registeredUserId },
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

  const testBook = await prisma.book.create({
    data: {
      title: `Release1 Test Book ${uniqueSuffix}`,
      author: "Codex Reader",
      isbn: `release1-${uniqueSuffix}`,
      genre: "Technology",
      cover: "/covers/release1-test-book.jpg",
      description: "Reader release1 integration test book.",
      language: "English",
      shelfLocation: "TEST-001",
      available: true,
      availableCopies: 1,
    },
  });
  testBookId = testBook.id;

  const registerResult = await request("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Release1 Reader",
      email: testEmail,
      password: "reader123",
      studentId: `S${uniqueSuffix}`,
    }),
  });
  assert.equal(registerResult.response.status, 200);
  assert.equal(registerResult.body.message, "注册成功");
  registeredUserId = registerResult.body.data.userId;

  const loginResult = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: testEmail,
      password: "reader123",
    }),
  });
  assert.equal(loginResult.response.status, 200);
  assert.ok(loginResult.body.data.token);
  authToken = loginResult.body.data.token;

  const titleSearch = await request(
    `/api/books/search?keyword=${encodeURIComponent("Release1 Test Book")}&type=title`,
  );
  assert.equal(titleSearch.response.status, 200);
  assert.ok(titleSearch.body.data.list.some((book) => book.id === testBookId));

  const authorSearch = await request(
    `/api/books/search?keyword=${encodeURIComponent("Codex Reader")}&type=author`,
  );
  assert.equal(authorSearch.response.status, 200);
  assert.ok(authorSearch.body.data.list.some((book) => book.id === testBookId));

  const detailResult = await request(`/api/books/${testBookId}`);
  assert.equal(detailResult.response.status, 200);
  assert.equal(detailResult.body.data.id, testBookId);
  assert.equal(detailResult.body.data.cover, "/covers/release1-test-book.jpg");
  assert.equal(detailResult.body.data.availableCopies, 1);

  const meResult = await request("/api/users/me", {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(meResult.response.status, 200);
  assert.equal(meResult.body.data.email, testEmail);

  const updateMeResult = await request("/api/users/me", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Updated Reader",
    }),
  });
  assert.equal(updateMeResult.response.status, 200);
  assert.equal(updateMeResult.body.data.name, "Updated Reader");

  const borrowResult = await request("/api/loans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bookId: testBookId,
    }),
  });
  assert.equal(borrowResult.response.status, 200);
  assert.equal(borrowResult.body.message, "借阅成功");
  const loanId = borrowResult.body.data.loanId;

  const borrowedBook = await prisma.book.findUnique({
    where: { id: testBookId },
  });
  assert.equal(borrowedBook.availableCopies, 0);
  assert.equal(borrowedBook.available, false);

  const currentLoansResult = await request("/api/loans/current", {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(currentLoansResult.response.status, 200);
  assert.ok(
    currentLoansResult.body.data.list.some(
      (loan) => loan.bookId === testBookId && loan.status === "Borrowing",
    ),
  );

  const returnResult = await request(`/api/loans/${loanId}/return`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(returnResult.response.status, 200);
  assert.equal(returnResult.body.message, "归还成功");
  assert.equal(returnResult.body.data.status, "Returned");
  assert.equal(returnResult.body.data.bookId, testBookId);

  const returnedBook = await prisma.book.findUnique({
    where: { id: testBookId },
  });
  assert.equal(returnedBook.availableCopies, 1);
  assert.equal(returnedBook.available, true);

  const logoutResult = await request("/api/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(logoutResult.response.status, 200);
  assert.equal(logoutResult.body.message, "已退出登录");

  const postLogoutMe = await request("/api/users/me", {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(postLogoutMe.response.status, 401);

  console.log("Reader Release1 smoke test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
