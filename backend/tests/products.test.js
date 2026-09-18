const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

describe("health and config", () => {
  test("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  test("GET /api/config exposes null razorpayKeyId when unconfigured", async () => {
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ razorpayKeyId: null });
  });
});

describe("GET /api/products", () => {
  test("returns an empty list with no products", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("returns created products", async () => {
    await insertProduct({ name: "Kånken Mini" });
    await insertProduct({ name: "Kastehelmi Bowl" });

    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((p) => p.name).sort()).toEqual(["Kastehelmi Bowl", "Kånken Mini"]);
  });
});

describe("GET /api/products/:id", () => {
  test("404s for a nonexistent product", async () => {
    const res = await request(app).get("/api/products/999999");
    expect(res.status).toBe(404);
  });

  test("returns the product with all fields", async () => {
    const product = await insertProduct({ name: "Kånken Mini", price_inr: 5999, gst_rate: 0.18 });
    const res = await request(app).get(`/api/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Kånken Mini");
    expect(res.body.price_inr).toBe("5999.00");
    expect(res.body.gst_rate).toBe("0.18");
  });
});
