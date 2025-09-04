const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { blacklistToken } = require("../utils/tokenBlacklist");
const { validationResult } = require("express-validator");
const logger = require("../utils/logger");
const knex = require("../config/database");
const WithDataResource = require("../resources/WithDataResource");
const WithoutDataResource = require("../resources/WithoutDataResource");
const JWT_SECRET = process.env.JWT_SECRET_KEY || "secretkey";

// ========== LOGIN CONTROLLER ==========
exports.login = async (req, res) => {
  // Validasi input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response = new WithoutDataResource(
      400, // HTTP Status Code: Bad Request
      "VALIDATION_FAILED",
      "Login Gagal.",
      "Tolong periksa kembali input anda. Pastikan email dan password terisi dengan benar."
    );
    return res.status(400).json(response.toResponse());
  }

  const { email, password } = req.body;

  try {
    // Cek user berdasarkan email
    const user = await knex("users").where({ email }).first();
    if (!user) {
      logger.info(
        `| Login | - Invalid credentials for email: ${email}, at ${new Date().toISOString()}`
      );
      const response = new WithoutDataResource(
        400, // HTTP Status Code: Bad Request
        "INVALID_CREDENTIALS",
        "Login Gagal.",
        "Password atau email yang anda masukkan tidak valid, silahkan periksa kembali dan pastikan akun anda sudah terdaftar."
      );
      return res.status(400).json(response.toResponse());
    }

    // Verifikasi password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.info(
        `| Login | - Invalid credentials for email: ${email}, at ${new Date().toISOString()}`
      );
      const response = new WithoutDataResource(
        400, // HTTP Status Code: Bad Request
        "INVALID_CREDENTIALS",
        "Login Gagal.",
        "Password atau email yang anda masukkan tidak valid, silahkan periksa kembali dan pastikan akun anda sudah terdaftar."
      );
      return res.status(400).json(response.toResponse());
    }

    // Update last_login
    await knex("users")
      .where({ id: user.id })
      .update({ last_login: knex.fn.now() });

    // Create JWT token
    const payload = { userId: user.id };
    const token = jwt.sign(payload, JWT_SECRET);

    // Log successful login
    logger.info(
      `| Login | - Login success for email: ${email}, at ${new Date().toISOString()}`
    );

    // Filter user info (tidak mengirim password)
    const filteredUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      last_login: user.last_login,
    };

    const response = new WithDataResource(
      200, // HTTP Status Code: OK
      "LOGIN_SUCCESS",
      "Login Berhasil.",
      "Selamat datang, anda berhasil login di server Rimba Dokumen.",
      { token, user: filteredUser }
    );
    res.status(200).json(response.toResponse());
  } catch (error) {
    logger.error(`| Auth | - Error function login: ${error.message}`);
    const response = new WithoutDataResource(
      500, // HTTP Status Code: Internal Server Error
      "SERVER_ERROR",
      "Server Sedang Error",
      "Terjadi kesalahan pada sistem, silahkan coba lagi nanti atau hubungi admin."
    );
    res.status(500).json(response.toResponse());
  }
};

// ========== LOGOUT CONTROLLER ==========
exports.logout = async (req, res) => {
  const userId = req.userId; // Diperoleh dari middleware authMiddleware
  const token = req.header("Authorization")?.replace("Bearer ", "");

  try {
    // Pastikan userId tersedia
    if (!userId) {
      const response = new WithoutDataResource(
        401, // HTTP Status Code: Unauthorized
        "NO_ACTIVE_SESSION",
        "Logout Gagal",
        "Anda tidak memiliki sesi login yang aktif."
      );
      logger.info(`| Logout | - No active session for userId: ${userId}`);
      return res.status(401).json(response.toResponse());
    }

    // Ambil expiry token dari decode tanpa verify (karena sudah terverifikasi sebelumnya)
    const decoded = jwt.decode(token);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000); // detik tersisa

    // Masukkan token ke blacklist Redis
    await blacklistToken(token, expiresIn);

    // Di sini kita hanya menunggu token dihapus di client-side (client akan menghapus token JWT mereka)
    logger.info(
      `| Logout | - Logout success for userId: ${userId}, at ${new Date().toISOString()}`
    );

    // Response sukses
    const response = new WithoutDataResource(
      200, // HTTP Status Code: OK
      "LOGOUT_SUCCESS",
      "Logout Berhasil",
      "Anda berhasil melakukan logout."
    );
    res.status(200).json(response.toResponse());
  } catch (error) {
    logger.error(`| Auth | - Error function logout: ${error.message}`);
    const response = new WithoutDataResource(
      500, // HTTP Status Code: Internal Server Error
      "SERVER_ERROR",
      "Server Sedang Error",
      "Terjadi kesalahan pada sistem, silahkan coba lagi nanti atau hubungi admin."
    );
    res.status(500).json(response.toResponse());
  }
};
