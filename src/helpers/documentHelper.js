const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const knex = require("../config/database");
const logger = require("../utils/logger");

function generateRandomString(length = 25) {
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/\W/g, "")
    .substring(0, length);
}

function formatFileSize(bytes) {
  const sizes = ["b", "kB", "mB", "gB", "tB"];
  if (bytes === 0) return 0;
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

async function uploadDocuments(files) {
  const uploadedResults = [];

  // Buat direktori target sekali di awal
  const destinationDir = path.join(
    __dirname,
    "..",
    "public",
    "storage",
    "documents"
  );

  try {
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
      logger.info(
        `| Upload Documents Server Helper | - Folder dibuat: ${destinationDir}`
      );
    }
  } catch (err) {
    logger.error(
      `| Upload Documents Server Helper | - Gagal membuat folder: ${err.message}`
    );
    throw new Error("Gagal menyiapkan direktori penyimpanan dokumen.");
  }

  // Proses masing-masing file
  for (const file of files) {
    try {
      const extension = path.extname(file.originalname);
      const destinationPath = path.join(destinationDir, file.originalname);

      let finalPath = destinationPath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        const nameWithoutExt = path.basename(file.originalname, extension);
        finalPath = path.join(
          destinationDir,
          `${nameWithoutExt}(${counter})${extension}`
        );
        counter++;
      }

      fs.renameSync(file.path, finalPath); // move file

      const relativePath = `storage/documents/${path.basename(finalPath)}`;
      const fileUrl = `${process.env.APP_URL}/${relativePath}`;
      const mimeType = file.mimetype;
      const fileSizeRaw = file.size; // in bytes (integer)
      const fileSizeFormatted = formatFileSize(fileSizeRaw);

      const result = await knex("documents")
        .insert({
          file_name: path.basename(finalPath),
          file_path: relativePath,
          file_url: fileUrl,
          file_mime_type: mimeType,
          file_size: fileSizeRaw,
        })
        .returning(["id", "created_at", "updated_at"]);

      const inserted = result[0];

      uploadedResults.push({
        server_file_id: inserted.id,
        server_file_name: path.basename(finalPath),
        server_file_path: relativePath,
        server_file_url: fileUrl,
        server_file_mime_type: mimeType,
        server_file_size: fileSizeFormatted,
      });

      logger.info(
        `| Upload Documents Server Helper | - Success: ${path.basename(finalPath)}`
      );
    } catch (err) {
      logger.error(
        `| Upload Documents Server Helper | - Failed on file ${file.originalname}: ${err.message}`
      );
    }
  }

  return uploadedResults;
}

async function deleteDocuments(documentIds = []) {
  const deleted = [];

  for (const id of documentIds) {
    try {
      const document = await knex("documents")
        .select("file_path")
        .where({ id })
        .first();
      if (!document) {
        logger.warn(
          `| Delete Documents Server Helper | - Dokumen ID ${id} tidak ditemukan.`
        );
        continue;
      }

      const filePath = path.join(__dirname, "..", "public", document.file_path);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      } else {
        logger.warn(
          `| Delete Documents Server Helper | - File tidak ditemukan di path: ${filePath}`
        );
      }

      await knex("documents").where({ id }).del();

      deleted.push(id);
      logger.info(
        `| Delete Documents Server Helper | - Dokumen ${id} berhasil dihapus.`
      );
    } catch (error) {
      logger.error(
        `| Delete Documents Server Helper | - Gagal menghapus dokumen ${id}: ${error.message}`
      );
    }
  }

  return deleted;
}

module.exports = { uploadDocuments, deleteDocuments };
