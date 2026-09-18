-- Customer accounts are additive, not a replacement for guest checkout -
-- orders.customer_id is nullable, so an order placed without logging in
-- still works exactly as before (access via the per-order token remains
-- the only way to view it).
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DB-backed sessions, not a stateless signed token - logout needs to be a
-- real revocation (delete the row), not just something that happens to
-- expire eventually regardless of what the user asked for.
CREATE TABLE customer_sessions (
  token TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);
