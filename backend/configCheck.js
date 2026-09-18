// Fails fast and loud on unsafe production config, rather than booting
// into a silently broken state. The worst case this guards against isn't
// a crash - it's the app running "successfully" while giving away real,
// imported inventory for free because nobody noticed payments were never
// actually collected.
function check() {
  const errors = [];
  const warnings = [];

  if (process.env.NODE_ENV === "production") {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      errors.push(
        "RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not set - checkout would silently collect no payment " +
          "while still shipping real inventory (see razorpay.js's pluggable no-op fallback, which exists " +
          "for local dev, not for this)."
      );
    }
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      warnings.push(
        "RAZORPAY_WEBHOOK_SECRET is not set - payment confirmation relies solely on the client-side " +
          "redirect, which misses a payment if the customer's browser closes right after paying."
      );
    }
    if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes("localhost")) {
      errors.push(
        "FRONTEND_URL is unset or still points at localhost - every order confirmation email would " +
          "contain a broken tracking link."
      );
    }
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("localhost")) {
      errors.push("DATABASE_URL is unset or still points at localhost - almost certainly wrong in production.");
    }
    if (!process.env.ADMIN_TOKEN) {
      warnings.push(
        "ADMIN_TOKEN is not set - the admin panel fails closed (safe), but you won't be able to manage " +
          "orders or products until it's set."
      );
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

function assertValidConfig() {
  const { errors, warnings, ok } = check();

  for (const warning of warnings) console.warn(`[config warning] ${warning}`);

  if (!ok) {
    for (const error of errors) console.error(`[config error] ${error}`);
    console.error("Refusing to start: configuration is not safe to run in production. Fix the errors above.");
    process.exit(1);
  }
}

module.exports = { assertValidConfig, check };
