// Regression test for a real bug caught during manual testing: if Razorpay
// order creation fails AFTER the stock-reservation transaction has already
// committed, the order was left "pending" forever, holding stock hostage
// with no way to ever be paid for. ordersService.releaseOrder exists
// specifically to undo that. Razorpay is mocked (not pointed at real fake
// keys) so the failure is deterministic and instant, not a real network
// timeout.
process.env.RAZORPAY_KEY_ID = "rzp_test_fake";
process.env.RAZORPAY_KEY_SECRET = "fake_secret";

jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn().mockRejectedValue(new Error("simulated Razorpay outage")) },
  }))
);

const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");
const { query } = require("../db");

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const customer = {
  customerName: "Outage Test",
  customerEmail: "outage@example.com",
  customerPhone: "9222222222",
  shippingAddress: "Test address",
};

describe("Razorpay outage during checkout", () => {
  test("releases stock and removes the order rather than stranding it", async () => {
    const product = await insertProduct({ stock_quantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ ...customer, items: [{ productId: product.id, quantity: 2 }] });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/temporarily unavailable/i);

    const productRes = await request(app).get(`/api/products/${product.id}`);
    expect(productRes.body.stock_quantity).toBe(10); // fully restored, not stuck at 8

    const { rows } = await query("SELECT id FROM orders WHERE customer_email = $1", [customer.customerEmail]);
    expect(rows).toHaveLength(0); // no orphaned order left behind
  });
});
