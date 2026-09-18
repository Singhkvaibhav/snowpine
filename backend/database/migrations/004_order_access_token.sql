-- Order IDs are sequential integers - trivially enumerable. Without this,
-- GET /api/orders/:id (used by the order-confirmation/tracking page) would
-- let anyone read any customer's name, email, phone, and address just by
-- incrementing the URL. A random per-order token, not the order id alone,
-- is what actually authorizes viewing an order.
ALTER TABLE orders ADD COLUMN access_token TEXT;
UPDATE orders SET access_token = md5(random()::text || id::text || clock_timestamp()::text) WHERE access_token IS NULL;
ALTER TABLE orders ALTER COLUMN access_token SET NOT NULL;
CREATE UNIQUE INDEX orders_access_token_idx ON orders(access_token);
