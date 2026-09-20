// Abandoned-cart reminders ride the same "look for pending orders in a
// time window" pattern as the reservation-expiry sweep (see
// reservationExpiry.test.js), just a different window (past the reminder
// delay, but before expiry) and a different action (email, not release).
// Razorpay is mocked so orders actually get a razorpay_order_id - a
// reminder is only useful when there's something to click through to.
process.env.RAZORPAY_KEY_ID = "rzp_test_fake";
process.env.RAZORPAY_KEY_SECRET = "fake_secret";

jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn().mockImplementation(async () => ({ id: "order_fake_abandoned" })) },
  }))
);

const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");
const { query } = require("../db");
const { sendAbandonedCartReminders } = require("../services/ordersService");

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const customer = {
  customerName: "Abandoned Test",
  customerEmail: "abandoned@example.com",
  customerPhone: "9111111111",
  shippingAddress: "Test address",
};

async function placeOrder(product, quantity = 1) {
  const res = await request(app)
    .post("/api/orders")
    .send({ ...customer, items: [{ productId: product.id, quantity }] });
  return res.body.order.id;
}

async function ageOrder(orderId, minutesOld) {
  await query("UPDATE orders SET created_at = now() - ($1 || ' minutes')::interval WHERE id = $2", [
    minutesOld,
    orderId,
  ]);
}

describe("sendAbandonedCartReminders", () => {
  test("emails a pending order past the reminder delay, still within its reservation window", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const product = await insertProduct({ stock_quantity: 10 });
      const orderId = await placeOrder(product);
      await ageOrder(orderId, 20); // past the 15-min default delay, under the 30-min TTL

      const sent = await sendAbandonedCartReminders();
      expect(sent).toBe(1);

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).toMatch(/left something in your cart/i);
      expect(logged).toMatch(new RegExp(`/order/${orderId}\\?token=`));

      const { rows } = await query("SELECT abandoned_email_sent_at FROM orders WHERE id = $1", [orderId]);
      expect(rows[0].abandoned_email_sent_at).not.toBeNull();
    } finally {
      logSpy.mockRestore();
    }
  });

  test("does not email an order that hasn't reached the delay yet", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeOrder(product);
    await ageOrder(orderId, 5); // under the 15-min default delay

    const sent = await sendAbandonedCartReminders();
    expect(sent).toBe(0);

    const { rows } = await query("SELECT abandoned_email_sent_at FROM orders WHERE id = $1", [orderId]);
    expect(rows[0].abandoned_email_sent_at).toBeNull();
  });

  test("does not email an order whose reservation has already expired", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeOrder(product);
    await ageOrder(orderId, 45);
    await query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [orderId]);

    const sent = await sendAbandonedCartReminders();
    expect(sent).toBe(0);
  });

  test("does not email an order with no razorpay_order_id (nothing to click through to)", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeOrder(product);
    await query("UPDATE orders SET razorpay_order_id = NULL WHERE id = $1", [orderId]);
    await ageOrder(orderId, 20);

    const sent = await sendAbandonedCartReminders();
    expect(sent).toBe(0);
  });

  test("never re-sends once a reminder has already gone out", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeOrder(product);
    await ageOrder(orderId, 20);

    expect(await sendAbandonedCartReminders()).toBe(1);
    expect(await sendAbandonedCartReminders()).toBe(0); // already sent
  });

  test("does not email a paid order", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const orderId = await placeOrder(product);
    await query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
    await ageOrder(orderId, 20);

    const sent = await sendAbandonedCartReminders();
    expect(sent).toBe(0);
  });
});
