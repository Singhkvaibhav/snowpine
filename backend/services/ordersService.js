const crypto = require("crypto");
const { withTransaction, query } = require("../db");
const {
  isConfigured,
  createRazorpayOrder,
  createRefund,
  verifySignature,
  verifyWebhookSignature,
  keyId,
} = require("../razorpay");
const { sendOrderConfirmation, sendShippedNotification, sendRefundConfirmation } = require("../email");
const { maybeSendLowStockAlert } = require("./productsService");

const VALID_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];
const RESERVATION_TTL_MINUTES = Number(process.env.RESERVATION_TTL_MINUTES) || 30;

// Structural sanity checks, not full validation - client-side type="email"/
// pattern= on the checkout form is trivially bypassed by calling this API
// directly, so it has to be re-checked server-side. A malformed email
// would otherwise silently swallow the order confirmation and, later, any
// shipping update - the customer would never know their order even went
// through.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+ ]{10,15}$/;

class OrderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Prices and stock are always re-read from the database inside the same
// transaction that places the order - never trust a client-submitted price,
// and lock each product row (FOR UPDATE) so two concurrent checkouts can't
// both oversell the last unit of stock.
async function createOrder({ customerName, customerEmail, customerPhone, shippingAddress, items }, customerId = null) {
  if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
    throw new OrderError("customerName, customerEmail, customerPhone, and shippingAddress are required");
  }
  if (!EMAIL_RE.test(customerEmail)) {
    throw new OrderError("customerEmail is not a valid email address");
  }
  if (!PHONE_RE.test(customerPhone)) {
    throw new OrderError("customerPhone must be 10-15 digits");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderError("At least one item is required");
  }

  const lineItemsSnapshot = [];
  const order = await withTransaction(async (tx) => {
    let total = 0;
    const lineItems = [];

    for (const { productId, quantity } of items) {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new OrderError(`Invalid quantity for product ${productId}`);
      }

      const { rows } = await tx("SELECT * FROM products WHERE id = $1 FOR UPDATE", [productId]);
      const product = rows[0];
      if (!product) throw new OrderError(`Product ${productId} not found`, 404);
      if (product.stock_quantity < quantity) {
        throw new OrderError(`Not enough stock for "${product.name}" (${product.stock_quantity} left)`);
      }

      total += Number(product.price_inr) * quantity;
      lineItems.push({ product, quantity });
    }

    // Authorizes viewing this order later (order-confirmation/tracking
    // link) - not the sequential id, which is trivially guessable.
    const accessToken = crypto.randomBytes(16).toString("hex");

    const { rows: orderRows } = await tx(
      `INSERT INTO orders (customer_name, customer_email, customer_phone, shipping_address, total_inr, access_token, expires_at, customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' minutes')::interval, $8) RETURNING *`,
      [customerName, customerEmail, customerPhone, shippingAddress, total, accessToken, RESERVATION_TTL_MINUTES, customerId]
    );
    const order = orderRows[0];

    for (const { product, quantity } of lineItems) {
      await tx(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_inr, gst_rate)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, product.id, quantity, product.price_inr, product.gst_rate]
      );
      await tx("UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2", [quantity, product.id]);
      await tx("INSERT INTO stock_movements (product_id, delta, reason) VALUES ($1, $2, 'order_placed')", [
        product.id,
        -quantity,
      ]);
      lineItemsSnapshot.push({ product, quantity });
    }

    return order;
  });

  // Outside the transaction (network call, must not hold the row locks
  // acquired above) - checks each purchased product for crossing INTO low
  // stock as a result of this order.
  for (const { product, quantity } of lineItemsSnapshot) {
    await maybeSendLowStockAlert(product, { ...product, stock_quantity: product.stock_quantity - quantity });
  }

  return order;
}

// Undoes createOrder: restores each line item's stock and removes the
// order (order_items cascade-delete with it). Used when Razorpay order
// creation fails AFTER the stock-reservation transaction already
// committed - without this, a Razorpay outage would strand a "pending"
// order that holds stock hostage forever with no way to ever be paid for.
async function releaseOrder(orderId) {
  await withTransaction(async (tx) => {
    const { rows: items } = await tx("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [orderId]);
    for (const { product_id, quantity } of items) {
      await tx("UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2", [quantity, product_id]);
      await tx("INSERT INTO stock_movements (product_id, delta, reason) VALUES ($1, $2, 'order_released')", [
        product_id,
        quantity,
      ]);
    }
    await tx("DELETE FROM orders WHERE id = $1", [orderId]);
  });
}

// Releases any "pending" order whose reservation window has passed without
// payment - an abandoned checkout (widget closed, tab crashed, customer
// just gave up) otherwise holds real stock hostage forever, since nothing
// else ever transitions a pending order out of that state on its own.
// There's a small, accepted race if a payment confirms in the same instant
// a reservation is being swept (see server.js for the sweep interval) -
// not fully closed here, same tradeoff ParentOS's own reservation-expiry
// sweep makes; a generous TTL keeps this rare in practice.
async function sweepExpiredOrders() {
  const { rows } = await query(
    "SELECT id FROM orders WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < now()"
  );
  for (const { id } of rows) {
    await releaseOrder(id);
  }
  return rows.length;
}

// Runs after the order/stock transaction commits, not inside it - this is
// a network call to Razorpay, and a slow/stalled external API must never
// hold the row locks acquired above. If Razorpay is unconfigured (no keys
// - e.g. local dev), the order is left as a plain "pending" order with no
// payment step, same as before payments existed. If Razorpay IS configured
// but the call fails (bad keys, API outage), the order is released rather
// than left stranded - see releaseOrder.
async function attachRazorpayOrder(order) {
  if (!isConfigured()) return { order, razorpayOrderId: null, razorpayKeyId: null };

  let rpOrder;
  try {
    rpOrder = await createRazorpayOrder(order.total_inr, order.id);
  } catch (e) {
    await releaseOrder(order.id);
    throw new OrderError("Payment service is temporarily unavailable. Please try again shortly.", 502);
  }

  const { rows } = await query(
    "UPDATE orders SET razorpay_order_id = $1 WHERE id = $2 RETURNING *",
    [rpOrder.id, order.id]
  );
  return { order: rows[0], razorpayOrderId: rpOrder.id, razorpayKeyId: keyId };
}

// Shared by both confirmation paths (client-side handler + webhook) so
// "already paid" is handled identically and idempotently regardless of
// which one runs first - order matters here since either can win the race.
async function markOrderPaid(orderId, razorpayPaymentId) {
  const { rows } = await query("SELECT * FROM orders WHERE id = $1", [orderId]);
  const order = rows[0];
  if (!order) return null;
  if (order.status === "paid") return order; // idempotent

  const { rows: updated } = await query(
    "UPDATE orders SET status = 'paid', razorpay_payment_id = $1 WHERE id = $2 RETURNING *",
    [razorpayPaymentId, orderId]
  );

  // Best-effort - a broken SMTP config must never fail payment
  // confirmation itself, since the money has already moved.
  try {
    await sendOrderConfirmation(await getOrder(orderId));
  } catch (e) {
    console.error(`Failed to send order confirmation email for order ${orderId}:`, e);
  }

  return updated[0];
}

async function verifyPayment(orderId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const { rows } = await query("SELECT * FROM orders WHERE id = $1", [orderId]);
  const order = rows[0];
  if (!order) throw new OrderError("Order not found", 404);
  if (!order.razorpay_order_id || order.razorpay_order_id !== razorpay_order_id) {
    throw new OrderError("Order/payment mismatch");
  }
  if (order.status === "paid") return order; // already verified - idempotent

  const valid = verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
  if (!valid) throw new OrderError("Payment signature verification failed", 402);

  return markOrderPaid(orderId, razorpay_payment_id);
}

// Server-authoritative confirmation: fires even if the customer's browser
// closes right after paying, before Checkout.jsx's client-side `handler`
// callback can run and call verifyPayment above. rawBody must be the
// exact bytes Razorpay sent - signature verification fails on a
// re-serialized/re-parsed body, which is why the route wires up
// express.json({ verify }) to capture it (see server.js).
async function handleWebhookEvent(rawBody, signatureHeader) {
  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    throw new OrderError("Invalid webhook signature", 400);
  }
  const event = JSON.parse(rawBody);
  if (event.event !== "payment.captured" && event.event !== "order.paid") return;

  const payment = event.payload?.payment?.entity;
  if (!payment) return;

  const { rows } = await query("SELECT id FROM orders WHERE razorpay_order_id = $1", [payment.order_id]);
  const order = rows[0];
  if (!order) return; // not one of ours, or not yet attached - ignore

  await markOrderPaid(order.id, payment.id);
}

async function listOrders() {
  const { rows } = await query("SELECT * FROM orders ORDER BY created_at DESC");
  return rows;
}

// "Real" revenue is paid/shipped/delivered orders only - a pending order
// hasn't actually been paid for yet (may never be, see the reservation
// sweep), and a cancelled one was reversed. Counting either as revenue
// would overstate it.
const REVENUE_STATUSES = ["paid", "shipped", "delivered"];

async function getSalesOverview() {
  const [{ rows: revenueRows }, { rows: statusRows }, { rows: topProducts }] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(total_inr), 0) AS total_revenue, COUNT(*) AS order_count
       FROM orders WHERE status = ANY($1)`,
      [REVENUE_STATUSES]
    ),
    query("SELECT status, COUNT(*) AS count FROM orders GROUP BY status"),
    query(
      `SELECT p.id AS product_id, p.name,
              SUM(oi.quantity) AS units_sold,
              SUM(oi.quantity * oi.unit_price_inr) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status = ANY($1)
       GROUP BY p.id, p.name
       ORDER BY units_sold DESC
       LIMIT 10`,
      [REVENUE_STATUSES]
    ),
  ]);

  return {
    totalRevenue: Number(revenueRows[0].total_revenue),
    orderCount: Number(revenueRows[0].order_count),
    ordersByStatus: Object.fromEntries(statusRows.map((r) => [r.status, Number(r.count)])),
    topProducts: topProducts.map((p) => ({
      productId: p.product_id,
      name: p.name,
      unitsSold: Number(p.units_sold),
      revenue: Number(p.revenue),
    })),
  };
}

async function updateOrderStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) throw new OrderError(`Invalid status: ${status}`);
  const { rows } = await query("UPDATE orders SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
  if (!rows[0]) throw new OrderError("Order not found", 404);

  // Keeps the promise made in the order confirmation email ("we'll email
  // you again once it ships"). Best-effort - a broken SMTP config must
  // never fail the admin's status update.
  if (status === "shipped") {
    try {
      await sendShippedNotification(await getOrder(id));
    } catch (e) {
      console.error(`Failed to send shipped notification for order ${id}:`, e);
    }
  }

  return rows[0];
}

// Returns/refunds get their own explicit state machine (delivered ->
// return_requested -> returned -> refunded) rather than being folded into
// updateOrderStatus - restocking and moving real money back through
// Razorpay are consequential enough to guard with their own preconditions
// instead of accepting any status value a caller hands in.
async function requestReturn(id) {
  const { rows } = await query(
    "UPDATE orders SET status = 'return_requested' WHERE id = $1 AND status = 'delivered' RETURNING *",
    [id]
  );
  if (!rows[0]) {
    const { rows: existing } = await query("SELECT status FROM orders WHERE id = $1", [id]);
    if (!existing[0]) throw new OrderError("Order not found", 404);
    throw new OrderError(`Cannot request a return for an order with status "${existing[0].status}"`);
  }
  return rows[0];
}

// Puts the returned stock back where a customer's order took it from -
// same stock_movements audit trail as every other stock change, tagged
// distinctly ('return_restocked') so it's not confused with a fresh
// admin_adjustment when reconstructing why a product is at its current
// quantity.
async function markReturned(id) {
  return withTransaction(async (tx) => {
    const { rows: orderRows } = await tx(
      "SELECT * FROM orders WHERE id = $1 AND status = 'return_requested' FOR UPDATE",
      [id]
    );
    const order = orderRows[0];
    if (!order) {
      const { rows: existing } = await tx("SELECT status FROM orders WHERE id = $1", [id]);
      if (!existing[0]) throw new OrderError("Order not found", 404);
      throw new OrderError(`Cannot restock an order with status "${existing[0].status}" - request a return first`);
    }

    const { rows: items } = await tx("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [id]);
    for (const { product_id, quantity } of items) {
      await tx("UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2", [quantity, product_id]);
      await tx("INSERT INTO stock_movements (product_id, delta, reason) VALUES ($1, $2, 'return_restocked')", [
        product_id,
        quantity,
      ]);
    }

    const { rows: updated } = await tx("UPDATE orders SET status = 'returned' WHERE id = $1 RETURNING *", [id]);
    return updated[0];
  });
}

// Only reachable once markReturned has already restocked the items - a
// refund without a preceding return would give money back for goods
// still marked as sold. Requires a real razorpay_payment_id (the order
// was actually paid through Razorpay); a demo/dev order that never went
// through real payment still moves to "refunded" for bookkeeping, just
// without calling out to Razorpay for it.
async function refundOrder(id) {
  const { rows } = await query("SELECT * FROM orders WHERE id = $1 AND status = 'returned'", [id]);
  const order = rows[0];
  if (!order) {
    const { rows: existing } = await query("SELECT status FROM orders WHERE id = $1", [id]);
    if (!existing[0]) throw new OrderError("Order not found", 404);
    throw new OrderError(`Cannot refund an order with status "${existing[0].status}" - mark it returned first`);
  }

  let refundId = null;
  if (isConfigured() && order.razorpay_payment_id) {
    try {
      const refund = await createRefund(order.razorpay_payment_id, order.total_inr);
      refundId = refund?.id ?? null;
    } catch (e) {
      throw new OrderError("Refund could not be processed by the payment provider. Please try again shortly.", 502);
    }
  }

  const { rows: updated } = await query(
    `UPDATE orders SET status = 'refunded', refund_id = $1, refunded_amount_inr = $2, refunded_at = now()
     WHERE id = $3 RETURNING *`,
    [refundId, order.total_inr, id]
  );

  try {
    await sendRefundConfirmation(await getOrder(id));
  } catch (e) {
    console.error(`Failed to send refund confirmation email for order ${id}:`, e);
  }

  return updated[0];
}

// price_inr/unit_price_inr are GST-inclusive MRP (standard Indian retail
// convention) - the taxable value and GST amount are derived by working
// backward from that, not added on top.
function withTaxBreakdown(item) {
  const lineTotal = Number(item.unit_price_inr) * item.quantity;
  const taxableValue = lineTotal / (1 + Number(item.gst_rate));
  return { ...item, taxable_value: taxableValue, gst_amount: lineTotal - taxableValue };
}

async function getOrder(id) {
  const { rows } = await query("SELECT * FROM orders WHERE id = $1", [id]);
  const order = rows[0];
  if (!order) return null;

  const { rows: items } = await query(
    `SELECT oi.quantity, oi.unit_price_inr, oi.gst_rate, p.name, p.id AS product_id
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [id]
  );
  return { ...order, items: items.map(withTaxBreakdown) };
}

// For the customer-facing order-confirmation/tracking route: either the
// access token OR a logged-in session for the account this order belongs
// to authorizes viewing it - never the order id alone, which is
// trivially guessable. Deliberately indistinguishable from "order not
// found" in every rejection case, so this can't be used to probe which
// order ids exist.
async function getOrderForCustomer(id, token, sessionCustomerId = null) {
  const order = await getOrder(id);
  if (!order) return null;
  const hasValidToken = token && order.access_token === token;
  const ownsViaSession = sessionCustomerId && order.customer_id === sessionCustomerId;
  if (!hasValidToken && !ownsViaSession) return null;
  return order;
}

async function listOrdersForCustomer(customerId) {
  const { rows } = await query("SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC", [customerId]);
  return rows;
}

module.exports = {
  createOrder,
  attachRazorpayOrder,
  verifyPayment,
  handleWebhookEvent,
  listOrders,
  updateOrderStatus,
  requestReturn,
  markReturned,
  refundOrder,
  getSalesOverview,
  sweepExpiredOrders,
  getOrder,
  getOrderForCustomer,
  listOrdersForCustomer,
  OrderError,
};
