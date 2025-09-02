const fs = require("fs");
const path = require("path");
const knex = require("../config/database");
const {
  deleteDocuments: deleteDocsHelper,
  uploadDocuments: uploadDocsHelper,
} = require("../helpers/documentHelper");
const { validationResult } = require("express-validator");
const WithDataResource = require("../resources/WithDataResource");
const WithoutDataResource = require("../resources/WithoutDataResource");
const logger = require("../utils/logger");

exports.getFile = async (req, res) => {
  // 1) Validasi
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join(" ");
    logger.warn(`| Get Documents Server | - VALIDATION_FAILED: ${message}`);
    const response = new WithoutDataResource(
      400,
      "GET_DOCUMENT_FAILED",
      "Gagal Get Dokumen",
      message
    );
    return res.status(400).json(response.toResponse());
  }

  const { file_id } = req.body; // array UUID
  if (!Array.isArray(file_id) || file_id.length !== 1) {
    const response = new WithoutDataResource(
      400,
      "GET_DOCUMENT_FAILED",
      "Gagal Get Dokumen",
      "file_id harus berisi tepat satu UUID."
    );
    return res.status(400).json(response.toResponse());
  }

  try {
    // 2) Ambil metadata file
    const doc = await knex("documents")
      .select("id", "file_name", "file_path", "file_mime_type")
      .where({ id: file_id[0] })
      .first();

    if (!doc) {
      logger.warn(
        "| Get Documents Server | - NOT_FOUND: dokumen tidak ditemukan"
      );
      const response = new WithoutDataResource(
        404,
        "DOCUMENT_NOT_FOUND",
        "Dokumen Tidak Ditemukan",
        "File dengan ID yang diberikan tidak tersedia."
      );
      return res.status(404).json(response.toResponse());
    }

    // 3) Siapkan path fisik (mirror storage_path('app/public/...'))
    //   DB menyimpan: storage/documents/<name>
    //   Lokasi fisik: <project>/public/storage/documents/<name>
    const publicBase = path.resolve(__dirname, "..", "public");
    const safeRel = String(doc.file_path || "").replace(/^[/\\]+/, "");
    const absPath = path.resolve(publicBase, safeRel);

    // Guard keamanan + cek exist
    const insidePublic =
      absPath.startsWith(publicBase + path.sep) || absPath === publicBase;
    if (!insidePublic || !fs.existsSync(absPath)) {
      logger.warn(
        `| Get Documents Server | - FILE_NOT_FOUND at path: ${absPath}`
      );
      const response = new WithoutDataResource(
        404,
        "FILE_NOT_FOUND",
        "Dokumen Tidak Ditemukan",
        "File fisik tidak ditemukan di penyimpanan."
      );
      return res.status(404).json(response.toResponse());
    }

    // 4) Kirim file secara inline (seperti response()->file())
    const stat = fs.statSync(absPath);
    res.setHeader(
      "Content-Type",
      doc.file_mime_type || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.file_name)}"`
    );
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(absPath);
    stream.on("error", (err) => {
      logger.error(`| Get Documents Server | - STREAM_ERROR: ${err.message}`);
      if (!res.headersSent) {
        const response = new WithoutDataResource(
          500,
          "STREAM_ERROR",
          "Server Error",
          "Terjadi kesalahan saat mengirim file."
        );
        return res.status(500).json(response.toResponse());
      }
    });

    logger.info(`| Get Documents Server | - Sending inline: ${doc.file_name}`);
    return stream.pipe(res);
  } catch (error) {
    logger.error(`| Get Documents Server | - Server error: ${error.message}`, {
      stack: error.stack,
    });
    const response = new WithoutDataResource(
      500, // HTTP Status Code: Internal Server Error
      "SERVER_ERROR",
      "Login Gagal.",
      "Terjadi kesalahan di server. Silakan coba lagi nanti."
    );
    res.status(500).json(response.toResponse());
  }
};

exports.uploadDocuments = async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      const response = new WithoutDataResource(
        400,
        "NO_FILES",
        "Gagal Upload Dokumen",
        "Tidak ada file yang dikirim. Silakan pilih dokumen terlebih dahulu."
      );
      return res.status(400).json(response.toResponse());
    }

    const result = await uploadDocsHelper(files);

    const response = new WithDataResource(
      201,
      "UPLOAD_SUCCESS",
      "Upload Berhasil",
      "Dokumen berhasil diunggah ke server.",
      result
    );
    return res.status(201).json(response.toResponse());
  } catch (error) {
    logger.error(
      `| Upload Documents Server | - Server error: ${error.message}`,
      {
        stack: error.stack,
      }
    );
    const response = new WithoutDataResource(
      500, // HTTP Status Code: Internal Server Error
      "SERVER_ERROR",
      "Login Gagal.",
      "Terjadi kesalahan di server. Silakan coba lagi nanti."
    );
    res.status(500).json(response.toResponse());
  }
};

exports.deleteDocuments = async (req, res) => {
  try {
    // 1) Ambil dari body lalu fallback ke query ?ids=...
    let ids = parseIds(req?.body?.document_ids);
    if (ids.length === 0) ids = parseIds(req?.query?.ids);

    // 2) Validasi dasar
    if (ids.length === 0) {
      const response = new WithoutDataResource(
        400,
        "INVALID_INPUT",
        "Gagal Menghapus Dokumen",
        "Mohon kirimkan document_ids yang valid."
      );
      return res.status(400).json(response.toResponse());
    }

    // 3) Validasi UUID v4
    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const invalid = ids.filter((id) => !uuidV4.test(id));
    if (invalid.length) {
      const response = new WithoutDataResource(
        400,
        "INVALID_INPUT",
        "Gagal Menghapus Dokumen",
        `Terdapat ID tidak valid: ${invalid.join(", ")}`
      );
      return res.status(400).json(response.toResponse());
    }

    // 4) Eksekusi
    const deleted = await deleteDocsHelper(ids);

    if (Array.isArray(deleted) && deleted.length > 0) {
      for (const id of deleted) {
        logger.info(
          `| Delete Documents Server | - Dokumen id ${id} berhasil dihapus.`
        );
      }
    }

    // 4.b Log per-ID yang diminta tapi tidak terhapus (tidak ditemukan/gagal)
    const notDeleted = ids.filter((id) => !deleted.includes(id));
    if (notDeleted.length > 0) {
      logger.warn(
        `| Delete Documents Server | - ID tidak ditemukan/gagal dihapus: ${notDeleted.join(
          ", "
        )}`
      );
    }

    if (!deleted || deleted.length === 0) {
      const response = new WithoutDataResource(
        404,
        "NO_DOCUMENT_DELETED",
        "Dokumen Tidak Ditemukan",
        "Tidak ada dokumen yang berhasil dihapus."
      );
      return res.status(404).json(response.toResponse());
    }

    const response = new WithoutDataResource(
      200,
      "DELETE_SUCCESS",
      "Dokumen Berhasil Dihapus",
      `Berhasil menghapus ${deleted.length} dokumen.`
    );
    return res.status(200).json(response.toResponse());
  } catch (error) {
    logger.error(
      `| Delete Documents Server | - Server error: ${error.message}`,
      {
        stack: error.stack,
      }
    );
    const response = new WithoutDataResource(
      500,
      "SERVER_ERROR",
      "Gagal Menghapus Dokumen",
      "Terjadi kesalahan di server. Silakan coba lagi nanti."
    );
    return res.status(500).json(response.toResponse());
  }
};

function parseIds(input) {
  // Jika sudah array -> langsung
  if (Array.isArray(input)) return input;

  // Jika string, coba parse JSON dulu
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      // bukan JSON array, fallback ke CSV/bracketed
      const stripped = input.replace(/[\[\]\s'"]/g, "");
      if (!stripped) return [];
      return stripped
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}
