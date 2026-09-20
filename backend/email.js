// Pluggable like razorpay.js: unset SMTP_* -> emails print to the server
// log instead of sending (fine for local dev, nothing to configure). Set
// them -> real email goes out via nodemailer.
require("dotenv").config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
// Resend's shared test sender - works with no domain verification, but
// can only deliver to the email address the Resend account was signed up
// with. Swap in a verified custom domain's address via SMTP_FROM once one
// exists to send to real customers.
const FROM_ADDRESS = process.env.SMTP_FROM || "onboarding@resend.dev";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function isConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev] To: ${to}\nSubject: ${subject}\n\n${text}`);
    return;
  }
  await t.sendMail({ from: FROM_ADDRESS, to, subject, text });
}

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function renderOrderConfirmation(order) {
  // i.line_total already reflects a discount code applied pro-rata (see
  // ordersService.withTaxBreakdown) - using it here, not a fresh
  // unit_price_inr * quantity, keeps the email in sync with what the
  // customer was actually charged.
  const lines = order.items.map((i) => {
    return `  ${i.name} x${i.quantity} - ${inr(i.line_total)} (incl. GST ${(Number(i.gst_rate) * 100).toFixed(0)}%: ${inr(i.gst_amount)})`;
  });
  const totalGst = order.items.reduce((sum, i) => sum + i.gst_amount, 0);
  const totalTaxable = order.items.reduce((sum, i) => sum + i.taxable_value, 0);

  // access_token, not the (sequential, guessable) order id, is what
  // authorizes viewing the order at this link - see getOrderForCustomer.
  const trackingUrl = `${FRONTEND_URL}/order/${order.id}?token=${order.access_token}`;
  const text = [
    `Hi ${order.customer_name},`,
    "",
    `Your Snowpine order #${order.id} is confirmed.`,
    "",
    ...lines,
    "",
    ...(Number(order.discount_amount_inr) > 0
      ? [`Discount (${order.discount_code}): -${inr(order.discount_amount_inr)}`, ""]
      : []),
    `Taxable value: ${inr(totalTaxable)}`,
    `GST: ${inr(totalGst)}`,
    `Total (incl. GST): ${inr(order.total_inr)}`,
    "",
    `Shipping to: ${order.shipping_address}`,
    "",
    `Track your order: ${trackingUrl}`,
    "",
    "This is your order confirmation and tax invoice for GST purposes.",
    "We'll email you again once it ships.",
  ].join("\n");
  return { subject: `Snowpine order #${order.id} confirmed`, text };
}

async function sendOrderConfirmation(order) {
  const { subject, text } = renderOrderConfirmation(order);
  await sendMail({ to: order.customer_email, subject, text });
}

// The confirmation email promises "we'll email you again once it ships" -
// this is what actually keeps that promise, triggered from
// updateOrderStatus when an admin marks an order shipped.
async function sendShippedNotification(order) {
  const trackingUrl = `${FRONTEND_URL}/order/${order.id}?token=${order.access_token}`;
  const text = [
    `Hi ${order.customer_name},`,
    "",
    `Your Snowpine order #${order.id} has shipped.`,
    "",
    `Shipping to: ${order.shipping_address}`,
    "",
    `Track your order: ${trackingUrl}`,
  ].join("\n");
  await sendMail({ to: order.customer_email, subject: `Snowpine order #${order.id} has shipped`, text });
}

async function sendRefundConfirmation(order) {
  const text = [
    `Hi ${order.customer_name},`,
    "",
    `Your return for Snowpine order #${order.id} has been processed and refunded.`,
    "",
    `Refund amount: ${inr(order.refunded_amount_inr)}`,
    "",
    "It can take a few business days to reflect on your original payment method.",
  ].join("\n");
  await sendMail({ to: order.customer_email, subject: `Snowpine order #${order.id} refunded`, text });
}

// Fires once per pending order that's sat unpaid past a delay (see
// ordersService.sendAbandonedCartReminders) - a nudge back with a link
// that resumes the SAME order (same reserved stock, same Razorpay order),
// not a new checkout. Only makes sense while the reservation is still
// live and there's an actual payment to complete, which the caller's
// query already guarantees before this ever runs.
function renderAbandonedCartReminder(order) {
  const lines = order.items.map((i) => `  ${i.name} x${i.quantity}`);
  const trackingUrl = `${FRONTEND_URL}/order/${order.id}?token=${order.access_token}`;
  const text = [
    `Hi ${order.customer_name},`,
    "",
    "You started an order with Snowpine but didn't finish checking out:",
    "",
    ...lines,
    "",
    `Total: ${inr(order.total_inr)}`,
    "",
    `Complete your payment before the reservation expires: ${trackingUrl}`,
    "",
    "If the reservation expires first, these items go back into general stock and you'll need to place a new order.",
  ].join("\n");
  return { subject: "You left something in your cart - Snowpine", text };
}

async function sendAbandonedCartReminder(order) {
  const { subject, text } = renderAbandonedCartReminder(order);
  await sendMail({ to: order.customer_email, subject, text });
}

// Fires once per crossing into low stock (see productsService's
// maybeSendLowStockAlert), not on every order against an already-low
// product - otherwise a slow-moving low-stock item would spam this on
// every single sale instead of once when it actually needs attention.
// Silently no-ops without ADMIN_EMAIL set, same as every other optional
// integration here - inventory alerts are a convenience, not something
// that should block checkout if unconfigured.
async function sendLowStockAlert(product) {
  if (!ADMIN_EMAIL) return;
  const text = [
    `${product.name} has dropped to ${product.stock_quantity} units, at or below its reorder point of ${product.reorder_point}.`,
    "",
    `Manage it: ${FRONTEND_URL}/admin/products`,
  ].join("\n");
  await sendMail({ to: ADMIN_EMAIL, subject: `Snowpine: low stock - ${product.name}`, text });
}

module.exports = {
  isConfigured,
  sendMail,
  sendOrderConfirmation,
  sendShippedNotification,
  sendRefundConfirmation,
  sendAbandonedCartReminder,
  sendLowStockAlert,
};
