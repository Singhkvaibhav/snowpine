const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const { adminLimiter } = require("../middleware/rateLimit");
const { listOrders, updateOrderStatus, OrderError } = require("../services/ordersService");
const { listProducts, createProduct, updateProduct, ProductError } = require("../services/productsService");

const router = express.Router();
router.use(adminLimiter, adminAuth);

router.get("/orders", async (req, res) => {
  res.json(await listOrders());
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const order = await updateOrderStatus(req.params.id, req.body.status);
    res.json(order);
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.get("/products", async (req, res) => {
  res.json(await listProducts());
});

router.post("/products", async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.status(201).json(product);
  } catch (e) {
    if (e instanceof ProductError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.patch("/products/:id", async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (e) {
    if (e instanceof ProductError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

module.exports = router;
