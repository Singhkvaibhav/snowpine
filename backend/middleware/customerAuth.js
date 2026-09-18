const { getCustomerBySession } = require("../services/customersService");

const SESSION_COOKIE = "snowpine_session";

// Required on routes that only make sense for a logged-in customer
// (My Orders). 401s with no session or an expired/revoked one.
async function requireCustomerAuth(req, res, next) {
  const customer = await getCustomerBySession(req.cookies?.[SESSION_COOKIE]);
  if (!customer) return res.status(401).json({ error: "Not signed in" });
  req.customer = customer;
  next();
}

// Used on checkout (POST /api/orders) and order lookup (GET /api/orders/:id)
// - a logged-in customer gets their order auto-linked to their account /
// gets session-based access to their own orders, but guest checkout with
// no session at all must keep working exactly as before, so this never
// rejects a request - it only optionally attaches req.customer.
async function attachCustomerIfPresent(req, res, next) {
  req.customer = await getCustomerBySession(req.cookies?.[SESSION_COOKIE]);
  next();
}

module.exports = { requireCustomerAuth, attachCustomerIfPresent, SESSION_COOKIE };
