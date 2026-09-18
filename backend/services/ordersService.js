const crypto = require("crypto");
const { withTransaction, query } = require("../db");
const {
  isConfigured,
  createRazorpayOrder,
  verifySignature,
  verifyWebhookSignature,
  keyId,
} = require("../razorpay");
const { sendOrderConfirmation, sendShippedNotification } = require("../email");

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

  return withTransaction(async (tx) => {
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
    }

    return order;
  });
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
  sweepExpiredOrders,
  getOrder,
  getOrderForCustomer,
  listOrdersForCustomer,
  OrderError,
};
