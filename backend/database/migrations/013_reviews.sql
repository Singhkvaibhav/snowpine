-- One review per customer per product (not per order) - a customer who
-- bought the same item twice still only gets one say on it, the same
-- convention every major storefront uses. No order_id column: eligibility
-- ("did this customer actually receive this product") is checked live
-- against the orders table at write time rather than snapshotted, so it
-- can't go stale if order data is corrected after the fact.
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX reviews_product_id_idx ON reviews(product_id, created_at DESC);
