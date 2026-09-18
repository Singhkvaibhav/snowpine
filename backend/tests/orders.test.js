const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const validCustomer = {
  customerName: "Priya Sharma",
  customerEmail: "priya@example.com",
  customerPhone: "9876543210",
  shippingAddress: "12 MG Road, Bangalore",
};

describe("POST /api/orders", () => {
  test("computes the total server-side from real product prices, not client input", async () => {
    const p1 = await insertProduct({ name: "Carrier", price_inr: 14099, stock_quantity: 10 });
    const p2 = await insertProduct({ name: "Bowl", price_inr: 4399, stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        ...validCustomer,
        items: [
          { productId: p1.id, quantity: 1 },
          { productId: p2.id, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    // 14099 + 2*4399 = 22897, not whatever a client might have sent.
    expect(res.body.order.total_inr).toBe("22897.00");
    expect(res.body.order.status).toBe("pending");
    expect(res.body.order.access_token).toEqual(expect.any(String));
    expect(res.body.razorpayOrderId).toBeNull(); // Razorpay unconfigured in tests
  });

  test("decrements stock by the ordered quantity", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    await request(app).post("/api/orders").send({ ...validCustomer, items: [{ productId: product.id, quantity: 3 }] });

    const res = await request(app).get(`/api/products/${product.id}`);
    expect(res.body.stock_quantity).toBe(7);
  });

  test("rejects an order for more than available stock, without changing stock", async () => {
    const product = await insertProduct({ stock_quantity: 2 });
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, items: [{ productId: product.id, quantity: 3 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough stock/i);

    const productRes = await request(app).get(`/api/products/${product.id}`);
    expect(productRes.body.stock_quantity).toBe(2);
  });

  test("404s for a nonexistent product", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, items: [{ productId: 999999, quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  test.each([
    ["customerName", { customerName: "" }],
    ["customerEmail", { customerEmail: "" }],
    ["customerPhone", { customerPhone: "" }],
    ["shippingAddress", { shippingAddress: "" }],
  ])("requires %s", async (_field, override) => {
    const product = await insertProduct();
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, ...override, items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  test("rejects an empty items array", async () => {
    const res = await request(app).post("/api/orders").send({ ...validCustomer, items: [] });
    expect(res.status).toBe(400);
  });

  test("rejects a malformed email even though the field is non-empty", async () => {
    const product = await insertProduct();
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, customerEmail: "not-an-email", items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  test("rejects a malformed phone number", async () => {
    const product = await insertProduct();
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, customerPhone: "abc", items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone/i);
  });
});

describe("GST tax breakdown on an order", () => {
  test("derives taxable value and GST amount backward from GST-inclusive price", async () => {
    const product = await insertProduct({ price_inr: 4399, gst_rate: 0.05 });
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, items: [{ productId: product.id, quantity: 1 }] });
    const { id, access_token } = createRes.body.order;

    const res = await request(app).get(`/api/orders/${id}?token=${access_token}`);
    expect(res.status).toBe(200);
    const item = res.body.items[0];
    expect(item.taxable_value).toBeCloseTo(4399 / 1.05, 5);
    expect(item.gst_amount).toBeCloseTo(4399 - 4399 / 1.05, 5);
    expect(item.taxable_value + item.gst_amount).toBeCloseTo(4399, 5);
  });

  test("handles multiple items at different GST rates independently", async () => {
    const tableware = await insertProduct({ price_inr: 4399, gst_rate: 0.05 });
    const carrier = await insertProduct({ price_inr: 14099, gst_rate: 0.18 });
    const createRes = await request(app)
      .post("/api/orders")
      .send({
        ...validCustomer,
        items: [
          { productId: tableware.id, quantity: 1 },
          { productId: carrier.id, quantity: 1 },
        ],
      });
    const { id, access_token } = createRes.body.order;

    const res = await request(app).get(`/api/orders/${id}?token=${access_token}`);
    const byId = Object.fromEntries(res.body.items.map((i) => [i.product_id, i]));
    expect(Number(byId[tableware.id].gst_rate)).toBeCloseTo(0.05);
    expect(Number(byId[carrier.id].gst_rate)).toBeCloseTo(0.18);
  });
});

describe("GET /api/orders/:id access control", () => {
  // Order ids are sequential integers - trivially guessable. Without a
  // matching access token, this must not leak any customer's order, since
  // it carries name/email/phone/address (see ordersService.getOrderForCustomer).
  test("404s with no token", async () => {
    const product = await insertProduct();
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, items: [{ productId: product.id, quantity: 1 }] });

    const res = await request(app).get(`/api/orders/${createRes.body.order.id}`);
    expect(res.status).toBe(404);
  });

  test("404s with the wrong token", async () => {
    const product = await insertProduct();
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, items: [{ productId: product.id, quantity: 1 }] });

    const res = await request(app).get(`/api/orders/${createRes.body.order.id}?token=wrong-token`);
    expect(res.status).toBe(404);
  });

  test("succeeds with the correct token", async () => {
    const product = await insertProduct();
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, items: [{ productId: product.id, quantity: 1 }] });
    const { id, access_token } = createRes.body.order;

    const res = await request(app).get(`/api/orders/${id}?token=${access_token}`);
    expect(res.status).toBe(200);
    expect(res.body.customer_email).toBe(validCustomer.customerEmail);
  });

  test("404s for a nonexistent order id even with a token supplied", async () => {
    const res = await request(app).get("/api/orders/999999?token=anything");
    expect(res.status).toBe(404);
  });
});
