-- Tracks whether an abandoned-cart reminder has already gone out for this
-- order - a nullable timestamp rather than a boolean so "when" is
-- inspectable later, and the sweep's WHERE clause can filter on it
-- directly (IS NULL) without a separate lookup table.
ALTER TABLE orders ADD COLUMN abandoned_email_sent_at TIMESTAMPTZ;
