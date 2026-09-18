const express = require("express");
const { listProducts, getProduct } = require("../services/productsService");

const router = express.Router();

router.get("/", async (req, res) => {
  res.json(await listProducts());
});

router.get("/:id", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

module.exports = router;
