const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { loginValidator } = require("../validators/loginValidator");
const authMiddleware = require("../middlewares/authMiddleware");
const rateLimiter = require("../middlewares/rateLimitMiddleware");

// Auth
router.post("/signin", rateLimiter, loginValidator, authController.login);
router.get("/signout", rateLimiter, authMiddleware, authController.logout);

module.exports = router;
