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
  customerName: "Race Test",
  customerEmail: "race@example.com",
  customerPhone: "9111111111",
  shippingAddress: "Test address",
};

describe("concurrent checkout on the last unit of stock", () => {
  // This is exactly the bug a mock-based test would hide: two requests
  // both read stock_quantity=1 before either writes, and without the
  // `SELECT ... FOR UPDATE` row lock in ordersService.createOrder, both
  // would pass the stock check and both would succeed - selling the same
  // physical item twice.
  test("only one of two simultaneous buyers can win the last unit", async () => {
    const product = await insertProduct({ stock_quantity: 1 });

    const [resA, resB] = await Promise.all([
      request(app).post("/api/orders").send({ ...customer, items: [{ productId: product.id, quantity: 1 }] }),
      request(app).post("/api/orders").send({ ...customer, items: [{ productId: product.id, quantity: 1 }] }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 400]);

    const failed = resA.status === 400 ? resA : resB;
    expect(failed.body.error).toMatch(/not enough stock/i);

    const productRes = await request(app).get(`/api/products/${product.id}`);
    expect(productRes.body.stock_quantity).toBe(0); // not -1
  });
});
