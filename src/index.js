require("dotenv").config();
const helmet = require("helmet");
const express = require("express");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const logger = require("./utils/logger");
const path = require("path");
const documentRoutes = require("./routes/documentRoutes");
const corsMiddleware = require("./middlewares/cors");

const { isLinux, resolvePublicBaseUrl } = require("./utils/baseUrl");

const app = express();

app.use(helmet());

if (isLinux()) {
  app.set("trust proxy", 1);
}

const PORT = Number(process.env.DOC_SERVER_PORT);
app.locals.baseUrl = resolvePublicBaseUrl();

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Rimba Document!" });
});

app.get("/debug/urls", (req, res) => {
  res.json({
    PG_ENV: process.env.PG_ENV,
    PORT,
    baseUrl: app.locals.baseUrl,
  });
});

// Route API
app.use("/api/rimba/docs", authRoutes);

// Route Documents
app.use("/storage", express.static(path.join(__dirname, "public", "storage")));
app.use("/api/rimba/docs", documentRoutes);

// Jalankan server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
