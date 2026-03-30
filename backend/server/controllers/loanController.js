const loanService = require("../services/loanService");
const { sendSuccess } = require("../lib/response");

async function getCurrentLoans(req, res, next) {
  try {
    const data = await loanService.getCurrentLoans(req.currentUser.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function createLoan(req, res, next) {
  try {
    const data = await loanService.createLoan(req.currentUser.id, req.body);
    sendSuccess(res, data, "借阅成功");
  } catch (error) {
    next(error);
  }
}
async function getHistoryLoans(req, res, next) {
  try {
    const { page = 1, size = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(size, 10);
    const data = await loanService.getHistoryLoans(
        req.currentUser.id,
        pageNum,
        pageSize
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function renewLoan(req, res, next) {
  try {
    const { id } = req.params;
    const data = await loanService.renewLoan(req.currentUser.id, id);
    sendSuccess(res, data, "续借成功");
  } catch (error) {
    next(error);
  }
}

async function returnLoan(req, res, next) {
  try {
    const { id } = req.params;
    const data = await loanService.returnLoan(req.currentUser.id, id);
    sendSuccess(res, data, "归还成功");
  } catch (error) {
    next(error);
  }
}

async function payFine(req, res, next) {
  try {
    const { id } = req.params;
    const data = await loanService.payFine(req.currentUser.id, id, req.body);
    sendSuccess(res, data, "罚款已缴纳");
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentLoans,
  createLoan,
  getHistoryLoans,
  renewLoan,
  returnLoan,
  payFine,
};
