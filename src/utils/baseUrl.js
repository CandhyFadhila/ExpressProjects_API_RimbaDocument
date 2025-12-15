const { URL } = require("url");

/**
 * getRequiredEnv
 * Ambil env wajib. Throw jika kosong/tidak ada.
 */
function getRequiredEnv(name) {
  const v = process.env[name];
  const s = (v ?? "").toString().trim();
  if (!s) throw new Error(`ENV wajib "${name}" belum diisi.`);
  return s;
}

/**
 * getRequiredIntEnv
 * Ambil env wajib integer. Throw jika tidak valid.
 */
function getRequiredIntEnv(name) {
  const raw = getRequiredEnv(name);
  const n = Number(raw);
  if (!Number.isInteger(n))
    throw new Error(`ENV "${name}" harus integer. Dapat: "${raw}"`);
  return n;
}

/**
 * isLinux
 * True jika PG_ENV=linux.
 */
function isLinux() {
  return getRequiredEnv("PG_ENV").toLowerCase() === "linux";
}

/**
 * normalizeBaseUrlKeepPath
 * Pertahankan path (mis. /cms), hapus trailing slash.
 */
function normalizeBaseUrlKeepPath(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(
      `ENV "DOC_SERVER_BASE_URL" harus URL valid (contoh: http://localhost:1234).`
    );
  }

  const pathname = (u.pathname || "/").replace(/\/+$/, "");
  const pathPart = pathname && pathname !== "/" ? pathname : "";
  return `${u.protocol}//${u.host}${pathPart}`;
}

/**
 * resolvePublicBaseUrl
 * 1 pintu: baseUrl public doc server dari env DOC_SERVER_BASE_URL.
 */
function resolvePublicBaseUrl() {
  const raw = getRequiredEnv("DOC_SERVER_BASE_URL");
  return normalizeBaseUrlKeepPath(raw);
}

module.exports = { isLinux, resolvePublicBaseUrl, getRequiredIntEnv };
