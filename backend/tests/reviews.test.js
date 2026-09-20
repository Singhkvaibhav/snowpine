// Reviews require a verified purchase (an order that reached "delivered"
// at some point - see reviewsService's REVIEW_ELIGIBLE_STATUSES). Razorpay
// is mocked so an order can actually be driven to "paid" and then
// "delivered" through the real checkout + admin-status-update paths,
// exactly like returns.test.js does for the same reason.
process.env.RAZORPAY_KEY_ID = "rzp_test_fake";
process.env.RAZORPAY_KEY_SECRET = "fake_secret";

jest.mock("razorpay", () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: jest.fn().mockImplementation(async () => ({ id: "order_fake_review" })) },
  }))
);

const crypto = require("crypto");
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

function agent() {
  return request.agent(app);
}

function sign(razorpayOrderId, razorpayPaymentId) {
  return crypto.createHmac("sha256", "fake_secret").update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
}

async function signupAndLogin(overrides = {}) {
  const a = agent();
  await a.post("/api/auth/signup").send({
    email: "reviewer@example.com",
    password: "secretpass123",
    name: "Priya Sharma",
    phone: "9876543210",
    ...overrides,
  });
  return a;
}

// Places, pays, ships, and delivers an order AS the given logged-in
// agent, so it auto-links to their customer_id (see createOrder's
// customerId param, wired from attachCustomerIfPresent) - a guest
// checkout wouldn't count toward that customer's review eligibility.
async function deliverOrderAs(a, product, quantity = 1) {
  const placeRes = await a.post("/api/orders").send({
    customerName: "Priya Sharma",
    customerEmail: "reviewer@example.com",
    customerPhone: "9876543210",
    shippingAddress: "Test address",
    items: [{ productId: product.id, quantity }],
  });
  const { order, razorpayOrderId } = placeRes.body;
  const razorpay_payment_id = "pay_fake_review";
  await a.post(`/api/orders/${order.id}/verify-payment`).send({
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id,
    razorpay_signature: sign(razorpayOrderId, razorpay_payment_id),
  });
  await request(app).patch(`/api/admin/orders/${order.id}/status`).set("x-admin-token", ADMIN_TOKEN).send({ status: "shipped" });
  await request(app).patch(`/api/admin/orders/${order.id}/status`).set("x-admin-token", ADMIN_TOKEN).send({ status: "delivered" });
}

describe("review eligibility", () => {
  test("ineligible with no order at all", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct();

    const res = await a.get(`/api/reviews/product/${product.id}/me`);
    expect(res.body).toEqual({ eligible: false, review: null });
  });

  test("ineligible while the order is still pending (not yet delivered)", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await a.post("/api/orders").send({
      customerName: "Priya Sharma",
      customerEmail: "reviewer@example.com",
      customerPhone: "9876543210",
      shippingAddress: "Test address",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const res = await a.get(`/api/reviews/product/${product.id}/me`);
    expect(res.body.eligible).toBe(false);
  });

  test("eligible once the order is delivered", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);

    const res = await a.get(`/api/reviews/product/${product.id}/me`);
    expect(res.body).toEqual({ eligible: true, review: null });
  });
});

describe("submitting a review", () => {
  test("rejects an unauthenticated request", async () => {
    const product = await insertProduct();
    const res = await request(app).post(`/api/reviews/product/${product.id}`).send({ rating: 5, body: "Great!" });
    expect(res.status).toBe(401);
  });

  test("rejects a logged-in customer with no verified purchase", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct();

    const res = await a.post(`/api/reviews/product/${product.id}`).send({ rating: 5, body: "Great!" });
    expect(res.status).toBe(403);
  });

  test("rejects a rating outside 1-5", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);

    const res = await a.post(`/api/reviews/product/${product.id}`).send({ rating: 6, body: "Great!" });
    expect(res.status).toBe(400);
  });

  test("rejects an empty review body", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);

    const res = await a.post(`/api/reviews/product/${product.id}`).send({ rating: 4, body: "   " });
    expect(res.status).toBe(400);
  });

  test("accepts a valid review from an eligible customer and shows a truncated display name", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);

    const postRes = await a.post(`/api/reviews/product/${product.id}`).send({ rating: 5, body: "Lovely quality." });
    expect(postRes.status).toBe(201);
    expect(postRes.body.rating).toBe(5);

    const listRes = await request(app).get(`/api/reviews/product/${product.id}`);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].customer_name).toBe("Priya S.");
    expect(listRes.body[0].body).toBe("Lovely quality.");
  });

  test("submitting again updates the existing review instead of duplicating it", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);

    await a.post(`/api/reviews/product/${product.id}`).send({ rating: 3, body: "It's okay." });
    await a.post(`/api/reviews/product/${product.id}`).send({ rating: 5, body: "Actually, it grew on me." });

    const listRes = await request(app).get(`/api/reviews/product/${product.id}`);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].rating).toBe(5);
    expect(listRes.body[0].body).toBe("Actually, it grew on me.");
  });

  test("me endpoint reflects the customer's own review after submitting", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);
    await a.post(`/api/reviews/product/${product.id}`).send({ rating: 4, body: "Solid." });

    const res = await a.get(`/api/reviews/product/${product.id}/me`);
    expect(res.body.eligible).toBe(true);
    expect(res.body.review.rating).toBe(4);
  });
});

describe("deleting a review", () => {
  test("removes the customer's own review", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);
    await a.post(`/api/reviews/product/${product.id}`).send({ rating: 4, body: "Solid." });

    const delRes = await a.delete(`/api/reviews/product/${product.id}`);
    expect(delRes.status).toBe(200);

    const listRes = await request(app).get(`/api/reviews/product/${product.id}`);
    expect(listRes.body).toHaveLength(0);
  });
});

describe("product listing rating aggregates", () => {
  test("a product with no reviews shows zero average and count", async () => {
    const product = await insertProduct();
    const res = await request(app).get(`/api/products/${product.id}`);
    expect(Number(res.body.avg_rating)).toBe(0);
    expect(Number(res.body.review_count)).toBe(0);
  });

  test("GET /api/products includes the aggregate from a submitted review", async () => {
    const a = await signupAndLogin();
    const product = await insertProduct({ stock_quantity: 10 });
    await deliverOrderAs(a, product);
    await a.post(`/api/reviews/product/${product.id}`).send({ rating: 4, body: "Good." });

    const listRes = await request(app).get("/api/products");
    const found = listRes.body.find((p) => p.id === product.id);
    expect(Number(found.avg_rating)).toBe(4);
    expect(Number(found.review_count)).toBe(1);
  });
});
