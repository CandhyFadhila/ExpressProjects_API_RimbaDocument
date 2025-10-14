const knex = require("knex");

const env = (process.env.PG_ENV || "windows").toLowerCase();

const connections = {
  windows: {
    host: "localhost",

    // Ini setup laptop sendi
    // port: 5433,
    // user: "postgres",
    // password: "super.admin",
    // database: "rimba_dokumen",

    // Ini setup laptop reza
    port: 5432,
    user: "postgres",
    password: "super.admin",
    database: "rimba_dokumen",
  },
  linux: {
    host: "localhost",

    // Ini setup laptop sendi
    // port: 5432,
    // user: "user_rimba",
    // password: "password_kuat",
    // database: "doc_rimba",

    // Ini setup laptop reza
    port: 5432,
    user: "postgres",
    password: "super.admin",
    database: "rimba_dokumen",
  },
};

const connection = connections[env] || connections.windows;

const db = knex({
  client: "pg",
  connection,
  pool: {
    min: 2,
    max: 50,
  },
  acquireConnectionTimeout: 10000,
});

module.exports = db;
