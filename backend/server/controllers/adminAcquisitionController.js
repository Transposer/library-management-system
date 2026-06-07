const adminAcquisitionService = require("../services/adminAcquisitionService");
const { sendSuccess } = require("../lib/response");

async function listAllRequests(req, res, next) {
  try {
    const data = await adminAcquisitionService.listAllRequests(req.query || {});
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function approveRequest(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAcquisitionService.approveRequest(operatorId, req.params.id);
    sendSuccess(res, data, "Request approved successfully");
  } catch (error) {
    next(error);
  }
}

async function rejectRequest(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const reason = req.body ? req.body.reason : "";
    const data = await adminAcquisitionService.rejectRequest(operatorId, req.params.id, reason);
    sendSuccess(res, data, "Request rejected successfully");
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAllRequests,
  approveRequest,
  rejectRequest,
};
