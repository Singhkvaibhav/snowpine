const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/snowpine",
});

pool.on("error", (err) => {
  console.error("db_pool_error", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initDb() {
  const { runMigrations } = require("./migrate");
  await runMigrations();

  const { rows } = await pool.query("SELECT COUNT(*) AS n FROM products");
  if (Number(rows[0].n) === 0) {
    const seedPath = path.resolve(__dirname, "database/seed.sql");
    if (fs.existsSync(seedPath)) await pool.query(fs.readFileSync(seedPath, "utf8"));
  }
}

module.exports = { pool, query, initDb };
