const { query } = require("../db");

class ProductError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Whitelisted, not "everything in req.body" - a client sending extra
// fields (e.g. trying to set `id` or `created_at`) must be ignored, not
// silently written.
const EDITABLE_FIELDS = [
  "name",
  "description",
  "origin_country",
  "category",
  "price_inr",
  "stock_quantity",
  "gst_rate",
  "image_url",
];

async function listProducts() {
  const { rows } = await query("SELECT * FROM products ORDER BY created_at DESC");
  return rows;
}

async function getProduct(id) {
  const { rows } = await query("SELECT * FROM products WHERE id = $1", [id]);
  return rows[0] || null;
}

async function createProduct(fields) {
  const { name, description, origin_country, category, price_inr } = fields;
  if (!name || !description || !origin_country || !category || price_inr == null) {
    throw new ProductError("name, description, origin_country, category, and price_inr are required");
  }
  const { rows } = await query(
    `INSERT INTO products (name, description, origin_country, category, price_inr, stock_quantity, gst_rate, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      name,
      description,
      origin_country,
      category,
      price_inr,
      fields.stock_quantity ?? 0,
      fields.gst_rate ?? 0.18,
      fields.image_url ?? null,
    ]
  );
  return rows[0];
}

// Partial update - only the whitelisted fields actually present in
// `fields` are changed, everything else on the row is left as-is.
async function updateProduct(id, fields) {
  const keys = Object.keys(fields).filter((k) => EDITABLE_FIELDS.includes(k));
  if (keys.length === 0) throw new ProductError("No editable fields provided");

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = keys.map((k) => fields[k]);
  const { rows } = await query(`UPDATE products SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...values]);
  if (!rows[0]) throw new ProductError("Product not found", 404);
  return rows[0];
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, ProductError };
