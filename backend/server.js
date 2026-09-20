require("dotenv").config();
require("express-async-errors");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { initDb } = require("./db");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");
const adminRouter = require("./routes/admin");
const authRouter = require("./routes/auth");
const wishlistRouter = require("./routes/wishlist");
const { handleWebhookEvent, sweepExpiredOrders, sendAbandonedCartReminders, OrderError } = require("./services/ordersService");
const { keyId: razorpayKeyId } = require("./razorpay");
const { assertValidConfig } = require("./configCheck");
const { listProducts } = require("./services/productsService");

// Before anything binds a port or touches the database: refuse to start
// on production config that isn't safe to run. Deliberately ahead of
// dbReady below, not inside it - unsafe config should fail instantly, not
// after a successful database connection makes startup look fine. A no-op
// outside NODE_ENV=production (see configCheck.js), so this runs
// unconditionally rather than only under the require.main guard further
// down, and is harmless when this file is required by the test suite.
assertValidConfig();

const app = express();
// Baseline security headers (X-Content-Type-Options, Referrer-Policy,
// etc.) - cheap and worth having even though this API only ever returns
// JSON. Not using helmet's CSP here: this process never serves the SPA's
// HTML (nginx does, from frontend/dist - see docker-compose.yml), so a
// CSP set on JSON responses would govern nothing real. The CSP that
// actually matters (allowing Razorpay's checkout script/iframe) lives in
// deploy/nginx/snowpine.conf, on the response that serves the real page.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean) }));
app.use(cookieParser());
// `verify` stashes the exact raw bytes Razorpay sent - the webhook
// signature is computed over those bytes, and a re-serialized JSON.parse
// -> JSON.stringify round trip is not guaranteed byte-identical.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
// key_id (unlike key_secret) is Razorpay's own public identifier, designed
// to be embedded in client-side code - safe to expose here. Lets the order-
// confirmation "Complete payment" retry (see OrderConfirmation.jsx) open
// the Razorpay widget without needing a fresh placeOrder() call.
app.get("/api/config", (req, res) => res.json({ razorpayKeyId: razorpayKeyId || null }));
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/auth", authRouter);
app.use("/api/wishlist", wishlistRouter);

// Served under /api/ (not at the site root) because this process never
// serves the SPA's static files - nginx does, from frontend/dist (see
// deploy/nginx/snowpine.conf) - so a root-level /sitemap.xml route here
// would never actually be reached in production. robots.txt declares
// this location explicitly via a Sitemap: directive, which search
// engines honor regardless of path. Generated from live product data on
// every request rather than at build time, so it's never stale - cheap
// enough at this catalog size (dozens, not thousands, of products) to
// not need caching.
app.get("/api/sitemap.xml", async (req, res) => {
  const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const products = await listProducts();
  const urls = [
    { loc: baseUrl, changefreq: "daily", priority: "1.0" },
    { loc: `${baseUrl}/shipping-returns`, changefreq: "monthly", priority: "0.3" },
    ...products.map((p) => ({
      loc: `${baseUrl}/product/${p.id}`,
      changefreq: "weekly",
      priority: "0.8",
    })),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
    ),
    "</urlset>",
  ].join("\n");
  res.set("Content-Type", "application/xml").send(body);
});

app.post("/api/webhooks/razorpay", async (req, res) => {
  try {
    await handleWebhookEvent(req.rawBody.toString(), req.get("x-razorpay-signature"));
    res.json({ received: true });
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Exported so the test suite can await it before making requests, rather
// than requiring a real network round-trip to Postgres on every test file
// load to just be a race no one's actually testing.
const dbReady = initDb();

const PORT = process.env.PORT || 4000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Only the process actually run directly (`node server.js`) binds a port
// or starts the sweep interval - required as a module (by tests, via
// supertest) it's just the Express app, so a test run doesn't leave a
// stray server listening on :4000 or an interval keeping Jest alive.
if (require.main === module) {
  dbReady
    .then(() => {
      app.listen(PORT, () => console.log(`Snowpine API listening on :${PORT}`));

      // No queue/worker process exists at this scale - an in-process
      // interval is enough to release abandoned checkout reservations
      // periodically. Logs and continues on failure rather than crashing
      // the API over a transient DB hiccup. Abandoned-cart reminders ride
      // the same interval - both are "look for pending orders in a
      // particular time window" sweeps, just with different windows and
      // different actions.
      setInterval(() => {
        sweepExpiredOrders().catch((e) => console.error("sweepExpiredOrders failed:", e));
        sendAbandonedCartReminders().catch((e) => console.error("sendAbandonedCartReminders failed:", e));
      }, SWEEP_INTERVAL_MS);
    })
    .catch((e) => {
      console.error("Failed to initialize database:", e);
      process.exit(1);
    });
}

module.exports = app;
module.exports.dbReady = dbReady;
