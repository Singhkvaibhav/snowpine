-- Indian courier delivery requires a contact phone number, not just email.
ALTER TABLE orders ADD COLUMN customer_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ALTER COLUMN customer_phone DROP DEFAULT;
