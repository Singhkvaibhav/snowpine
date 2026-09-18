-- Stock is decremented at order creation, before payment - without an
-- expiry, an abandoned checkout (customer closes the Razorpay widget, or
-- never opens it) permanently holds that stock hostage as a "pending"
-- order that will never be paid for. A handful of abandoned carts would
-- silently exhaust real inventory with no way to sell it.
ALTER TABLE orders ADD COLUMN expires_at TIMESTAMPTZ;
