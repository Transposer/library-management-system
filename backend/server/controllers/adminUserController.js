const adminUserService = require("../services/adminUserService");
const { sendSuccess } = require("../lib/response");

async function resetUserPassword(req, res, next) {
  try {
    const { id: targetUserId } = req.params;
    const payload = req.body || {};
    const data = await adminUserService.resetUserPassword(req.currentUser.id, targetUserId, payload);
    sendSuccess(res, data, "密码重置成功");
  } catch (error) {
    next(error);
  }
}

async function createLibrarian(req, res, next) {
  try {
    // 获取操作人 ID (假设中间件会注入 req.currentUser)
    const operatorId = req.currentUser ? req.currentUser.id : null;
    
    // 调用 service 处理业务
    const data = await adminUserService.createLibrarian(operatorId, req.body);
    
    // 按你们团队统一的格式返回成功响应
    sendSuccess(res, data);
  } catch (error) {
    next(error); // 抛出错误给统一的错误中间件
  }
}

async function listLibrarians(req, res, next) {
  try {
    const data = await adminUserService.listLibrarians(req.query || {});
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function getLibrarianDetail(req, res, next) {
  try {
    const data = await adminUserService.getLibrarianDetail(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function updateLibrarian(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const librarianId = req.params.id; // 从 URL 获取 :id
    
    const data = await adminUserService.updateLibrarian(operatorId, librarianId, req.body);
    
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function deleteLibrarian(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const librarianId = req.params.id;

    const data = await adminUserService.deleteLibrarian(operatorId, librarianId);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const data = await adminUserService.listUsers(req.query || {});
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const targetUserId = req.params.id;

    const data = await adminUserService.deleteUser(operatorId, targetUserId);
    sendSuccess(res, data, "用户删除成功");
  } catch (error) {
    next(error);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const operatorId = req.currentUser ? req.currentUser.id : null;
    const targetUserId = req.params.id;
    const { role } = req.body || {};

    const data = await adminUserService.updateUserRole(operatorId, targetUserId, role);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createLibrarian,
  listLibrarians,
  getLibrarianDetail,
  updateLibrarian,
  deleteLibrarian,
  listUsers,
  deleteUser,
  updateUserRole,
  resetUserPassword,
};
