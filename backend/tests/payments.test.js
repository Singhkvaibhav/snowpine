process.env.RAZORPAY_KEY_ID = "rzp_test_fake";
process.env.RAZORPAY_KEY_SECRET = "fake_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "fake_webhook_secret";

// jest.mock factories can't close over outer variables - the counter lives
// inside the factory itself instead, which is fine: it's a closure that
// persists for the life of this mocked module within this test file.
jest.mock("razorpay", () => {
  let counter = 0;
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockImplementation(async () => ({ id: `order_fake_${++counter}` })),
    },
  }));
});

const crypto = require("crypto");
const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const customer = {
  customerName: "Pay Test",
  customerEmail: "pay@example.com",
  customerPhone: "9333333333",
  shippingAddress: "Test address",
};

async function placeOrder(product, quantity = 1) {
  const res = await request(app)
    .post("/api/orders")
    .send({ ...customer, items: [{ productId: product.id, quantity }] });
  return res.body;
}

function sign(razorpayOrderId, razorpayPaymentId) {
  return crypto
    .createHmac("sha256", "fake_secret")
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

describe("POST /api/orders/:id/verify-payment", () => {
  test("marks the order paid with a correct signature", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const { order, razorpayOrderId } = await placeOrder(product);
    const razorpay_payment_id = "pay_fake_1";
    const razorpay_signature = sign(razorpayOrderId, razorpay_payment_id);

    const res = await request(app)
      .post(`/api/orders/${order.id}/verify-payment`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id, razorpay_signature });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("paid");
    expect(res.body.razorpay_payment_id).toBe("pay_fake_1");
  });

  // SMTP is unconfigured in tests, so email.js's dev fallback logs to the
  // console instead of sending - that's still the real code path
  // (sendOrderConfirmation), just with sendMail's transport swapped for
  // console.log, so this catches "the trigger never fires" regressions.
  test("sends an order confirmation once paid", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const product = await insertProduct({ stock_quantity: 10 });
      const { order, razorpayOrderId } = await placeOrder(product);
      const razorpay_payment_id = "pay_fake_confirm";
      const razorpay_signature = sign(razorpayOrderId, razorpay_payment_id);

      await request(app)
        .post(`/api/orders/${order.id}/verify-payment`)
        .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id, razorpay_signature });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).toMatch(new RegExp(`order #${order.id} confirmed`, "i"));
      expect(logged).toMatch(/track your order/i);
    } finally {
      logSpy.mockRestore();
    }
  });

  test("rejects a forged signature", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const { order, razorpayOrderId } = await placeOrder(product);

    const res = await request(app)
      .post(`/api/orders/${order.id}/verify-payment`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: "pay_fake_2", razorpay_signature: "totally-forged" });

    expect(res.status).toBe(402);
  });

  test("rejects a razorpay_order_id that doesn't match this order's", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const { order } = await placeOrder(product);
    const wrongRazorpayOrderId = "order_fake_does_not_belong_here";
    const razorpay_payment_id = "pay_fake_3";

    const res = await request(app).post(`/api/orders/${order.id}/verify-payment`).send({
      razorpay_order_id: wrongRazorpayOrderId,
      razorpay_payment_id,
      razorpay_signature: sign(wrongRazorpayOrderId, razorpay_payment_id),
    });

    expect(res.status).toBe(400);
  });

  test("is idempotent - verifying an already-paid order again just returns it", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const { order, razorpayOrderId } = await placeOrder(product);
    const razorpay_payment_id = "pay_fake_4";
    const razorpay_signature = sign(razorpayOrderId, razorpay_payment_id);

    const first = await request(app)
      .post(`/api/orders/${order.id}/verify-payment`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id, razorpay_signature });
    expect(first.status).toBe(200);

    // A forged signature the second time around must not matter - already
    // paid short-circuits before signature verification runs at all.
    const second = await request(app)
      .post(`/api/orders/${order.id}/verify-payment`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id, razorpay_signature: "garbage" });
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("paid");
  });
});

describe("POST /api/webhooks/razorpay", () => {
  function webhookSignature(rawBody) {
    return crypto.createHmac("sha256", "fake_webhook_secret").update(rawBody).digest("hex");
  }

  test("marks the matching order paid on a correctly signed payment.captured event", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const { order, razorpayOrderId } = await placeOrder(product);

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_webhook_1", order_id: razorpayOrderId } } },
    });

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSignature(body))
      .send(body);

    expect(res.status).toBe(200);

    const orderRes = await request(app).get(`/api/orders/${order.id}?token=${order.access_token}`);
    expect(orderRes.body.status).toBe("paid");
  });

  test("rejects an invalid webhook signature", async () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "x", order_id: "y" } } } });

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "not-the-right-signature")
      .send(body);

    expect(res.status).toBe(400);
  });

  test("silently ignores a webhook for an order id it doesn't recognize", async () => {
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_unknown", order_id: "order_never_seen" } } },
    });

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSignature(body))
      .send(body);

    expect(res.status).toBe(200); // acked, not an error - just nothing to do
  });
});
