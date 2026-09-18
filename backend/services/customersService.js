const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { query } = require("../db");

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+ ]{10,15}$/;

class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function sanitize(customer) {
  const { password_hash, ...rest } = customer;
  return rest;
}

async function createSession(customerId) {
  const token = crypto.randomBytes(32).toString("hex");
  const { rows } = await query(
    `INSERT INTO customer_sessions (token, customer_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval) RETURNING *`,
    [token, customerId, SESSION_TTL_DAYS]
  );
  return rows[0];
}

async function signup({ email, password, name, phone }) {
  if (!email || !password || !name || !phone) {
    throw new AuthError("email, password, name, and phone are required");
  }
  if (!EMAIL_RE.test(email)) throw new AuthError("email is not a valid email address");
  if (!PHONE_RE.test(phone)) throw new AuthError("phone must be 10-15 digits");
  if (password.length < 8) throw new AuthError("password must be at least 8 characters");

  const { rows: existing } = await query("SELECT id FROM customers WHERE email = $1", [email]);
  if (existing.length > 0) throw new AuthError("An account with this email already exists", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO customers (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING *`,
    [email, passwordHash, name, phone]
  );
  const customer = rows[0];

  // A returning guest who checked out with this email before now gets
  // those orders attached to their new account, rather than leaving them
  // permanently stranded as guest-only orders only reachable by the
  // original tracking link.
  await query("UPDATE orders SET customer_id = $1 WHERE customer_email = $2 AND customer_id IS NULL", [
    customer.id,
    email,
  ]);

  const session = await createSession(customer.id);
  return { customer: sanitize(customer), session };
}

async function login({ email, password }) {
  if (!email || !password) throw new AuthError("email and password are required");

  const { rows } = await query("SELECT * FROM customers WHERE email = $1", [email]);
  const customer = rows[0];
  // Same generic error whether the email doesn't exist or the password is
  // wrong - distinguishing the two would let an attacker enumerate which
  // emails have accounts.
  const genericError = () => new AuthError("Invalid email or password", 401);
  if (!customer) throw genericError();

  const valid = await bcrypt.compare(password, customer.password_hash);
  if (!valid) throw genericError();

  const session = await createSession(customer.id);
  return { customer: sanitize(customer), session };
}

async function logout(token) {
  await query("DELETE FROM customer_sessions WHERE token = $1", [token]);
}

async function getCustomerBySession(token) {
  if (!token) return null;
  const { rows } = await query(
    `SELECT c.* FROM customer_sessions s
     JOIN customers c ON c.id = s.customer_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] ? sanitize(rows[0]) : null;
}

module.exports = { signup, login, logout, getCustomerBySession, AuthError };
