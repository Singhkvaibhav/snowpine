-- Tied to a customer account, not a guest-friendly localStorage list like
-- the cart - the whole point of a wishlist is coming back later, possibly
-- on a different device, which only a server-side record tied to a login
-- actually supports.
CREATE TABLE wishlist_items (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
