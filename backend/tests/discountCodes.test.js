const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");
const { query } = require("../db");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // set by tests/setupEnv.js

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

async function createCode(fields) {
  const res = await request(app)
    .post("/api/admin/discount-codes")
    .set("x-admin-token", ADMIN_TOKEN)
    .send(fields);
  return res;
}

describe("admin discount code management", () => {
  test("creates a code, normalizing it to uppercase", async () => {
    const res = await createCode({ code: "launch10", type: "percent", value: 10 });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe("LAUNCH10");
    expect(res.body.active).toBe(true);
    expect(res.body.uses_count).toBe(0);
  });

  test("rejects a percent value over 100", async () => {
    const res = await createCode({ code: "TOOBIG", type: "percent", value: 150 });
    expect(res.status).toBe(400);
  });

  test("rejects a duplicate code (case-insensitively)", async () => {
    await createCode({ code: "WINTER", type: "flat", value: 500 });
    const res = await createCode({ code: "winter", type: "flat", value: 200 });
    expect(res.status).toBe(409);
  });

  test("requires admin auth", async () => {
    const res = await request(app).post("/api/admin/discount-codes").send({ code: "X", type: "flat", value: 1 });
    expect(res.status).toBe(401);
  });

  test("lists and can deactivate a code", async () => {
    const created = await createCode({ code: "PAUSEME", type: "flat", value: 100 });
    const patchRes = await request(app)
      .patch(`/api/admin/discount-codes/${created.body.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ active: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.active).toBe(false);

    const listRes = await request(app).get("/api/admin/discount-codes").set("x-admin-token", ADMIN_TOKEN);
    expect(listRes.body.find((c) => c.id === created.body.id).active).toBe(false);
  });
});

describe("applying a discount code at checkout", () => {
  test("a flat code reduces the total and is recorded on the order", async () => {
    await createCode({ code: "FLAT500", type: "flat", value: 500 });
    const product = await insertProduct({ price_inr: 4399, stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "flat500", items: [{ productId: product.id, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.order.total_inr).toBe("3899.00");
    expect(res.body.order.discount_code).toBe("FLAT500");
    expect(res.body.order.discount_amount_inr).toBe("500.00");
  });

  test("a percent code applies to the subtotal across multiple items", async () => {
    await createCode({ code: "TEN", type: "percent", value: 10 });
    const p1 = await insertProduct({ price_inr: 1000, stock_quantity: 10 });
    const p2 = await insertProduct({ price_inr: 2000, stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        ...validCustomer,
        discountCode: "TEN",
        items: [
          { productId: p1.id, quantity: 1 },
          { productId: p2.id, quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    // subtotal 3000, 10% off = 300
    expect(res.body.order.total_inr).toBe("2700.00");
    expect(res.body.order.discount_amount_inr).toBe("300.00");
  });

  test("a flat code never discounts past zero", async () => {
    await createCode({ code: "HUGE", type: "flat", value: 99999 });
    const product = await insertProduct({ price_inr: 1000, stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "HUGE", items: [{ productId: product.id, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.order.total_inr).toBe("0.00");
    expect(res.body.order.discount_amount_inr).toBe("1000.00");
  });

  test("rejects an unknown code without leaking whether it exists", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "NOPE", items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  test("rejects a deactivated code", async () => {
    const created = await createCode({ code: "OFFNOW", type: "flat", value: 100 });
    await request(app)
      .patch(`/api/admin/discount-codes/${created.body.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ active: false });
    const product = await insertProduct({ stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "OFFNOW", items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  test("rejects an expired code", async () => {
    await createCode({ code: "OLDONE", type: "flat", value: 100 });
    await query("UPDATE discount_codes SET expires_at = now() - interval '1 day' WHERE code = 'OLDONE'");
    const product = await insertProduct({ stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "OLDONE", items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  test("enforces max_uses across separate orders and does not consume a use on a failed order", async () => {
    const created = await createCode({ code: "ONLYONE", type: "flat", value: 100, max_uses: 1 });
    const p1 = await insertProduct({ stock_quantity: 10 });
    const p2 = await insertProduct({ stock_quantity: 10 });

    const first = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "ONLYONE", items: [{ productId: p1.id, quantity: 1 }] });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "ONLYONE", items: [{ productId: p2.id, quantity: 1 }] });
    expect(second.status).toBe(400);

    const { rows } = await query("SELECT uses_count FROM discount_codes WHERE id = $1", [created.body.id]);
    expect(rows[0].uses_count).toBe(1); // not 2 - the second (rejected) attempt didn't consume a use
  });

  test("enforces a minimum order value and does not consume a use when it's not met", async () => {
    const created = await createCode({ code: "BIGORDER", type: "flat", value: 100, min_order_inr: 5000 });
    const product = await insertProduct({ price_inr: 1000, stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "BIGORDER", items: [{ productId: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minimum order/i);

    const { rows } = await query("SELECT uses_count FROM discount_codes WHERE id = $1", [created.body.id]);
    expect(rows[0].uses_count).toBe(0);
  });

  test("does not decrement stock or create an order when the code is invalid", async () => {
    const product = await insertProduct({ stock_quantity: 5 });
    await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "GARBAGE", items: [{ productId: product.id, quantity: 1 }] });

    const productRes = await request(app).get(`/api/products/${product.id}`);
    expect(productRes.body.stock_quantity).toBe(5);

    const { rows } = await query("SELECT id FROM orders WHERE customer_email = $1", [validCustomer.customerEmail]);
    expect(rows).toHaveLength(0);
  });

  test("the discount is reflected pro-rata in the order's GST breakdown", async () => {
    await createCode({ code: "HALFOFF", type: "percent", value: 50 });
    const product = await insertProduct({ price_inr: 1180, gst_rate: 0.18, stock_quantity: 10 });

    const placeRes = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, discountCode: "HALFOFF", items: [{ productId: product.id, quantity: 1 }] });

    const orderId = placeRes.body.order.id;
    const getRes = await request(app).get(`/api/orders/${orderId}?token=${placeRes.body.order.access_token}`);
    expect(getRes.status).toBe(200);
    // Full price 1180 (taxable 1000 + GST 180). 50% off -> line_total 590,
    // taxable 500, GST 90 - not the pre-discount 1000/180.
    expect(getRes.body.items[0].line_total).toBeCloseTo(590);
    expect(getRes.body.items[0].taxable_value).toBeCloseTo(500);
    expect(getRes.body.items[0].gst_amount).toBeCloseTo(90);
    expect(getRes.body.subtotal_inr).toBe(1180);
  });

  test("no discount fields at all when no code is used", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const res = await request(app)
      .post("/api/orders")
      .send({ ...validCustomer, items: [{ productId: product.id, quantity: 1 }] });
    expect(res.body.order.discount_code).toBeNull();
    expect(res.body.order.discount_amount_inr).toBe("0.00");
  });
});
