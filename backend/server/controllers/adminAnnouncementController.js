const adminAnnouncementService = require("../services/adminAnnouncementService");
const { sendSuccess } = require("../lib/response");

async function createAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.createAnnouncement(operatorId, req.body || {});
    sendSuccess(res, data, "Announcement created successfully");
  } catch (error) {
    next(error);
  }
}

async function updateAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.updateAnnouncement(
      operatorId,
      req.params.id,
      req.body || {},
    );
    sendSuccess(res, data, "Announcement updated successfully");
  } catch (error) {
    next(error);
  }
}

async function deleteAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    await adminAnnouncementService.deleteAnnouncement(operatorId, req.params.id);
    sendSuccess(res, null, "Announcement deleted successfully");
  } catch (error) {
    next(error);
  }
}

async function publishAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.publishAnnouncement(operatorId, req.params.id);
    sendSuccess(res, data, "Announcement published successfully");
  } catch (error) {
    next(error);
  }
}

async function unpublishAnnouncement(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await adminAnnouncementService.unpublishAnnouncement(operatorId, req.params.id);
    sendSuccess(res, data, "Announcement unpublished successfully");
  } catch (error) {
    next(error);
  }
}

async function listAnnouncements(req, res, next) {
  try {
    const data = await adminAnnouncementService.listAnnouncements(req.query || {});
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  listAnnouncements,
};
