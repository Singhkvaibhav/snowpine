const express = require("express");
const { requireCustomerAuth } = require("../middleware/customerAuth");
const { listWishlist, addToWishlist, removeFromWishlist, WishlistError } = require("../services/wishlistService");

// Every route here requires a logged-in customer - there's no guest
// wishlist (see the migration's comment for why), so there's nothing to
// gate individually per-route.
const router = express.Router();
router.use(requireCustomerAuth);

router.get("/", async (req, res) => {
  res.json(await listWishlist(req.customer.id));
});

router.post("/:productId", async (req, res) => {
  try {
    await addToWishlist(req.customer.id, req.params.productId);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e instanceof WishlistError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.delete("/:productId", async (req, res) => {
  await removeFromWishlist(req.customer.id, req.params.productId);
  res.json({ ok: true });
});

module.exports = router;
