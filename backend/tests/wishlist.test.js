const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const signupFields = {
  email: "wishlist@example.com",
  password: "secretpass123",
  name: "Priya Sharma",
  phone: "9876543210",
};

// supertest's `agent` persists the session cookie across requests within
// one test, like a real logged-in browser - a plain `request(app)` call
// never carries it forward.
function agent() {
  return request.agent(app);
}

async function loggedInAgent(overrides = {}) {
  const a = agent();
  await a.post("/api/auth/signup").send({ ...signupFields, ...overrides });
  return a;
}

describe("wishlist", () => {
  test("requires a logged-in customer", async () => {
    const product = await insertProduct();
    const res = await request(app).post(`/api/wishlist/${product.id}`);
    expect(res.status).toBe(401);
  });

  test("starts empty, then reflects an added product with full product fields", async () => {
    const a = await loggedInAgent();
    const product = await insertProduct({ name: "Kastehelmi Bowl", price_inr: 3399 });

    expect((await a.get("/api/wishlist")).body).toEqual([]);

    const addRes = await a.post(`/api/wishlist/${product.id}`);
    expect(addRes.status).toBe(201);

    const listRes = await a.get("/api/wishlist");
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe("Kastehelmi Bowl");
    expect(Number(listRes.body[0].price_inr)).toBe(3399);
  });

  test("adding the same product twice does not duplicate it", async () => {
    const a = await loggedInAgent();
    const product = await insertProduct();

    await a.post(`/api/wishlist/${product.id}`);
    await a.post(`/api/wishlist/${product.id}`);

    const listRes = await a.get("/api/wishlist");
    expect(listRes.body).toHaveLength(1);
  });

  test("404s adding a product that doesn't exist", async () => {
    const a = await loggedInAgent();
    const res = await a.post("/api/wishlist/999999");
    expect(res.status).toBe(404);
  });

  test("removes a product from the wishlist", async () => {
    const a = await loggedInAgent();
    const product = await insertProduct();
    await a.post(`/api/wishlist/${product.id}`);

    const removeRes = await a.delete(`/api/wishlist/${product.id}`);
    expect(removeRes.status).toBe(200);

    const listRes = await a.get("/api/wishlist");
    expect(listRes.body).toHaveLength(0);
  });

  test("removing something never saved is a no-op, not an error", async () => {
    const a = await loggedInAgent();
    const product = await insertProduct();
    const res = await a.delete(`/api/wishlist/${product.id}`);
    expect(res.status).toBe(200);
  });

  test("one customer's wishlist is isolated from another's", async () => {
    const product = await insertProduct();
    const a1 = await loggedInAgent();
    const a2 = await loggedInAgent({ email: "other@example.com" });

    await a1.post(`/api/wishlist/${product.id}`);

    expect((await a1.get("/api/wishlist")).body).toHaveLength(1);
    expect((await a2.get("/api/wishlist")).body).toHaveLength(0);
  });

  test("newest-saved product appears first", async () => {
    const a = await loggedInAgent();
    const p1 = await insertProduct({ name: "First" });
    const p2 = await insertProduct({ name: "Second" });

    await a.post(`/api/wishlist/${p1.id}`);
    await a.post(`/api/wishlist/${p2.id}`);

    const listRes = await a.get("/api/wishlist");
    expect(listRes.body.map((p) => p.name)).toEqual(["Second", "First"]);
  });
});
