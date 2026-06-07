const assert = require("node:assert/strict");

const app = require("../server/app");
const prisma = require("../server/db/prisma");

let server;
let baseUrl;
let adminToken;
let studentToken;
let adminUserId;
const createdAnnouncementIds = [];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const isDownload = response.headers.get("content-disposition")?.includes("attachment");
  let body;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  return { response, body, isDownload };
}

async function loginByEmail(email, password) {
  return request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: email, password }),
  });
}

async function cleanup() {
  if (createdAnnouncementIds.length) {
    await prisma.announcement.deleteMany({
      where: { id: { in: createdAnnouncementIds } },
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

  // ── Login ──────────────────────────────────────────────────
  const adminLogin = await loginByEmail("admin@library.com", "admin123");
  assert.equal(adminLogin.response.status, 200);
  adminToken = adminLogin.body.data.token;
  adminUserId = adminLogin.body.data.userId;

  const studentLogin = await loginByEmail("student1@library.com", "student123");
  assert.equal(studentLogin.response.status, 200);
  studentToken = studentLogin.body.data.token;

  // ═══════════════════════════════════════════════════════════════
  // Dashboard APIs
  // ═══════════════════════════════════════════════════════════════

  // Overview
  const overview = await request("/api/admin/dashboard/overview", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(overview.response.status, 200);
  assert.equal(typeof overview.body.data.totalUsers, "number");
  assert.equal(typeof overview.body.data.totalBooks, "number");
  assert.equal(typeof overview.body.data.availableBooks, "number");
  assert.equal(typeof overview.body.data.activeLoans, "number");
  assert.equal(typeof overview.body.data.overdueLoans, "number");
  assert.equal(typeof overview.body.data.todayCheckouts, "number");
  assert.equal(typeof overview.body.data.todayReturns, "number");
  assert.equal(typeof overview.body.data.pendingHolds, "number");
  assert.equal(typeof overview.body.data.readyHolds, "number");
  assert.equal(typeof overview.body.data.totalFinesUnpaid, "number");
  assert.equal(typeof overview.body.data.monthRevenue, "number");
  assert.equal(typeof overview.body.data.usersByRole.students, "number");
  assert.equal(typeof overview.body.data.usersByRole.librarians, "number");
  assert.equal(typeof overview.body.data.usersByRole.admins, "number");

  // Loan Trends
  const loanTrends7d = await request("/api/admin/dashboard/loan-trends?period=7d", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(loanTrends7d.response.status, 200);
  assert.equal(loanTrends7d.body.data.period, "7d");
  assert.equal(loanTrends7d.body.data.daily.length, 7);

  const loanTrends30d = await request("/api/admin/dashboard/loan-trends?period=30d", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(loanTrends30d.response.status, 200);
  assert.equal(loanTrends30d.body.data.period, "30d");
  assert.equal(loanTrends30d.body.data.daily.length, 30);

  const loanTrends90d = await request("/api/admin/dashboard/loan-trends?period=90d", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(loanTrends90d.response.status, 200);
  assert.equal(loanTrends90d.body.data.period, "90d");
  assert.equal(loanTrends90d.body.data.daily.length, 90);

  // Invalid period
  const invalidPeriod = await request("/api/admin/dashboard/loan-trends?period=week", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(invalidPeriod.response.status, 400);

  // Popular Books
  const popularBooks = await request("/api/admin/dashboard/popular-books?limit=5", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(popularBooks.response.status, 200);
  assert.ok(Array.isArray(popularBooks.body.data.list));

  // Popular Books invalid limit
  const popularBooksInvalid = await request("/api/admin/dashboard/popular-books?limit=100", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(popularBooksInvalid.response.status, 400);

  // Recent Activities
  const recentActivities = await request("/api/admin/dashboard/recent-activities?limit=10", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(recentActivities.response.status, 200);
  assert.ok(Array.isArray(recentActivities.body.data.list));

  // Dashboard 403 check
  const dashboardForbidden = await request("/api/admin/dashboard/overview", {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(dashboardForbidden.response.status, 403);

  console.log("✓ Dashboard APIs passed");

  // ═══════════════════════════════════════════════════════════════
  // Backup APIs
  // ═══════════════════════════════════════════════════════════════

  // Create backup
  const createBackup = await request("/api/admin/backup", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(createBackup.response.status, 200);
  assert.ok(createBackup.body.data.id);
  assert.ok(createBackup.body.data.fileName.endsWith(".db"));
  assert.equal(typeof createBackup.body.data.fileSize, "number");
  assert.ok(createBackup.body.data.createdAt);
  const backupId = createBackup.body.data.id;

  // List backups
  const listBackups = await request("/api/admin/backup?page=1&size=10", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listBackups.response.status, 200);
  assert.ok(listBackups.body.data.total >= 1);
  assert.ok(Array.isArray(listBackups.body.data.list));
  assert.equal(listBackups.body.data.page, 1);

  // Download backup
  const downloadBackup = await request(`/api/admin/backup/${backupId}/download`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(downloadBackup.response.status, 200);

  // Delete backup
  const deleteBackup = await request(`/api/admin/backup/${backupId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteBackup.response.status, 200);

  // Download deleted backup → 404
  const downloadDeleted = await request(`/api/admin/backup/${backupId}/download`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(downloadDeleted.response.status, 404);

  // Backup 403 check
  const backupForbidden = await request("/api/admin/backup", {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(backupForbidden.response.status, 403);

  console.log("✓ Backup APIs passed");

  // ═══════════════════════════════════════════════════════════════
  // Announcement APIs
  // ═══════════════════════════════════════════════════════════════

  // Create announcement (draft)
  const createAnnouncement = await request("/api/admin/announcements", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "R3 Smoke Test Announcement",
      content: "This is a smoke test announcement created by the R3 test suite.",
      type: "OTHER",
    }),
  });
  assert.equal(createAnnouncement.response.status, 200);
  assert.ok(createAnnouncement.body.data.id);
  assert.equal(createAnnouncement.body.data.status, "draft");
  assert.equal(createAnnouncement.body.data.title, "R3 Smoke Test Announcement");
  const announcementId = createAnnouncement.body.data.id;
  createdAnnouncementIds.push(announcementId);

  // Create announcement — missing title
  const createEmptyTitle = await request("/api/admin/announcements", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "", content: "test" }),
  });
  assert.equal(createEmptyTitle.response.status, 400);

  // List announcements
  const listAnnouncements = await request("/api/admin/announcements?page=1&size=10", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listAnnouncements.response.status, 200);
  assert.ok(Array.isArray(listAnnouncements.body.data.list));
  assert.ok(listAnnouncements.body.data.total >= 1);

  // List — filter by status
  const listDrafts = await request("/api/admin/announcements?status=draft", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listDrafts.response.status, 200);
  listDrafts.body.data.list.forEach((a) => assert.equal(a.status, "draft"));

  // Publish announcement
  const publishAnnouncement = await request(`/api/admin/announcements/${announcementId}/publish`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(publishAnnouncement.response.status, 200);
  assert.equal(publishAnnouncement.body.data.status, "published");
  assert.ok(publishAnnouncement.body.data.publishedAt);

  // Publish again → 400
  const publishAgain = await request(`/api/admin/announcements/${announcementId}/publish`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(publishAgain.response.status, 400);

  // Update announcement
  const updateAnnouncement = await request(`/api/admin/announcements/${announcementId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "R3 Smoke Test — Updated",
      content: "Updated content.",
    }),
  });
  assert.equal(updateAnnouncement.response.status, 200);
  assert.equal(updateAnnouncement.body.data.title, "R3 Smoke Test — Updated");

  // Unpublish announcement
  const unpublishAnnouncement = await request(`/api/admin/announcements/${announcementId}/unpublish`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(unpublishAnnouncement.response.status, 200);
  assert.equal(unpublishAnnouncement.body.data.status, "draft");
  assert.equal(unpublishAnnouncement.body.data.publishedAt, null);

  // List by keyword
  const listByKeyword = await request(
    `/api/admin/announcements?keyword=Smoke%20Test`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(listByKeyword.response.status, 200);
  assert.ok(listByKeyword.body.data.list.length >= 1);

  // Delete announcement
  const deleteAnnouncement = await request(`/api/admin/announcements/${announcementId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteAnnouncement.response.status, 200);

  // Announcement 403 check
  const announcementForbidden = await request("/api/admin/announcements", {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(announcementForbidden.response.status, 403);

  // Cleanup tracking since we already deleted
  const idx = createdAnnouncementIds.indexOf(announcementId);
  if (idx !== -1) createdAnnouncementIds.splice(idx, 1);

  console.log("✓ Announcement APIs passed");

  // ═══════════════════════════════════════════════════════════════
  // Acquisition APIs
  // ═══════════════════════════════════════════════════════════════

  // List all requests
  const listAcquisition = await request("/api/admin/acquisition-requests?page=1&size=10", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listAcquisition.response.status, 200);
  assert.ok(Array.isArray(listAcquisition.body.data.list));
  assert.equal(typeof listAcquisition.body.data.total, "number");

  // Filter by status
  const listPending = await request("/api/admin/acquisition-requests?status=PENDING", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listPending.response.status, 200);
  listPending.body.data.list.forEach((r) => assert.equal(r.status, "PENDING"));

  // Invalid status
  const invalidStatus = await request("/api/admin/acquisition-requests?status=INVALID", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(invalidStatus.response.status, 400);

  // Search by keyword
  const searchAcquisition = await request("/api/admin/acquisition-requests?keyword=book", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(searchAcquisition.response.status, 200);

  // Approve non-existent → 404
  const approveMissing = await request("/api/admin/acquisition-requests/nonexistent/approve", {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(approveMissing.response.status, 404);

  // Acquisition 403 check
  const acquisitionForbidden = await request("/api/admin/acquisition-requests", {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(acquisitionForbidden.response.status, 403);

  console.log("✓ Acquisition APIs passed");

  // ═══════════════════════════════════════════════════════════════
  // Report APIs
  // ═══════════════════════════════════════════════════════════════

  const currentMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  // Monthly Borrowing Report
  const borrowingReport = await request(
    `/api/admin/dashboard/reports/borrowing?month=${currentMonth}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(borrowingReport.response.status, 200);
  assert.equal(borrowingReport.body.data.month, currentMonth);
  assert.equal(typeof borrowingReport.body.data.summary.totalCheckouts, "number");
  assert.equal(typeof borrowingReport.body.data.summary.totalReturns, "number");
  assert.equal(typeof borrowingReport.body.data.summary.activeBorrowers, "number");
  assert.ok(Array.isArray(borrowingReport.body.data.dailyTrends));
  assert.ok(Array.isArray(borrowingReport.body.data.topBooks));

  // Overdue Stats Report
  const overdueReport = await request(
    `/api/admin/dashboard/reports/overdue?month=${currentMonth}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(overdueReport.response.status, 200);
  assert.equal(overdueReport.body.data.month, currentMonth);
  assert.equal(typeof overdueReport.body.data.summary.overdueCount, "number");
  assert.equal(typeof overdueReport.body.data.summary.totalFines, "number");
  assert.equal(typeof overdueReport.body.data.summary.overdueRate, "number");
  assert.ok(Array.isArray(overdueReport.body.data.topOverdueBooks));

  // Usage Summary Report
  const usageReport = await request(
    `/api/admin/dashboard/reports/usage?month=${currentMonth}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(usageReport.response.status, 200);
  assert.equal(usageReport.body.data.month, currentMonth);
  assert.equal(typeof usageReport.body.data.summary.totalCheckouts, "number");
  assert.equal(typeof usageReport.body.data.summary.activeBorrowers, "number");
  assert.equal(typeof usageReport.body.data.summary.avgLoansPerUser, "number");
  assert.equal(typeof usageReport.body.data.summary.newUsers, "number");
  assert.ok(typeof usageReport.body.data.summary.peakDay, "string");
  assert.ok(Array.isArray(usageReport.body.data.dailyActivity));
  assert.ok(Array.isArray(usageReport.body.data.topBorrowers));

  // Invalid month format
  const invalidMonth = await request("/api/admin/dashboard/reports/borrowing?month=bad", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(invalidMonth.response.status, 400);

  // Future month
  const futureMonth = await request("/api/admin/dashboard/reports/borrowing?month=2099-12", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(futureMonth.response.status, 400);

  // Export Borrowing Report
  const exportBorrowing = await request(
    `/api/admin/dashboard/reports/borrowing/export?month=${currentMonth}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(exportBorrowing.response.status, 200);
  assert.ok(exportBorrowing.response.headers.get("content-type").includes("spreadsheet"));

  // Export Overdue Report
  const exportOverdue = await request(
    `/api/admin/dashboard/reports/overdue/export?month=${currentMonth}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(exportOverdue.response.status, 200);

  // Export Usage Report
  const exportUsage = await request(
    `/api/admin/dashboard/reports/usage/export?month=${currentMonth}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(exportUsage.response.status, 200);

  // Report 403 check
  const reportForbidden = await request(
    `/api/admin/dashboard/reports/borrowing?month=${currentMonth}`,
    { headers: { Authorization: `Bearer ${studentToken}` } },
  );
  assert.equal(reportForbidden.response.status, 403);

  console.log("✓ Report APIs passed");

  // ═══════════════════════════════════════════════════════════════
  // Audit Log verification — R3 actions were logged
  // ═══════════════════════════════════════════════════════════════

  const auditLogs = await request("/api/admin/audit-logs?page=1&size=50", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(auditLogs.response.status, 200);
  const logActions = auditLogs.body.data.list.map((item) => item.action);
  assert.ok(
    logActions.includes("ADMIN_CREATE_BACKUP"),
    "Should log ADMIN_CREATE_BACKUP",
  );
  assert.ok(
    logActions.includes("ADMIN_DELETE_BACKUP"),
    "Should log ADMIN_DELETE_BACKUP",
  );
  assert.ok(
    logActions.includes("ADMIN_CREATE_ANNOUNCEMENT"),
    "Should log ADMIN_CREATE_ANNOUNCEMENT",
  );
  assert.ok(
    logActions.includes("ADMIN_PUBLISH_ANNOUNCEMENT"),
    "Should log ADMIN_PUBLISH_ANNOUNCEMENT",
  );
  assert.ok(
    logActions.includes("ADMIN_UPDATE_ANNOUNCEMENT"),
    "Should log ADMIN_UPDATE_ANNOUNCEMENT",
  );
  assert.ok(
    logActions.includes("ADMIN_UNPUBLISH_ANNOUNCEMENT"),
    "Should log ADMIN_UNPUBLISH_ANNOUNCEMENT",
  );
  assert.ok(
    logActions.includes("ADMIN_DELETE_ANNOUNCEMENT"),
    "Should log ADMIN_DELETE_ANNOUNCEMENT",
  );

  console.log("✓ AuditLog verification passed");

  console.log("\nAdmin Release3 smoke test passed.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
