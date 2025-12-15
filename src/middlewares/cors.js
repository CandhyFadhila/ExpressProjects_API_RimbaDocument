// middlewares/cors.js
const cors = require("cors");

const corsOptions = {
  origin: "https://rimba.webgis.app/api",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

module.exports = cors(corsOptions);
