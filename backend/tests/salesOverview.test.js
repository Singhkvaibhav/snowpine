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

async function placeOrder(items) {
  const res = await request(app)
    .post("/api/orders")
    .send({
      customerName: "Sales Test",
      customerEmail: `sales${Math.random()}@example.com`,
      customerPhone: "9876543210",
      shippingAddress: "x",
      items,
    });
  return res.body.order.id;
}

describe("GET /api/admin/sales-overview", () => {
  test("returns zeros with no orders at all", async () => {
    const res = await request(app).get("/api/admin/sales-overview").set("x-admin-token", ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(0);
    expect(res.body.orderCount).toBe(0);
    expect(res.body.topProducts).toEqual([]);
  });

  test("requires admin auth", async () => {
    const res = await request(app).get("/api/admin/sales-overview");
    expect(res.status).toBe(401);
  });

  // Revenue must only count orders that actually represent money the
  // store keeps - a pending order may never be paid, and a cancelled one
  // was reversed. Counting either would overstate real revenue.
  test("counts revenue only from paid/shipped/delivered orders, not pending or cancelled", async () => {
    const product = await insertProduct({ price_inr: 1000, stock_quantity: 100 });

    const pendingId = await placeOrder([{ productId: product.id, quantity: 1 }]); // left pending
    const paidId = await placeOrder([{ productId: product.id, quantity: 2 }]);
    await query("UPDATE orders SET status = 'paid' WHERE id = $1", [paidId]);
    const cancelledId = await placeOrder([{ productId: product.id, quantity: 3 }]);
    await query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [cancelledId]);

    const res = await request(app).get("/api/admin/sales-overview").set("x-admin-token", ADMIN_TOKEN);
    expect(res.body.totalRevenue).toBe(2000); // only the paid order's 2 x 1000
    expect(res.body.orderCount).toBe(1);
    expect(res.body.ordersByStatus).toMatchObject({ pending: 1, paid: 1, cancelled: 1 });
    void pendingId; // referenced for clarity of what each id represents
  });

  test("aggregates top products by units sold across multiple paid orders", async () => {
    const popular = await insertProduct({ name: "Popular", price_inr: 500, stock_quantity: 100 });
    const niche = await insertProduct({ name: "Niche", price_inr: 2000, stock_quantity: 100 });

    const order1 = await placeOrder([
      { productId: popular.id, quantity: 5 },
      { productId: niche.id, quantity: 1 },
    ]);
    const order2 = await placeOrder([{ productId: popular.id, quantity: 3 }]);
    await query("UPDATE orders SET status = 'paid' WHERE id IN ($1, $2)", [order1, order2]);

    const res = await request(app).get("/api/admin/sales-overview").set("x-admin-token", ADMIN_TOKEN);
    expect(res.body.topProducts[0]).toMatchObject({ name: "Popular", unitsSold: 8, revenue: 4000 });
    expect(res.body.topProducts[1]).toMatchObject({ name: "Niche", unitsSold: 1, revenue: 2000 });
  });

  test("a shipped or delivered order still counts toward revenue", async () => {
    const product = await insertProduct({ price_inr: 1500, stock_quantity: 100 });
    const orderId = await placeOrder([{ productId: product.id, quantity: 1 }]);
    await query("UPDATE orders SET status = 'delivered' WHERE id = $1", [orderId]);

    const res = await request(app).get("/api/admin/sales-overview").set("x-admin-token", ADMIN_TOKEN);
    expect(res.body.totalRevenue).toBe(1500);
    expect(res.body.orderCount).toBe(1);
  });
});
