const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // set by tests/setupEnv.js

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

describe("admin auth", () => {
  test("rejects with no token header", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  test("rejects a wrong token", async () => {
    const res = await request(app).get("/api/admin/orders").set("x-admin-token", "wrong");
    expect(res.status).toBe(401);
  });

  test("accepts the correct token", async () => {
    const res = await request(app).get("/api/admin/orders").set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(200);
  });

  // ADMIN_TOKEN is read once at middleware/adminAuth.js's module load, so
  // testing "unset" needs a fresh module registry with it actually unset -
  // not just deleted from process.env after the real app already captured
  // a value. Fails CLOSED: an operator who forgets to set this in
  // production must not end up with an open admin API by accident.
  test("fails closed (503) when ADMIN_TOKEN was never configured", async () => {
    let isolatedApp, isolatedPool;
    const original = process.env.ADMIN_TOKEN;
    jest.isolateModules(() => {
      // NOT `delete` - db.js's `require("dotenv").config()` only skips
      // keys that already exist in process.env, so deleting this would
      // let dotenv silently refill it from the real .env file the moment
      // any file in the fresh require chain loads dotenv, defeating the
      // whole point of this test. An empty string still "exists".
      process.env.ADMIN_TOKEN = "";
      isolatedApp = require("../server");
      isolatedPool = require("../db").pool; // isolated module registry -> its own separate pool
    });
    process.env.ADMIN_TOKEN = original;

    try {
      await isolatedApp.dbReady;
      const res = await request(isolatedApp).get("/api/admin/orders").set("x-admin-token", "anything");
      expect(res.status).toBe(503);
    } finally {
      // Not the same pool tests/teardown.js closes (that's the outer,
      // non-isolated registry's `../db`) - leaving this open is exactly
      // the kind of dangling handle that keeps Jest from exiting cleanly.
      await isolatedPool.end();
    }
  });
});

describe("admin order management", () => {
  test("lists orders newest first", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    await request(app)
      .post("/api/orders")
      .send({
        customerName: "A",
        customerEmail: "a@example.com",
        customerPhone: "9000000001",
        shippingAddress: "x",
        items: [{ productId: product.id, quantity: 1 }],
      });
    await request(app)
      .post("/api/orders")
      .send({
        customerName: "B",
        customerEmail: "b@example.com",
        customerPhone: "9000000002",
        shippingAddress: "x",
        items: [{ productId: product.id, quantity: 1 }],
      });

    const res = await request(app).get("/api/admin/orders").set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].customer_email).toBe("b@example.com"); // most recent first
  });

  test("updates order status, and rejects an invalid status value", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const createRes = await request(app)
      .post("/api/orders")
      .send({
        customerName: "C",
        customerEmail: "c@example.com",
        customerPhone: "9000000003",
        shippingAddress: "x",
        items: [{ productId: product.id, quantity: 1 }],
      });

    const good = await request(app)
      .patch(`/api/admin/orders/${createRes.body.order.id}/status`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ status: "shipped" });
    expect(good.status).toBe(200);
    expect(good.body.status).toBe("shipped");

    const bad = await request(app)
      .patch(`/api/admin/orders/${createRes.body.order.id}/status`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ status: "not-a-real-status" });
    expect(bad.status).toBe(400);
  });

  test("404s updating a nonexistent order", async () => {
    const res = await request(app)
      .patch("/api/admin/orders/999999/status")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ status: "shipped" });
    expect(res.status).toBe(404);
  });

  // Regression test: the order confirmation email promises "we'll email
  // you again once it ships" - this is what actually keeps that promise.
  test("sends a shipped notification when marked shipped", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const product = await insertProduct({ stock_quantity: 10 });
      const createRes = await request(app)
        .post("/api/orders")
        .send({
          customerName: "Ship Test",
          customerEmail: "ship@example.com",
          customerPhone: "9000000009",
          shippingAddress: "x",
          items: [{ productId: product.id, quantity: 1 }],
        });

      await request(app)
        .patch(`/api/admin/orders/${createRes.body.order.id}/status`)
        .set("x-admin-token", ADMIN_TOKEN)
        .send({ status: "shipped" });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).toMatch(/has shipped/i);
      expect(logged).toMatch(/ship@example\.com/);
    } finally {
      logSpy.mockRestore();
    }
  });

  test("does not send a shipped email for any other status transition", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const product = await insertProduct({ stock_quantity: 10 });
      const createRes = await request(app)
        .post("/api/orders")
        .send({
          customerName: "No Ship Email",
          customerEmail: "noship@example.com",
          customerPhone: "9000000008",
          shippingAddress: "x",
          items: [{ productId: product.id, quantity: 1 }],
        });

      await request(app)
        .patch(`/api/admin/orders/${createRes.body.order.id}/status`)
        .set("x-admin-token", ADMIN_TOKEN)
        .send({ status: "cancelled" });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).not.toMatch(/has shipped/i);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("admin product management", () => {
  test("creates a product with sensible defaults", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ name: "New Item", description: "desc", origin_country: "Norway", category: "Home Decor", price_inr: 1999 });

    expect(res.status).toBe(201);
    expect(res.body.stock_quantity).toBe(0);
    expect(res.body.gst_rate).toBe("0.18");
  });

  test("rejects creating a product missing required fields", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ name: "Incomplete" });
    expect(res.status).toBe(400);
  });

  // Regression test: writes must go through a field whitelist, not a raw
  // pass-through of the request body - otherwise a client could set `id`
  // or any other column by just including it in the PATCH payload.
  test("ignores non-whitelisted fields like id, applies whitelisted ones", async () => {
    const product = await insertProduct({ price_inr: 1000, stock_quantity: 5 });

    const res = await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ id: 999999, price_inr: 1500, stock_quantity: 20 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(product.id); // NOT 999999
    expect(res.body.price_inr).toBe("1500.00");
    expect(res.body.stock_quantity).toBe(20);
  });

  test("404s updating a nonexistent product", async () => {
    const res = await request(app)
      .patch("/api/admin/products/999999")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ price_inr: 100 });
    expect(res.status).toBe(404);
  });

  test("rejects an update with no editable fields provided", async () => {
    const product = await insertProduct();
    const res = await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ id: 999999 }); // only a non-whitelisted field
    expect(res.status).toBe(400);
  });
});
