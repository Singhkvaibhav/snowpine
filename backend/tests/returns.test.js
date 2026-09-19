// Returns/refunds are a state machine (delivered -> return_requested ->
// returned -> refunded), each transition its own admin action rather than
// a generic status PATCH - see ordersService.js. Razorpay is mocked so
// refund behavior is deterministic and doesn't hit the network.
process.env.RAZORPAY_KEY_ID = "rzp_test_fake";
process.env.RAZORPAY_KEY_SECRET = "fake_secret";

const mockRefund = jest.fn().mockResolvedValue({ id: "rfnd_fake_1" });
jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn().mockImplementation(async () => ({ id: "order_fake_1" })) },
    payments: { refund: mockRefund },
  }))
);

const crypto = require("crypto");
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
  mockRefund.mockClear();
});

const customer = {
  customerName: "Return Test",
  customerEmail: "returns@example.com",
  customerPhone: "9444444444",
  shippingAddress: "Test address",
};

function sign(razorpayOrderId, razorpayPaymentId) {
  return crypto
    .createHmac("sha256", "fake_secret")
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

// Drives a fresh order all the way to "delivered" through the real
// checkout + payment + admin-status-update paths, exactly like a genuine
// order would get there, rather than inserting a pre-baked row.
async function placeDeliveredOrder(product, quantity = 1) {
  const placeRes = await request(app)
    .post("/api/orders")
    .send({ ...customer, items: [{ productId: product.id, quantity }] });
  const { order, razorpayOrderId } = placeRes.body;

  const razorpay_payment_id = "pay_fake_return_1";
  await request(app)
    .post(`/api/orders/${order.id}/verify-payment`)
    .send({
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id,
      razorpay_signature: sign(razorpayOrderId, razorpay_payment_id),
    });

  await request(app)
    .patch(`/api/admin/orders/${order.id}/status`)
    .set("x-admin-token", ADMIN_TOKEN)
    .send({ status: "shipped" });
  await request(app)
    .patch(`/api/admin/orders/${order.id}/status`)
    .set("x-admin-token", ADMIN_TOKEN)
    .send({ status: "delivered" });

  return order.id;
}

describe("returns/refunds admin flow", () => {
  test("full happy path: request return -> restock -> refund", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeDeliveredOrder(product, 3);

    const stockAfterOrder = (await request(app).get(`/api/products/${product.id}`)).body.stock_quantity;
    expect(stockAfterOrder).toBe(7);

    const returnRes = await request(app)
      .post(`/api/admin/orders/${orderId}/return`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.status).toBe("return_requested");

    const restockRes = await request(app)
      .post(`/api/admin/orders/${orderId}/restock`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(restockRes.status).toBe(200);
    expect(restockRes.body.status).toBe("returned");

    const stockAfterRestock = (await request(app).get(`/api/products/${product.id}`)).body.stock_quantity;
    expect(stockAfterRestock).toBe(10); // fully restored

    const { rows: movements } = await query(
      "SELECT reason, delta FROM stock_movements WHERE product_id = $1 ORDER BY id DESC LIMIT 1",
      [product.id]
    );
    expect(movements[0]).toEqual({ reason: "return_restocked", delta: 3 });

    const refundRes = await request(app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.status).toBe("refunded");
    expect(refundRes.body.refund_id).toBe("rfnd_fake_1");
    expect(Number(refundRes.body.refunded_amount_inr)).toBeCloseTo(Number(refundRes.body.total_inr));
    expect(mockRefund).toHaveBeenCalledWith("pay_fake_return_1", { amount: Math.round(Number(refundRes.body.total_inr) * 100) });
  });

  test("rejects requesting a return on an order that isn't delivered", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const placeRes = await request(app)
      .post("/api/orders")
      .send({ ...customer, items: [{ productId: product.id, quantity: 1 }] });

    const res = await request(app)
      .post(`/api/admin/orders/${placeRes.body.order.id}/return`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pending/i);
  });

  test("rejects restocking before a return was requested", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeDeliveredOrder(product);

    const res = await request(app)
      .post(`/api/admin/orders/${orderId}/restock`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/request a return first/i);
  });

  test("rejects refunding before the return was restocked", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeDeliveredOrder(product);
    await request(app).post(`/api/admin/orders/${orderId}/return`).set("x-admin-token", ADMIN_TOKEN);

    const res = await request(app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mark it returned first/i);
    expect(mockRefund).not.toHaveBeenCalled();
  });

  test("404s on a nonexistent order", async () => {
    const res = await request(app)
      .post("/api/admin/orders/999999/return")
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(404);
  });

  test("sends a refund confirmation email", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const product = await insertProduct({ stock_quantity: 10 });
      const orderId = await placeDeliveredOrder(product);
      await request(app).post(`/api/admin/orders/${orderId}/return`).set("x-admin-token", ADMIN_TOKEN);
      await request(app).post(`/api/admin/orders/${orderId}/restock`).set("x-admin-token", ADMIN_TOKEN);
      await request(app).post(`/api/admin/orders/${orderId}/refund`).set("x-admin-token", ADMIN_TOKEN);

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).toMatch(new RegExp(`order #${orderId} refunded`, "i"));
    } finally {
      logSpy.mockRestore();
    }
  });

  test("requires admin auth on all three routes", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeDeliveredOrder(product);
    for (const action of ["return", "restock", "refund"]) {
      const res = await request(app).post(`/api/admin/orders/${orderId}/${action}`);
      expect(res.status).toBe(401);
    }
  });
});
