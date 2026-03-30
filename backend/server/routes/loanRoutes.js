const express = require("express");

const loanController = require("../controllers/loanController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/loans/current", requireAuth, loanController.getCurrentLoans);
router.get("/loans/history", requireAuth, loanController.getHistoryLoans);
router.post("/loans", requireAuth, loanController.createLoan);
router.post("/loans/:id/renew", requireAuth, loanController.renewLoan);
router.post("/loans/:id/return", requireAuth, loanController.returnLoan);
router.post("/loans/:id/pay-fine", requireAuth, loanController.payFine);

module.exports = router;
