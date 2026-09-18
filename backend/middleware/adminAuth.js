// Deliberately minimal - a single shared-secret header, not a full user/
// auth system, since there's exactly one operator (the store owner) and
// no multi-user admin needs yet. Fails CLOSED: with no ADMIN_TOKEN set,
// every admin request is rejected rather than left open to the internet.
// Replace with real auth before adding a second admin user.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

module.exports = function adminAuth(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: "Admin API not configured (ADMIN_TOKEN unset)" });
  if (req.get("x-admin-token") !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
};
