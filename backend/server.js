require("dotenv").config();
require("express-async-errors");
const express = require("express");
const cors = require("cors");
const { initDb } = require("./db");
const productsRouter = require("./routes/products");

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean) }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/products", productsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Snowpine API listening on :${PORT}`));
  })
  .catch((e) => {
    console.error("Failed to initialize database:", e);
    process.exit(1);
  });
