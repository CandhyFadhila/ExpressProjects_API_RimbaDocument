const fs = require("fs");
const path = require("path");
const knex = require("../config/database");
const logger = require("../utils/logger");
const { resolvePublicBaseUrl } = require("../utils/baseUrl");

/**
 * formatFileSize
 * Mengubah ukuran file (bytes) menjadi string yang mudah dibaca.
 */
function formatFileSize(bytes) {
  const sizes = ["b", "kB", "mB", "gB", "tB"];
  if (!bytes || bytes === 0) return "0 b";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * joinUrl
 * Menggabungkan baseUrl dan path (tanpa double slash).
 */
function joinUrl(baseUrl, relativePath) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const rel = String(relativePath || "").replace(/^\/+/, "");
  return `${base}/${rel}`;
}

/**
 * ensureDir
 * Memastikan folder tujuan tersedia.
 */
function ensureDir(dirPath) {
  if (fs.existsSync(dirPath)) return;
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * resolveUniquePath
 * Membuat path unik jika nama file sudah ada (pakai (1), (2), dst).
 */
function resolveUniquePath(destinationDir, originalName) {
  const safeName = path.basename(originalName || "file");
  const extension = path.extname(safeName);
  const nameWithoutExt = path.basename(safeName, extension);

  let finalPath = path.join(destinationDir, safeName);
  let counter = 1;

  while (fs.existsSync(finalPath)) {
    finalPath = path.join(
      destinationDir,
      `${nameWithoutExt}(${counter})${extension}`
    );
    counter += 1;
  }

  return finalPath;
}

/**
 * uploadDocuments
 * Menyimpan file ke storage lokal (public/storage/documents) dan mencatat metadata ke DB.
 */
async function uploadDocuments(files) {
  const uploadedResults = [];
  const normalizedFiles = Array.isArray(files) ? files : [];

  const destinationDir = path.join(
    __dirname,
    "..",
    "public",
    "storage",
    "documents"
  );

  try {
    ensureDir(destinationDir);
    logger.info(
      `| Upload Documents Server Helper | - Folder siap: ${destinationDir}`
    );
  } catch (err) {
    logger.error(
      `| Upload Documents Server Helper | - Gagal menyiapkan folder: ${err.message}`
    );
    throw new Error("Gagal menyiapkan direktori penyimpanan dokumen.");
  }

  const baseUrl = resolvePublicBaseUrl();

  for (const file of normalizedFiles) {
    try {
      const originalName = path.basename(file.originalname || "file");
      const finalPath = resolveUniquePath(destinationDir, originalName);

      fs.renameSync(file.path, finalPath);

      const relativePath = `storage/documents/${path.basename(finalPath)}`;
      const fileUrl = joinUrl(baseUrl, relativePath);

      const mimeType = file.mimetype;
      const fileSizeRaw = Number(file.size) || 0;
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

      const inserted = result?.[0];

      uploadedResults.push({
        server_file_id: String(inserted.id),
        server_file_name: path.basename(finalPath),
        server_file_path: relativePath,
        server_file_url: fileUrl,
        server_file_mime_type: mimeType,
        server_file_size: fileSizeFormatted,
      });

      logger.info(
        `| Upload Documents Server Helper | - Success: ${path.basename(
          finalPath
        )} (${fileSizeFormatted})`
      );
    } catch (err) {
      logger.error(
        `| Upload Documents Server Helper | - Failed on file ${file?.originalname}: ${err.message}`
      );
    }
  }

  return uploadedResults;
}

/**
 * deleteDocuments
 * Menghapus dokumen dari storage lokal dan menghapus row DB berdasarkan list id.
 */
async function deleteDocuments(documentIds = []) {
  const deleted = [];
  const ids = Array.isArray(documentIds) ? documentIds : [];

  for (const id of ids) {
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
          `| Delete Documents Server Helper | - File tidak ditemukan: ${filePath}`
        );
      }

      await knex("documents").where({ id }).del();

      deleted.push(String(id));
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
