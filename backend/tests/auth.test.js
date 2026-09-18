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

const signupFields = {
  email: "customer@example.com",
  password: "secretpass123",
  name: "Priya Sharma",
  phone: "9876543210",
};

// supertest's `agent` persists cookies across requests within one test,
// like a real browser would - a plain `request(app)` call starts fresh
// every time and never carries the session cookie forward.
function agent() {
  return request.agent(app);
}

describe("POST /api/auth/signup", () => {
  test("creates an account, sets a session cookie, and never returns the password hash", async () => {
    const res = await agent().post("/api/auth/signup").send(signupFields);
    expect(res.status).toBe(201);
    expect(res.body.customer.email).toBe(signupFields.email);
    expect(res.body.customer.password_hash).toBeUndefined();
    expect(res.headers["set-cookie"].some((c) => c.startsWith("snowpine_session="))).toBe(true);
  });

  test("rejects a duplicate email", async () => {
    await agent().post("/api/auth/signup").send(signupFields);
    const res = await agent().post("/api/auth/signup").send({ ...signupFields, name: "Someone Else" });
    expect(res.status).toBe(409);
  });

  test.each([
    ["password", { password: "short" }, /8 characters/],
    ["email", { email: "not-an-email" }, /valid email/],
    ["phone", { phone: "abc" }, /10-15 digits/],
    ["name", { name: "" }, /required/],
  ])("rejects an invalid %s", async (_field, override, expectedMessage) => {
    const res = await agent().post("/api/auth/signup").send({ ...signupFields, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(expectedMessage);
  });

  test("retroactively links prior guest orders placed with the same email", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const guestOrderRes = await request(app)
      .post("/api/orders")
      .send({
        customerName: "Priya Sharma",
        customerEmail: signupFields.email,
        customerPhone: "9876543210",
        shippingAddress: "x",
        items: [{ productId: product.id, quantity: 1 }],
      });
    expect(guestOrderRes.body.order.customer_id).toBeNull();

    const a = agent();
    await a.post("/api/auth/signup").send(signupFields);

    const mineRes = await a.get("/api/orders/mine");
    expect(mineRes.body).toHaveLength(1);
    expect(mineRes.body[0].id).toBe(guestOrderRes.body.order.id);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/signup").send(signupFields);
  });

  test("logs in with correct credentials", async () => {
    const res = await agent().post("/api/auth/login").send({ email: signupFields.email, password: signupFields.password });
    expect(res.status).toBe(200);
    expect(res.body.customer.email).toBe(signupFields.email);
  });

  // Same error either way, so a client can't use the response to learn
  // whether a given email even has an account.
  test("gives the same generic error for a wrong password and a nonexistent email", async () => {
    const wrongPassword = await agent().post("/api/auth/login").send({ email: signupFields.email, password: "wrongpass" });
    const noSuchEmail = await agent().post("/api/auth/login").send({ email: "nobody@example.com", password: "whatever1" });
    expect(wrongPassword.status).toBe(401);
    expect(noSuchEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(noSuchEmail.body.error);
  });
});

describe("POST /api/auth/logout", () => {
  test("actually revokes the session, not just clears the cookie client-side", async () => {
    const a = agent();
    await a.post("/api/auth/signup").send(signupFields);
    expect((await a.get("/api/auth/me")).body.customer).not.toBeNull();

    await a.post("/api/auth/logout");
    expect((await a.get("/api/auth/me")).body.customer).toBeNull();

    // The old session token, if somehow replayed, must be dead server-side
    // too - not just forgotten by this particular client.
    const { rows } = await query("SELECT * FROM customer_sessions");
    expect(rows).toHaveLength(0);
  });
});

describe("GET /api/auth/me", () => {
  test("is a status check, not an authorization gate - 200 with null when logged out", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.customer).toBeNull();
  });
});

describe("customer accounts and order access", () => {
  test("an order placed while logged in is auto-linked to the account", async () => {
    const a = agent();
    await a.post("/api/auth/signup").send(signupFields);
    const product = await insertProduct({ stock_quantity: 10 });

    const orderRes = await a.post("/api/orders").send({
      customerName: signupFields.name,
      customerEmail: signupFields.email,
      customerPhone: signupFields.phone,
      shippingAddress: "x",
      items: [{ productId: product.id, quantity: 1 }],
    });

    expect(orderRes.body.order.customer_id).not.toBeNull();
  });

  test("guest checkout (no session) still works and leaves customer_id null", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const res = await request(app).post("/api/orders").send({
      customerName: "Guest",
      customerEmail: "guest@example.com",
      customerPhone: "9111111111",
      shippingAddress: "x",
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.order.customer_id).toBeNull();
  });

  test("GET /api/orders/mine returns only that customer's orders, and requires login", async () => {
    const product = await insertProduct({ stock_quantity: 10 });

    const alice = agent();
    await alice.post("/api/auth/signup").send({ ...signupFields, email: "alice@example.com" });
    await alice.post("/api/orders").send({
      customerName: "Alice",
      customerEmail: "alice@example.com",
      customerPhone: "9111111111",
      shippingAddress: "x",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const bob = agent();
    await bob.post("/api/auth/signup").send({ ...signupFields, email: "bob@example.com" });
    await bob.post("/api/orders").send({
      customerName: "Bob",
      customerEmail: "bob@example.com",
      customerPhone: "9222222222",
      shippingAddress: "x",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const aliceOrders = await alice.get("/api/orders/mine");
    expect(aliceOrders.body).toHaveLength(1);
    expect(aliceOrders.body[0].customer_email).toBe("alice@example.com");

    const unauthed = await request(app).get("/api/orders/mine");
    expect(unauthed.status).toBe(401);
  });

  test("a logged-in customer can view their own order with no token in the URL", async () => {
    const a = agent();
    await a.post("/api/auth/signup").send(signupFields);
    const product = await insertProduct({ stock_quantity: 10 });
    const orderRes = await a.post("/api/orders").send({
      customerName: signupFields.name,
      customerEmail: signupFields.email,
      customerPhone: signupFields.phone,
      shippingAddress: "x",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const viewRes = await a.get(`/api/orders/${orderRes.body.order.id}`); // no ?token=
    expect(viewRes.status).toBe(200);
  });

  // Regression guard: session-based access must be scoped to THIS
  // customer's own orders, not any order that happens to have a
  // customer_id at all.
  test("a logged-in customer cannot view another customer's order without the token", async () => {
    const product = await insertProduct({ stock_quantity: 10 });

    const alice = agent();
    await alice.post("/api/auth/signup").send({ ...signupFields, email: "alice2@example.com" });
    const aliceOrder = await alice.post("/api/orders").send({
      customerName: "Alice",
      customerEmail: "alice2@example.com",
      customerPhone: "9111111111",
      shippingAddress: "x",
      items: [{ productId: product.id, quantity: 1 }],
    });

    const bob = agent();
    await bob.post("/api/auth/signup").send({ ...signupFields, email: "bob2@example.com" });

    const res = await bob.get(`/api/orders/${aliceOrder.body.order.id}`); // no token, wrong session
    expect(res.status).toBe(404);
  });

  test("logging out revokes session-based order access, leaving only the token", async () => {
    const a = agent();
    await a.post("/api/auth/signup").send(signupFields);
    const product = await insertProduct({ stock_quantity: 10 });
    const orderRes = await a.post("/api/orders").send({
      customerName: signupFields.name,
      customerEmail: signupFields.email,
      customerPhone: signupFields.phone,
      shippingAddress: "x",
      items: [{ productId: product.id, quantity: 1 }],
    });
    const { id, access_token } = orderRes.body.order;

    await a.post("/api/auth/logout");

    expect((await a.get(`/api/orders/${id}`)).status).toBe(404); // session gone
    expect((await a.get(`/api/orders/${id}?token=${access_token}`)).status).toBe(200); // token still works
  });
});
