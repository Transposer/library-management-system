const backupService = require("../services/backupService");
const { sendSuccess } = require("../lib/response");

async function createBackup(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const data = await backupService.createBackup(operatorId);
    sendSuccess(res, data, "Backup created successfully");
  } catch (error) {
    next(error);
  }
}

async function listBackups(req, res, next) {
  try {
    const data = await backupService.listBackups(req.query || {});
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function downloadBackup(req, res, next) {
  try {
    const { filePath, fileName } = await backupService.getBackupFilePath(req.params.id);
    res.download(filePath, fileName);
  } catch (error) {
    next(error);
  }
}

async function deleteBackup(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    await backupService.deleteBackup(operatorId, req.params.id);
    sendSuccess(res, null, "Backup deleted successfully");
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBackup,
  listBackups,
  downloadBackup,
  deleteBackup,
};
