const express = require("express");
const {
  createOrder,
  attachRazorpayOrder,
  verifyPayment,
  getOrderForCustomer,
  listOrdersForCustomer,
  OrderError,
} = require("../services/ordersService");
const { orderLimiter } = require("../middleware/rateLimit");
const { attachCustomerIfPresent, requireCustomerAuth } = require("../middleware/customerAuth");

const router = express.Router();

// attachCustomerIfPresent never rejects an unauthenticated request - guest
// checkout must keep working exactly as before. A logged-in customer's
// order is auto-linked to their account (see createOrder's customerId
// param) purely as a bonus, not a requirement.
router.post("/", orderLimiter, attachCustomerIfPresent, async (req, res) => {
  try {
    const order = await createOrder(req.body, req.customer?.id ?? null);
    const withPayment = await attachRazorpayOrder(order);
    res.status(201).json(withPayment);
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.post("/:id/verify-payment", async (req, res) => {
  try {
    const order = await verifyPayment(req.params.id, req.body);
    res.json(order);
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

// A logged-in customer's own account - lists only orders linked to their
// customer_id, which only ever happens for orders THEY placed while
// logged in (see POST / above) - never another customer's.
router.get("/mine", requireCustomerAuth, async (req, res) => {
  res.json(await listOrdersForCustomer(req.customer.id));
});

// Requires EITHER ?token=<access_token> OR a logged-in session for the
// account this order belongs to - never just the (sequential, guessable)
// id. See getOrderForCustomer. The admin API (routes/admin.js) uses the
// separate unrestricted getOrder/listOrders, gated by adminAuth instead.
router.get("/:id", attachCustomerIfPresent, async (req, res) => {
  const order = await getOrderForCustomer(req.params.id, req.query.token, req.customer?.id ?? null);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

module.exports = router;
