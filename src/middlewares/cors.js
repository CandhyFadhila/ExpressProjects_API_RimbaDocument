const cors = require("cors");

const corsOptions = {
  origin: ["https://rimba.webgis.app/kmis", "https://rimbaexium.org"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

module.exports = cors(corsOptions);
