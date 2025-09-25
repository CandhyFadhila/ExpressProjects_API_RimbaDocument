require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const logger = require("./utils/logger");
const path = require("path");
const documentRoutes = require("./routes/documentRoutes");
const corsMiddleware = require("./middlewares/cors");

const app = express();

function isLinux() {
  return (
    String(process.env.PG_ENV || "windows")
      .trim()
      .toLowerCase() === "linux"
  );
}

function resolvePublicBaseUrl(port) {
  return isLinux() ? "https://doc.rimbaexium.org" : `http://localhost:${port}`;
}

if (isLinux()) {
  app.set("trust proxy", 1);
}

const PORT = 3001;
app.locals.baseUrl = resolvePublicBaseUrl(PORT);

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(morgan("dev"));

// Cek API root
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Rimba Document!" });
});

// Cek db
app.get("/check-db", async (req, res) => {
  try {
    // Cek koneksi berdasarkan environment (Linux/Windows)
    const env = process.env.PG_ENV || "windows";
    const database = require("./config/database"); // ini file database.js

    // Panggil query untuk cek waktu server database
    const result = await database.raw("SELECT NOW()");

    res.json({
      status: "success",
      message: `Koneksi database (${env}) berhasil.`,
      server_time: result.rows[0].now,
    });
  } catch (error) {
    logger.error("DB Connection Error:", error.message);
    res.status(500).json({
      status: "error",
      message:
        "Gagal terhubung ke database. Pastikan environment sudah benar dan database sudah dijalankan.",
      error: error.message,
    });
  }
});

// Route API
app.use("/api/rimba/docs", authRoutes);

// Route Documents
app.use("/storage", express.static(path.join(__dirname, "public", "storage")));
app.use("/api/rimba/docs", documentRoutes);

// Jalankan server
app.listen(PORT, () => {
  // Di windows akan log: http://localhost:3001
  // Di linux akan log:   https://doc.rimbaexium.org
  console.log(`Server berjalan di ${app.locals.baseUrl} (listen port ${PORT})`);
});
