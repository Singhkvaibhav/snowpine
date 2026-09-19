const { query, withTransaction } = require("../db");

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
  "reorder_point",
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
    `INSERT INTO products (name, description, origin_country, category, price_inr, stock_quantity, gst_rate, image_url, reorder_point)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      name,
      description,
      origin_country,
      category,
      price_inr,
      fields.stock_quantity ?? 0,
      fields.gst_rate ?? 0.18,
      fields.image_url ?? null,
      fields.reorder_point ?? 5,
    ]
  );
  return rows[0];
}

// Partial update - only the whitelisted fields actually present in
// `fields` are changed, everything else on the row is left as-is. When
// stock_quantity is one of them, the change is logged to stock_movements
// as an 'admin_adjustment' - manual corrections (stock take, damaged
// item, correcting a mistake) need to show up in the same audit trail as
// order-driven changes, or the trail is useless for reconstructing why a
// product is at whatever quantity it's at.
async function updateProduct(id, fields) {
  const keys = Object.keys(fields).filter((k) => EDITABLE_FIELDS.includes(k));
  if (keys.length === 0) throw new ProductError("No editable fields provided");

  let beforeSnapshot;
  const updated = await withTransaction(async (tx) => {
    const { rows: before } = await tx("SELECT stock_quantity, reorder_point FROM products WHERE id = $1 FOR UPDATE", [
      id,
    ]);
    if (!before[0]) throw new ProductError("Product not found", 404);
    beforeSnapshot = before[0];

    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const values = keys.map((k) => fields[k]);
    const { rows } = await tx(`UPDATE products SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...values]);
    const updatedRow = rows[0];

    if (keys.includes("stock_quantity")) {
      const delta = updatedRow.stock_quantity - beforeSnapshot.stock_quantity;
      if (delta !== 0) {
        await tx("INSERT INTO stock_movements (product_id, delta, reason) VALUES ($1, $2, 'admin_adjustment')", [
          id,
          delta,
        ]);
      }
    }

    return updatedRow;
  });

  // Outside the transaction (network call, must not hold the row lock),
  // and only when this specific edit changed stock - a price/name edit on
  // an already-low product must not re-trigger the alert.
  if (keys.includes("stock_quantity")) {
    await maybeSendLowStockAlert(beforeSnapshot, updated);
  }

  return updated;
}

// Fires only on the crossing INTO low stock (was above reorder_point,
// now at or below it) - not on every change to an already-low product,
// which would spam this on every sale of a slow-moving item instead of
// once when it actually first needs attention.
async function maybeSendLowStockAlert(before, after) {
  const wasHealthy = before.stock_quantity > before.reorder_point;
  const isLowNow = after.stock_quantity <= after.reorder_point;
  if (!wasHealthy || !isLowNow) return;

  try {
    const { sendLowStockAlert } = require("../email");
    await sendLowStockAlert(after);
  } catch (e) {
    console.error(`Failed to send low-stock alert for product ${after.id}:`, e);
  }
}

async function getLowStockProducts() {
  const { rows } = await query(
    "SELECT * FROM products WHERE stock_quantity <= reorder_point ORDER BY stock_quantity ASC"
  );
  return rows;
}

async function getStockMovements(productId = null, limit = 100) {
  const params = productId ? [productId, limit] : [limit];
  const whereClause = productId ? "WHERE sm.product_id = $1" : "";
  const { rows } = await query(
    `SELECT sm.*, p.name AS product_name
     FROM stock_movements sm JOIN products p ON p.id = sm.product_id
     ${whereClause}
     ORDER BY sm.created_at DESC
     LIMIT $${productId ? 2 : 1}`,
    params
  );
  return rows;
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  getLowStockProducts,
  getStockMovements,
  maybeSendLowStockAlert,
  ProductError,
};
