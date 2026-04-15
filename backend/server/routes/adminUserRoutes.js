const express = require("express");
const adminUserController = require("../controllers/adminUserController");
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const adminOnly = [requireAuth, requireRole(['ADMIN'])];

router.post("/admin/librarians", ...adminOnly, adminUserController.createLibrarian);
router.get("/admin/librarians", ...adminOnly, adminUserController.listLibrarians);
router.get("/admin/librarians/:id", ...adminOnly, adminUserController.getLibrarianDetail);
router.put("/admin/librarians/:id", ...adminOnly, adminUserController.updateLibrarian);
router.delete("/admin/librarians/:id", ...adminOnly, adminUserController.deleteLibrarian);
router.get("/admin/users", ...adminOnly, adminUserController.listUsers);
router.delete("/admin/users/:id", ...adminOnly, adminUserController.deleteUser);
router.put("/admin/users/:id/role", ...adminOnly, adminUserController.updateUserRole);
router.post("/admin/users/:id/reset-password", ...adminOnly, adminUserController.resetUserPassword);

module.exports = router;
