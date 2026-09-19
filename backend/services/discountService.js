const { query } = require("../db");

class DiscountError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

// Runs inside the caller's order-creation transaction (the passed `tx`,
// not the module-level `query`) - claiming a use and creating the order
// must commit or roll back together. Otherwise an order that later fails
// validation (or a race under a limited max_uses) could either burn a
// use for nothing or hand out one more use than the code allows - the
// same concern createOrder's `SELECT ... FOR UPDATE` on stock addresses,
// solved here with an atomic conditional UPDATE instead of a row lock
// since there's no separate row to re-read afterward.
async function redeemDiscountCode(tx, code, subtotalInr) {
  const normalized = normalizeCode(code);
  const { rows } = await tx(
    `UPDATE discount_codes SET uses_count = uses_count + 1
     WHERE code = $1 AND active = true
       AND (expires_at IS NULL OR expires_at > now())
       AND (max_uses IS NULL OR uses_count < max_uses)
     RETURNING *`,
    [normalized]
  );
  const discountCode = rows[0];
  // Deliberately one generic error for "doesn't exist"/"expired"/"used
  // up"/"deactivated" - same reasoning as customersService's login error:
  // distinguishing them would let a caller probe which codes are real.
  if (!discountCode) throw new DiscountError("Invalid or expired discount code");

  if (discountCode.min_order_inr && Number(subtotalInr) < Number(discountCode.min_order_inr)) {
    throw new DiscountError(
      `This code requires a minimum order of ₹${Number(discountCode.min_order_inr).toLocaleString("en-IN")}`
    );
  }

  const rawAmount =
    discountCode.type === "percent"
      ? (Number(subtotalInr) * Number(discountCode.value)) / 100
      : Number(discountCode.value);
  // Never discounts past zero (a flat code larger than the order) and
  // rounds to paise, same precision as every other money value here.
  const amount = Math.min(Math.round(rawAmount * 100) / 100, Number(subtotalInr));

  return { code: discountCode.code, amount };
}

async function listDiscountCodes() {
  const { rows } = await query("SELECT * FROM discount_codes ORDER BY created_at DESC");
  return rows;
}

async function createDiscountCode({ code, type, value, max_uses = null, min_order_inr = null, expires_at = null }) {
  if (!code || !type || value == null) throw new DiscountError("code, type, and value are required");
  if (!["percent", "flat"].includes(type)) throw new DiscountError('type must be "percent" or "flat"');
  if (Number(value) <= 0) throw new DiscountError("value must be greater than 0");
  if (type === "percent" && Number(value) > 100) throw new DiscountError("a percent value cannot exceed 100");

  const normalized = normalizeCode(code);
  const { rows: existing } = await query("SELECT id FROM discount_codes WHERE code = $1", [normalized]);
  if (existing.length > 0) throw new DiscountError("A discount code with this code already exists", 409);

  const { rows } = await query(
    `INSERT INTO discount_codes (code, type, value, max_uses, min_order_inr, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [normalized, type, value, max_uses, min_order_inr, expires_at]
  );
  return rows[0];
}

// Deliberately narrow - the code string and value/type stay fixed once
// created (an order that already redeemed a code recorded its literal
// amount, so changing the math after the fact wouldn't affect past
// orders and would just be confusing); only the controls an operator
// actually needs to adjust live are editable.
const EDITABLE_FIELDS = ["active", "max_uses", "min_order_inr", "expires_at"];

async function updateDiscountCode(id, fields) {
  const updates = [];
  const values = [];
  for (const field of EDITABLE_FIELDS) {
    if (field in fields) {
      values.push(fields[field]);
      updates.push(`${field} = $${values.length}`);
    }
  }
  if (updates.length === 0) throw new DiscountError("No editable fields provided");

  values.push(id);
  const { rows } = await query(
    `UPDATE discount_codes SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!rows[0]) throw new DiscountError("Discount code not found", 404);
  return rows[0];
}

module.exports = { redeemDiscountCode, listDiscountCodes, createDiscountCode, updateDiscountCode, DiscountError };
