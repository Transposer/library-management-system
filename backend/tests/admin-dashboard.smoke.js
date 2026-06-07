const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
let adminToken;
let studentToken;

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

  const adminLogin = await loginByEmail("admin@library.com", "admin123");
  assert.equal(adminLogin.response.status, 200);
  adminToken = adminLogin.body.data.token;

  const studentLogin = await loginByEmail("student1@library.com", "student123");
  assert.equal(studentLogin.response.status, 200);
  studentToken = studentLogin.body.data.token;

  const overview = await request("/api/admin/dashboard/overview", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(overview.response.status, 200);
  assert.equal(typeof overview.body.data.totalUsers, "number");
  assert.equal(typeof overview.body.data.totalBooks, "number");
  assert.equal(typeof overview.body.data.availableBooks, "number");
  assert.equal(typeof overview.body.data.borrowedBooks, "number");
  assert.equal(typeof overview.body.data.activeLoans, "number");
  assert.equal(typeof overview.body.data.overdueLoans, "number");
  assert.equal(typeof overview.body.data.usersByRole.students, "number");

  const loanTrends = await request("/api/admin/dashboard/loan-trends?period=7d", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(loanTrends.response.status, 200);
  assert.equal(loanTrends.body.data.period, "7d");
  assert.equal(loanTrends.body.data.daily.length, 7);

  const invalidPeriod = await request("/api/admin/dashboard/loan-trends?period=week", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(invalidPeriod.response.status, 400);

  const popularBooks = await request("/api/admin/dashboard/popular-books?limit=5", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(popularBooks.response.status, 200);
  assert.ok(Array.isArray(popularBooks.body.data.list));
  if (popularBooks.body.data.list.length > 0) {
    assert.equal(popularBooks.body.data.list[0].rank, 1);
    assert.ok(popularBooks.body.data.list[0].isbn);
  }

  const recentActivities = await request("/api/admin/dashboard/recent-activities?limit=10", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(recentActivities.response.status, 200);
  assert.ok(Array.isArray(recentActivities.body.data.list));

  const forbidden = await request("/api/admin/dashboard/overview", {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(forbidden.response.status, 403);

  console.log("Admin dashboard smoke test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
