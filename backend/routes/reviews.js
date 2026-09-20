const express = require("express");
const { requireCustomerAuth } = require("../middleware/customerAuth");
const {
  listReviewsForProduct,
  getMyReview,
  canReview,
  upsertReview,
  deleteReview,
  ReviewError,
} = require("../services/reviewsService");

const router = express.Router();

// Public - anyone browsing the product should see its reviews without
// needing to be logged in.
router.get("/product/:productId", async (req, res) => {
  res.json(await listReviewsForProduct(req.params.productId));
});

// Gated: tells the logged-in customer whether they're eligible to review
// (a verified purchase) and, if they've already reviewed, their existing
// review to prefill an edit form with - two things the write endpoint
// below needs the frontend to already know before showing a form at all.
router.get("/product/:productId/me", requireCustomerAuth, async (req, res) => {
  const [eligible, review] = await Promise.all([
    canReview(req.customer.id, req.params.productId),
    getMyReview(req.customer.id, req.params.productId),
  ]);
  res.json({ eligible, review });
});

router.post("/product/:productId", requireCustomerAuth, async (req, res) => {
  try {
    const review = await upsertReview(req.customer.id, req.params.productId, req.body);
    res.status(201).json(review);
  } catch (e) {
    if (e instanceof ReviewError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.delete("/product/:productId", requireCustomerAuth, async (req, res) => {
  await deleteReview(req.customer.id, req.params.productId);
  res.json({ ok: true });
});

module.exports = router;
