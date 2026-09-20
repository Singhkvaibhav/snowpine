const { query } = require("../db");

class WishlistError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function listWishlist(customerId) {
  const { rows } = await query(
    `SELECT p.* FROM wishlist_items w
     JOIN products p ON p.id = w.product_id
     WHERE w.customer_id = $1
     ORDER BY w.created_at DESC`,
    [customerId]
  );
  return rows;
}

// Idempotent (ON CONFLICT DO NOTHING) rather than erroring on an
// already-saved product - a heart-icon toggle button in the UI can't
// cleanly distinguish "already saved" from a genuine double-click race,
// and neither case should surface as a user-facing error.
async function addToWishlist(customerId, productId) {
  const { rows } = await query("SELECT id FROM products WHERE id = $1", [productId]);
  if (!rows[0]) throw new WishlistError("Product not found", 404);

  await query(
    `INSERT INTO wishlist_items (customer_id, product_id) VALUES ($1, $2)
     ON CONFLICT (customer_id, product_id) DO NOTHING`,
    [customerId, productId]
  );
}

// Removing something not on the list is a no-op, not an error - same
// idempotency reasoning as addToWishlist.
async function removeFromWishlist(customerId, productId) {
  await query("DELETE FROM wishlist_items WHERE customer_id = $1 AND product_id = $2", [customerId, productId]);
}

module.exports = { listWishlist, addToWishlist, removeFromWishlist, WishlistError };
