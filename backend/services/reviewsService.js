const { query } = require("../db");

class ReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// A review is only meaningful as a verified purchase. Any of these
// statuses necessarily passed through "delivered" first per the order
// state machine (delivered -> return_requested -> returned -> refunded -
// see ordersService.js), so checking the CURRENT status alone is enough
// to know the item was actually received at some point, without needing
// to keep a separate history of past statuses.
const REVIEW_ELIGIBLE_STATUSES = ["delivered", "return_requested", "returned", "refunded"];

async function canReview(customerId, productId) {
  const { rows } = await query(
    `SELECT 1 FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = $1 AND oi.product_id = $2 AND o.status = ANY($3)
     LIMIT 1`,
    [customerId, productId, REVIEW_ELIGIBLE_STATUSES]
  );
  return rows.length > 0;
}

// "Priya Sharma" -> "Priya S." - a full legal name entered at signup is
// more exposure than a public review needs; every major storefront
// truncates to first name + last initial for exactly this reason.
function displayName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

async function listReviewsForProduct(productId) {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.body, r.created_at, r.updated_at, c.name AS customer_name
     FROM reviews r JOIN customers c ON c.id = r.customer_id
     WHERE r.product_id = $1
     ORDER BY r.created_at DESC`,
    [productId]
  );
  return rows.map((r) => ({ ...r, customer_name: displayName(r.customer_name) }));
}

async function getMyReview(customerId, productId) {
  const { rows } = await query("SELECT * FROM reviews WHERE customer_id = $1 AND product_id = $2", [
    customerId,
    productId,
  ]);
  return rows[0] || null;
}

// Upsert, not create-only - a customer editing their opinion after the
// fact (a slow-forming defect, or just changing their mind) should
// update their existing review, not be blocked by the UNIQUE constraint
// or end up with two rows for the same product.
async function upsertReview(customerId, productId, { rating, body }) {
  if (!Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
    throw new ReviewError("rating must be a whole number from 1 to 5");
  }
  if (!body || !body.trim()) {
    throw new ReviewError("Review text is required");
  }

  const eligible = await canReview(customerId, productId);
  if (!eligible) {
    throw new ReviewError("You can only review products from an order that's been delivered to you", 403);
  }

  const { rows } = await query(
    `INSERT INTO reviews (product_id, customer_id, rating, body)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (customer_id, product_id)
     DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = now()
     RETURNING *`,
    [productId, customerId, rating, body.trim()]
  );
  return rows[0];
}

async function deleteReview(customerId, productId) {
  await query("DELETE FROM reviews WHERE customer_id = $1 AND product_id = $2", [customerId, productId]);
}

module.exports = {
  canReview,
  listReviewsForProduct,
  getMyReview,
  upsertReview,
  deleteReview,
  ReviewError,
};
