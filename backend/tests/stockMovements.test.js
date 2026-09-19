const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");
const { query } = require("../db");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const customer = {
  customerName: "Stock Test",
  customerEmail: "stock@example.com",
  customerPhone: "9876543210",
  shippingAddress: "x",
};

describe("stock movement audit trail", () => {
  test("placing an order logs an order_placed movement with a negative delta", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    await request(app).post("/api/orders").send({ ...customer, items: [{ productId: product.id, quantity: 3 }] });

    const res = await request(app)
      .get(`/api/admin/stock-movements?productId=${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ product_id: product.id, delta: -3, reason: "order_placed" });
  });

  test("a released (expired) order logs a matching order_released movement", async () => {
    const product = await insertProduct({ stock_quantity: 10 });
    const createRes = await request(app)
      .post("/api/orders")
      .send({ ...customer, items: [{ productId: product.id, quantity: 3 }] });

    await query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [
      createRes.body.order.id,
    ]);
    await require("../services/ordersService").sweepExpiredOrders();

    const res = await request(app)
      .get(`/api/admin/stock-movements?productId=${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN);
    const reasons = res.body.map((m) => m.reason).sort();
    expect(reasons).toEqual(["order_placed", "order_released"]);
    expect(res.body.find((m) => m.reason === "order_released").delta).toBe(3);
  });

  test("an admin stock edit logs an admin_adjustment with the correct delta", async () => {
    const product = await insertProduct({ stock_quantity: 10 });

    await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ stock_quantity: 25 });

    const res = await request(app)
      .get(`/api/admin/stock-movements?productId=${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ delta: 15, reason: "admin_adjustment" });
  });

  test("an admin edit that doesn't touch stock_quantity logs nothing", async () => {
    const product = await insertProduct({ stock_quantity: 10 });

    await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ price_inr: 999 });

    const res = await request(app)
      .get(`/api/admin/stock-movements?productId=${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN);
    expect(res.body).toHaveLength(0);
  });

  test("movements are scoped per product when productId is given, and combined otherwise", async () => {
    const a = await insertProduct({ name: "A", stock_quantity: 10 });
    const b = await insertProduct({ name: "B", stock_quantity: 10 });
    await request(app).post("/api/orders").send({ ...customer, items: [{ productId: a.id, quantity: 1 }] });
    await request(app).post("/api/orders").send({ ...customer, items: [{ productId: b.id, quantity: 2 }] });

    const onlyA = await request(app).get(`/api/admin/stock-movements?productId=${a.id}`).set("x-admin-token", ADMIN_TOKEN);
    expect(onlyA.body).toHaveLength(1);
    expect(onlyA.body[0].product_id).toBe(a.id);

    const all = await request(app).get("/api/admin/stock-movements").set("x-admin-token", ADMIN_TOKEN);
    expect(all.body).toHaveLength(2);
  });

  test("requires admin auth", async () => {
    const res = await request(app).get("/api/admin/stock-movements");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/products/low-stock", () => {
  test("returns only products at or below their reorder point", async () => {
    await insertProduct({ name: "Low", stock_quantity: 3, reorder_point: 5 });
    await insertProduct({ name: "Exactly at threshold", stock_quantity: 5, reorder_point: 5 });
    await insertProduct({ name: "Healthy", stock_quantity: 50, reorder_point: 5 });

    const res = await request(app).get("/api/admin/products/low-stock").set("x-admin-token", ADMIN_TOKEN);
    const names = res.body.map((p) => p.name).sort();
    expect(names).toEqual(["Exactly at threshold", "Low"]);
  });

  test("a product drops off the low-stock list once restocked above its reorder point", async () => {
    const product = await insertProduct({ stock_quantity: 2, reorder_point: 5 });
    expect((await request(app).get("/api/admin/products/low-stock").set("x-admin-token", ADMIN_TOKEN)).body).toHaveLength(1);

    await request(app)
      .patch(`/api/admin/products/${product.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ stock_quantity: 20 });

    expect((await request(app).get("/api/admin/products/low-stock").set("x-admin-token", ADMIN_TOKEN)).body).toHaveLength(0);
  });

  test("requires admin auth", async () => {
    const res = await request(app).get("/api/admin/products/low-stock");
    expect(res.status).toBe(401);
  });
});

describe("reorder_point via product create/update", () => {
  test("defaults to 5 when creating a product without specifying it", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ name: "New", description: "d", origin_country: "Sweden", category: "Bags", price_inr: 999 });
    expect(res.body.reorder_point).toBe(5);
  });

  test("can be set explicitly on create and updated later", async () => {
    const created = await request(app)
      .post("/api/admin/products")
      .set("x-admin-token", ADMIN_TOKEN)
      .send({
        name: "New",
        description: "d",
        origin_country: "Sweden",
        category: "Bags",
        price_inr: 999,
        reorder_point: 15,
      });
    expect(created.body.reorder_point).toBe(15);

    const updated = await request(app)
      .patch(`/api/admin/products/${created.body.id}`)
      .set("x-admin-token", ADMIN_TOKEN)
      .send({ reorder_point: 20 });
    expect(updated.body.reorder_point).toBe(20);
  });
});
