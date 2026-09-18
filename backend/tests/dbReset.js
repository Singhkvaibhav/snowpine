const { query, initDb } = require("../db");

// Truncates every real table and resets identity sequences, so each test
// file starts from a genuinely clean slate. Enumerated from the catalog
// rather than hardcoded, so a new table is covered the moment it exists
// instead of being one more thing to remember to add here.
async function resetDb() {
  const { rows } = await query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
  `);
  if (rows.length === 0) return;

  const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
  await query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

async function insertProduct(overrides = {}) {
  const p = {
    name: "Test Product",
    description: "A test product",
    origin_country: "Sweden",
    category: "Tableware",
    price_inr: 1000,
    stock_quantity: 10,
    gst_rate: 0.18,
    ...overrides,
  };
  const { rows } = await query(
    `INSERT INTO products (name, description, origin_country, category, price_inr, stock_quantity, gst_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [p.name, p.description, p.origin_country, p.category, p.price_inr, p.stock_quantity, p.gst_rate]
  );
  return rows[0];
}

module.exports = { resetDb, insertProduct, initDb };
