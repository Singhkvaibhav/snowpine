// Pluggable like storage/email in ParentOS: unset RAZORPAY_* env vars ->
// payments are a no-op and checkout falls back to creating an unpaid
// "pending" order (fine for local dev/demo). Set real keys -> real
// payment collection turns on.
const crypto = require("crypto");
require("dotenv").config();

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

function isConfigured() {
  return Boolean(KEY_ID && KEY_SECRET);
}

function isWebhookConfigured() {
  return Boolean(WEBHOOK_SECRET);
}

let client = null;
function getClient() {
  if (!isConfigured()) return null;
  if (!client) {
    const Razorpay = require("razorpay");
    client = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  }
  return client;
}

// amountInr: rupees (decimal); Razorpay orders are created in paise.
async function createRazorpayOrder(amountInr, receiptId) {
  const rp = getClient();
  if (!rp) return null;
  const order = await rp.orders.create({
    amount: Math.round(amountInr * 100),
    currency: "INR",
    receipt: String(receiptId),
  });
  return order;
}

// Per Razorpay's documented client-side checkout flow: the payment is
// authentic iff HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id,
// key_secret) matches the signature Razorpay's checkout.js returned to
// the browser - the secret never leaves the server, so this can't be
// forged by a client sending fabricated ids.
function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!isConfigured()) return false;
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  return expected === razorpay_signature;
}

// Webhook signature: HMAC-SHA256 of the *raw* request body using the
// separate webhook secret configured in the Razorpay dashboard (not the
// API key_secret). This is the server-authoritative confirmation path -
// it fires even if the customer's browser closes right after paying,
// before the client-side `handler` callback in Checkout.jsx can run.
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!isWebhookConfigured() || !signatureHeader) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return expected === signatureHeader;
}

module.exports = {
  isConfigured,
  isWebhookConfigured,
  createRazorpayOrder,
  verifySignature,
  verifyWebhookSignature,
  keyId: KEY_ID,
};
