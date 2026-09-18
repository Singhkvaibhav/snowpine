const request = require("supertest");
const express = require("express");

// middleware/rateLimit.js captures `SKIP_IN_TESTS = NODE_ENV === "test"`
// ONCE at module load specifically so the rest of the suite (which places
// far more than 10 orders across its own tests) doesn't trip this limiter.
// To actually test the limiter's real blocking behavior, load a copy of
// the module in an isolated registry with NODE_ENV flipped for just that
// require call - the boolean it captures is real, and restoring NODE_ENV
// immediately after doesn't undo it (it's baked into that module instance,
// not re-read per request).
function loadLiveLimiters() {
  let limiters;
  const original = process.env.NODE_ENV;
  jest.isolateModules(() => {
    process.env.NODE_ENV = "production";
    limiters = require("../middleware/rateLimit");
  });
  process.env.NODE_ENV = original;
  return limiters;
}

function appWith(limiter) {
  const app = express();
  app.get("/thing", limiter, (req, res) => res.json({ ok: true }));
  return app;
}

describe("rate limiting (live, unskipped instance)", () => {
  test("orderLimiter allows up to its configured limit, then blocks", async () => {
    const { orderLimiter } = loadLiveLimiters();
    const app = appWith(orderLimiter);

    for (let i = 0; i < 10; i++) {
      const res = await request(app).get("/thing");
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get("/thing");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many orders/i);
  });

  test("adminLimiter allows up to its configured limit, then blocks", async () => {
    const { adminLimiter } = loadLiveLimiters();
    const app = appWith(adminLimiter);

    for (let i = 0; i < 60; i++) {
      const res = await request(app).get("/thing");
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get("/thing");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many admin/i);
  });

  test("skips limiting entirely when required normally (NODE_ENV=test)", async () => {
    const { orderLimiter } = require("../middleware/rateLimit");
    const app = appWith(orderLimiter);

    for (let i = 0; i < 15; i++) {
      const res = await request(app).get("/thing");
      expect(res.status).toBe(200);
    }
  });
});
