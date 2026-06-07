const express = require("express");

const holdController = require("../controllers/holdController");
const librarianController = require("../controllers/librarianController");
const loanController = require("../controllers/loanController");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

// All librarian routes require authentication and LIBRARIAN role
router.use(requireAuth, requireRole(["LIBRARIAN", "ADMIN"]));

// Barcode / scanner lookup
router.get("/barcodes/:code", librarianController.lookupBarcode);

// Fine Dashboard
router.get("/fine-dashboard", librarianController.getFineDashboard);

// L1.3 - View all books with status
router.get("/books", librarianController.viewBooks);

// L1.1 - Add a new book
router.post("/books", librarianController.addBook);

// L1.2 - Edit an existing book
router.put("/books/:id", librarianController.editBook);

// L1.4 - Delete/Archive a book
router.delete("/books/:id", librarianController.deleteBook);

// L2.4 - Scan book by ISBN/barcode
router.get("/books/scan", librarianController.scanBook);

// L2.5 - Lookup book info from external API
router.get("/books/lookup", librarianController.lookupBook);

// L1.3 - View one book with copy barcodes
router.get("/books/:id", librarianController.getBookDetail);

// L2.1/L2.2 - Loan management
router.get("/loans", loanController.getLibrarianLoans);
router.post("/loans/checkout", loanController.librarianCheckoutLoan);
router.post("/loans/return", loanController.librarianReturnLoan);
router.post("/loans/:id/pay-fine", loanController.librarianPayFine);

// L2.3 - Hold management
router.get("/holds", holdController.getLibrarianHolds);
router.put("/holds/:id/ready", holdController.markHoldReady);
router.delete("/holds/:id", holdController.cancelLibrarianHold);

module.exports = router;
