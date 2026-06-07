const adminDashboardService = require("../services/adminDashboardService");
const { sendSuccess } = require("../lib/response");

async function getOverviewStats(req, res, next) {
  try {
    const data = await adminDashboardService.getOverviewStats();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function getLoanTrends(req, res, next) {
  try {
    const data = await adminDashboardService.getLoanTrends(req.query.period);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function getPopularBooks(req, res, next) {
  try {
    const data = await adminDashboardService.getPopularBooks(req.query.limit);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function getRecentActivities(req, res, next) {
  try {
    const data = await adminDashboardService.getRecentActivities(req.query.limit);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverviewStats,
  getLoanTrends,
  getPopularBooks,
  getRecentActivities,
};
