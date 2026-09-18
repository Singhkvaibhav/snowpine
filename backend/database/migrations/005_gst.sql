-- price_inr/unit_price_inr are GST-inclusive MRP (standard Indian retail
-- convention), but nothing tracked the applicable rate, so no order could
-- show the tax breakdown a GST-registered seller is legally required to
-- disclose on every sale. gst_rate is snapshotted onto order_items at
-- order time (like unit_price_inr already is) rather than looked up from
-- products later - GST rates change (see the Sept 2025 reform that moved
-- most 12% items to 5%), and a past order's invoice must reflect the rate
-- that applied when it was placed, not whatever the rate is today.
ALTER TABLE products ADD COLUMN gst_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.18;
ALTER TABLE order_items ADD COLUMN gst_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.18;

-- Glass/porcelain tableware (HSN 7013/6911) likely moved from the old 12%
-- slab to 5% in the Sept 2025 GST reform - see seed.sql's duty notes.
-- Everything else defaults to 18% above. GET THIS RECONFIRMED WITH A CA
-- before relying on it for real filings.
UPDATE products SET gst_rate = 0.05 WHERE category = 'Tableware';
