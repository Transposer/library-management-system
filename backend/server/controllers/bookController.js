const bookService = require("../services/bookService");
const { sendSuccess } = require("../lib/response");

async function listBooks(req, res, next) {
  try {
    const data = await bookService.listBooks(req.query);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function searchBooks(req, res, next) {
  try {
    const data = await bookService.searchBooks(req.query);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

async function getBookDetail(req, res, next) {
  try {
    const data = await bookService.getBookDetail(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}


//获取图书列表支持筛选排序分页
async function getBooksWithFilters(req, res, next) {
  try {
    const data = await bookService.getBooksWithFilters(req.query);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

//新书通报
async function getNewBooks(req, res, next) {
  try {
    const data = await bookService.getNewBooks(req.query);
    console.log("getNewBooks 返回数据:", data);
    sendSuccess(res, data);
  } catch (error) {
    console.log("getNewBooks 控制器错误:", error);
    next(error);
  }
}

//借阅排行榜
async function getRanking(req, res, next) {
  try {
    const data = await bookService.getRanking(req.query);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listBooks,
  searchBooks,
  getBookDetail,
  getBooksWithFilters,  
  getNewBooks,          
  getRanking            
};
