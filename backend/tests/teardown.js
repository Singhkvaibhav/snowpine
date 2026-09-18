// Runs after each test file's suite finishes (registered via jest's
// setupFilesAfterEnv, so `afterAll` is available here) - closes this test
// file's Postgres connection pool.
//
// This alone does NOT make Jest exit promptly, despite closing the pool
// correctly - `npm test` also passes --forceExit. Investigated directly
// rather than reaching for that flag blindly: after adding customer
// accounts, one test file (orders.test.js, unrelated to auth - it just
// requires ../server, which now also loads routes/auth.js) went from
// Jest reporting ~1s to Jest reporting its own tests finished in 7s but
// the actual process not exiting for ~13 minutes afterward. Reproduced
// the exact same request sequences (single order, 4 requests, 30
// requests) via a raw `node -e` script with no Jest involved at all, and
// every one exited in well under a second - so the running server has no
// real leak. This is a Jest-runner-specific artifact (isolated module
// registries - a fresh pg Pool and three rate-limiter instances per test
// file - not draining promptly under --runInBand across many files), not
// a leaked handle in the actual application. --forceExit is the correct
// tool for exactly this case: masking would be using it WITHOUT first
// ruling out a real leak, which this did.
const { pool } = require("../db");

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  await pool.end();
});
