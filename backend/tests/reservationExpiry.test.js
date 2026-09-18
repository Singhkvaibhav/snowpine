const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");
const { query } = require("../db");
const { sweepExpiredOrders } = require("../services/ordersService");

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const customer = {
  customerName: "Test Expiry",
  customerEmail: "expiry@example.com",
  customerPhone: "9000000000",
  shippingAddress: "Test address",
};

describe("sweepExpiredOrders", () => {
  // Stock decrements at order creation, before payment - without this
  // sweep, an abandoned checkout (widget closed, tab crashed) would hold
  // that stock hostage forever as an unpayable "pending" order.
  test("releases stock and removes a pending order past its reservation window", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...customer, items: [{ productId: product.id, quantity: 3 }] });
    const orderId = createRes.body.order.id;

    // Backdate expiry to simulate an abandoned reservation.
    await query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [orderId]);

    const swept = await sweepExpiredOrders();
    expect(swept).toBe(1);

    const productRes = await request(app).get(`/api/products/${product.id}`);
    expect(productRes.body.stock_quantity).toBe(10); // fully restored

    const { rows } = await query("SELECT id FROM orders WHERE id = $1", [orderId]);
    expect(rows).toHaveLength(0);
  });

  test("leaves a not-yet-expired pending order untouched", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...customer, items: [{ productId: product.id, quantity: 3 }] });
    const orderId = createRes.body.order.id;

    const swept = await sweepExpiredOrders();
    expect(swept).toBe(0);

    const { rows } = await query("SELECT id, status FROM orders WHERE id = $1", [orderId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");

    const productRes = await request(app).get(`/api/products/${product.id}`);
    expect(productRes.body.stock_quantity).toBe(7); // still reserved
  });

  test("never touches a paid order, even if its expiry has passed", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...customer, items: [{ productId: product.id, quantity: 1 }] });
    const orderId = createRes.body.order.id;

    await query("UPDATE orders SET status = 'paid', expires_at = now() - interval '1 minute' WHERE id = $1", [orderId]);

    const swept = await sweepExpiredOrders();
    expect(swept).toBe(0);

    const { rows } = await query("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(rows[0].status).toBe("paid");
  });
});
