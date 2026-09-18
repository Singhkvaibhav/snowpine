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

// Runs `fn` inside a single transaction, committing on success and rolling
// back on any throw. The callback must use the passed `tx(text, params)`
// instead of the module-level `query` - otherwise it would run on a
// different pooled connection, outside the transaction.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = (text, params) => client.query(text, params);
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function initDb() {
  const { runMigrations } = require("./migrate");
  await runMigrations();

  // Tests create their own products via the API/direct inserts and reset
  // between files (see tests/dbReset.js) - seeding here would race with
  // that and isn't needed for tests to control their own fixture data.
  if (process.env.NODE_ENV === "test") return;

  const { rows } = await pool.query("SELECT COUNT(*) AS n FROM products");
  if (Number(rows[0].n) === 0) {
    const seedPath = path.resolve(__dirname, "database/seed.sql");
    if (fs.existsSync(seedPath)) await pool.query(fs.readFileSync(seedPath, "utf8"));
  }
}

module.exports = { pool, query, withTransaction, initDb };
