const { body } = require("express-validator");

exports.getDocumentValidator = [
  body("file_id")
    .exists()
    .withMessage("ID file tidak boleh kosong.")
    .bail()
    .isArray()
    .withMessage("ID file harus berupa array.")
    .bail()
    .custom((arr) => Array.isArray(arr) && arr.length > 0)
    .withMessage("ID file minimal berisi 1 UUID."),
  body("file_id.*")
    .notEmpty()
    .withMessage("Setiap ID file wajib diisi.")
    .bail()
    .isUUID(4)
    .withMessage("Setiap ID file harus berupa UUID."),
];
