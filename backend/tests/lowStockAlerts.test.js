process.env.ADMIN_EMAIL = "owner@example.com";

const request = require("supertest");
const app = require("../server");
const { resetDb, insertProduct } = require("./dbReset");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

beforeAll(async () => {
  await app.dbReady;
});

beforeEach(async () => {
  await resetDb();
});

const customer = {
  customerName: "Alert Test",
  customerEmail: "alerttest@example.com",
  customerPhone: "9876543210",
  shippingAddress: "x",
};

function spyOnConsoleLog() {
  return jest.spyOn(console, "log").mockImplementation(() => {});
}

describe("low-stock alert on order placement", () => {
  test("fires when an order crosses a product from healthy into low stock", async () => {
    const logSpy = spyOnConsoleLog();
    try {
      const product = await insertProduct({ name: "Crosses Threshold", stock_quantity: 6, reorder_point: 5 });
      await request(app).post("/api/orders").send({ ...customer, items: [{ productId: product.id, quantity: 2 }] });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).toMatch(/owner@example\.com/);
      expect(logged).toMatch(/low stock - Crosses Threshold/i);
      expect(logged).toMatch(/dropped to 4 units/);
    } finally {
      logSpy.mockRestore();
    }
  });

  test("does not fire when stock stays above the reorder point", async () => {
    const logSpy = spyOnConsoleLog();
    try {
      const product = await insertProduct({ name: "Stays Healthy", stock_quantity: 50, reorder_point: 5 });
      await request(app).post("/api/orders").send({ ...customer, items: [{ productId: product.id, quantity: 2 }] });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).not.toMatch(/low stock/i);
    } finally {
      logSpy.mockRestore();
    }
  });

  // Regression guard: an item that's already low shouldn't re-alert on
  // every subsequent sale - that would spam the inbox for a slow-moving
  // product instead of flagging it once when it first needs attention.
  test("does not re-fire for a product that was already at or below its reorder point", async () => {
    const logSpy = spyOnConsoleLog();
    try {
      const product = await insertProduct({ name: "Already Low", stock_quantity: 3, reorder_point: 5 });
      await request(app).post("/api/orders").send({ ...customer, items: [{ productId: product.id, quantity: 1 }] });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).not.toMatch(/low stock/i);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("low-stock alert on admin stock edits", () => {
  test("fires when an admin edit crosses a product into low stock", async () => {
    const logSpy = spyOnConsoleLog();
    try {
      const product = await insertProduct({ name: "Admin Crossed", stock_quantity: 20, reorder_point: 5 });
      await request(app)
        .patch(`/api/admin/products/${product.id}`)
        .set("x-admin-token", ADMIN_TOKEN)
        .send({ stock_quantity: 4 });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).toMatch(/low stock - Admin Crossed/i);
    } finally {
      logSpy.mockRestore();
    }
  });

  test("does not fire for a restock (moving further away from the threshold)", async () => {
    const logSpy = spyOnConsoleLog();
    try {
      const product = await insertProduct({ name: "Restocked", stock_quantity: 2, reorder_point: 5 });
      await request(app)
        .patch(`/api/admin/products/${product.id}`)
        .set("x-admin-token", ADMIN_TOKEN)
        .send({ stock_quantity: 100 });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).not.toMatch(/low stock/i);
    } finally {
      logSpy.mockRestore();
    }
  });

  test("does not fire for an edit that never touches stock_quantity", async () => {
    const logSpy = spyOnConsoleLog();
    try {
      const product = await insertProduct({ name: "Price Only", stock_quantity: 2, reorder_point: 5 });
      await request(app)
        .patch(`/api/admin/products/${product.id}`)
        .set("x-admin-token", ADMIN_TOKEN)
        .send({ price_inr: 4999 });

      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).not.toMatch(/low stock/i);
    } finally {
      logSpy.mockRestore();
    }
  });
});
