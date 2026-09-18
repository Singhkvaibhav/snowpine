const rateLimit = require("express-rate-limit");

// In-memory store - fine for a single API instance (no queue/worker/Redis
// exists at this scale, see docker-compose.yml). If this ever runs as
// multiple instances behind a load balancer, each instance counts
// separately, so the effective limit multiplies by instance count - swap
// in a shared store (e.g. rate-limit-redis, the pattern ParentOS already
// uses) before scaling horizontally.

// Captured once at module load, not re-read per request: the test suite
// places far more than 10 orders across its own test cases (that's the
// point - it's testing order-creation logic, not this limiter), and
// without this every test file after the first ~10 order-creation calls
// would start failing with 429 instead of the status it's actually
// asserting. The limiter's real blocking behavior is covered directly in
// tests/rateLimit.test.js instead, via an isolated module load that
// captures this as false.
const SKIP_IN_TESTS = process.env.NODE_ENV === "test";

// Order creation decrements real stock immediately, before payment (see
// the reservation-TTL note in ordersService.js) - without a limit here,
// someone could hammer this endpoint faster than the 30-minute sweep
// releases abandoned reservations, keeping real inventory pinned as
// unpayable "pending" orders indefinitely.
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => SKIP_IN_TESTS,
  message: { error: "Too many orders placed from this network - please try again later." },
});

// The admin token is long/random enough that brute force is already
// impractical, but this costs nothing and slows down any attempt anyway.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => SKIP_IN_TESTS,
  message: { error: "Too many admin requests from this network - please try again later." },
});

// A real password brute-force target, unlike the admin token (which is
// long/random and never entered through a public form) - login attempts
// specifically, since signup creating many accounts is a lesser concern
// already bounded by needing a unique email per account.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => SKIP_IN_TESTS,
  message: { error: "Too many attempts from this network - please try again later." },
});

module.exports = { orderLimiter, adminLimiter, authLimiter };
