-- Stock changes today happen silently (an order decrements it, the
-- reservation sweep restores it, an admin edit overwrites it) with no way
-- to reconstruct why a product is at whatever quantity it's at. This is
-- the audit trail, plus a per-product threshold for "reorder soon" -
-- meaningful for imported goods where lead time is weeks, not days.
ALTER TABLE products ADD COLUMN reorder_point INTEGER NOT NULL DEFAULT 5;

CREATE TABLE stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('order_placed', 'order_released', 'admin_adjustment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stock_movements_product_id_idx ON stock_movements(product_id, created_at DESC);
