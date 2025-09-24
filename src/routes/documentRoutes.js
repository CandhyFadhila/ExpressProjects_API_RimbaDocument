const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const upload = require("../middlewares/multerMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");
const rateLimiter = require("../middlewares/rateLimitMiddleware");

router.post(
  "/upload-file",
  rateLimiter,
  authMiddleware,
  upload.array("files", 20),
  documentController.uploadDocuments
);

router.delete(
  "/delete-file",
  rateLimiter,
  authMiddleware,
  documentController.deleteDocuments
);

module.exports = router;
