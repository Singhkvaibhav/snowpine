-- Returns/refunds as explicit order states, not a side effect of the
-- generic status PATCH - restocking and issuing money back through
-- Razorpay are consequential enough (inventory correctness, real money
-- moving) that they get their own service functions and admin actions
-- rather than being just another value passed to updateOrderStatus.
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'));

ALTER TABLE orders ADD COLUMN refund_id TEXT;
ALTER TABLE orders ADD COLUMN refunded_amount_inr NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN refunded_at TIMESTAMPTZ;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_reason_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('order_placed', 'order_released', 'admin_adjustment', 'return_restocked'));
