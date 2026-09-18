const express = require("express");
const { signup, login, logout, AuthError } = require("../services/customersService");
const { attachCustomerIfPresent, SESSION_COOKIE } = require("../middleware/customerAuth");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();
router.use(authLimiter);

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30;

const COOKIE_OPTIONS = {
  httpOnly: true,
  // Secure requires HTTPS - correctly off in local http:// dev, on once
  // deployed behind nginx's TLS termination (see deploy/nginx/snowpine.conf).
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
};

router.post("/signup", async (req, res) => {
  try {
    const { customer, session } = await signup(req.body);
    res.cookie(SESSION_COOKIE, session.token, COOKIE_OPTIONS);
    res.status(201).json({ customer });
  } catch (e) {
    if (e instanceof AuthError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.post("/login", async (req, res) => {
  try {
    const { customer, session } = await login(req.body);
    res.cookie(SESSION_COOKIE, session.token, COOKIE_OPTIONS);
    res.json({ customer });
  } catch (e) {
    if (e instanceof AuthError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

router.post("/logout", async (req, res) => {
  await logout(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

// A status check, not an authorization gate - always 200, with a null
// customer when logged out, so the frontend can silently probe "am I
// logged in?" on page load without treating that as an error.
router.get("/me", attachCustomerIfPresent, async (req, res) => {
  res.json({ customer: req.customer || null });
});

module.exports = router;
