-- Discount codes as a real reservation system, not just a lookup table -
-- uses_count is incremented atomically at redemption time (see
-- discountService.redeemDiscountCode), the same "claim before you
-- commit" pattern createOrder already uses for stock, so a limited code
-- can't be handed out more times than max_uses under concurrent orders.
CREATE TABLE discount_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percent', 'flat')),
  value NUMERIC(10, 2) NOT NULL CHECK (value > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0,
  min_order_inr NUMERIC(10, 2) CHECK (min_order_inr IS NULL OR min_order_inr >= 0),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (type <> 'percent' OR value <= 100)
);

-- total_inr becomes subtotal minus discount_amount_inr once a code is
-- applied - discount_code/discount_amount_inr are recorded on the order
-- itself (not just derivable from discount_codes) so a code's history
-- stays intact even if the code is later edited or deactivated.
ALTER TABLE orders ADD COLUMN discount_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount_inr NUMERIC(10, 2) NOT NULL DEFAULT 0;
