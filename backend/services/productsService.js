const { query } = require("../db");

async function listProducts() {
  const { rows } = await query("SELECT * FROM products ORDER BY created_at DESC");
  return rows;
}

async function getProduct(id) {
  const { rows } = await query("SELECT * FROM products WHERE id = $1", [id]);
  return rows[0] || null;
}

module.exports = { listProducts, getProduct };
