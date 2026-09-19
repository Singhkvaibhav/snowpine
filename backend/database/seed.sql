-- Curated launch catalog: two segments only (see README for the
-- reasoning) - Nordic baby/kids gear (small, light, non-bulky) and
-- Nordic home/design goods for the gifting market. Deliberately excludes
-- bulky items (strollers, car seats, furniture), perishable food
-- (import/customs/labeling complexity), and toy-classified items (HSN
-- 9503 carries a 70% basic customs duty in India - economically
-- non-viable at this rate; BRIO/Kid's Concept/Done by Deer were dropped
-- for this reason, not lack of demand).
--
-- Prices are landed-cost-based: (FOB * 1.15 freight/insurance) * (1 +
-- category BCD + 10% SWS) + flat logistics, then a 3x multiplier (mid-
-- point of a 2.5-3.5x heuristic for imported D2C in India, sized to
-- absorb COD/RTO losses). FOB costs are still placeholder estimates,
-- not real supplier quotes - replace with actual landed costs once
-- sourcing is confirmed, and sanity-check against real India retail
-- comparables (e.g. Fjällräven's own India pricing) before launch.
--
-- Per-category basic customs duty (BCD) used, by HSN heading - GET THESE
-- RECONFIRMED WITH A CUSTOMS BROKER (CHA) BEFORE SOURCING, some are
-- placeholders where public rate data was unclear or the exact 8-digit
-- classification depends on the specific product's material/construction:
--   bags       (HSN 4202, carriers/totes/backpacks)         BCD 15%
--   textile    (HSN 6111/6209/6301/6302, wool/muslin/throws) BCD 20%
--   plastic    (HSN 3924, silicone/plastic baby items)       BCD 15%
--   homeDecor  (HSN 7013/6911/74xx/44xx, glass/porcelain/    BCD 10% (unverified placeholder)
--               metal/wood decor)
--   tools      (HSN 8201/8213, hand tools/scissors)          BCD 10%
--   skincare   (HSN 3304, cosmetics/skincare)                BCD 20%

INSERT INTO products (name, description, origin_country, category, price_inr, stock_quantity, image_url) VALUES
  -- Segment 1: Nordic Baby & Kids
  ('BabyBjörn Baby Carrier Mini', 'Soft, lightweight newborn carrier from Sweden''s best-known baby brand.', 'Sweden', 'Baby Carriers', 14099.00, 10, NULL),
  ('BabyBjörn Teething & Chewing Toy', 'Soft silicone teether, BPA-free.', 'Sweden', 'Baby Feeding', 2699.00, 25, NULL),
  ('Elodie Details Pacifier Clip', 'Scandinavian-designed pacifier clip in soft cotton.', 'Sweden', 'Baby Feeding', 2999.00, 25, NULL),
  ('Elodie Details Muslin Bib Set', 'Set of soft muslin bibs with Nordic prints.', 'Sweden', 'Baby Feeding', 3699.00, 15, NULL),
  ('Elodie Details Changing Pad Pouch', 'Portable changing pad that folds into a pouch.', 'Sweden', 'Baby Bedding', 5799.00, 15, NULL),
  ('Liewood Silicone Plate & Cup Set', 'Danish-designed silicone dinnerware for toddlers.', 'Denmark', 'Baby Feeding', 5199.00, 15, NULL),
  ('Liewood Wooden Pacifier Clip', 'Beechwood and silicone pacifier clip.', 'Denmark', 'Baby Feeding', 2999.00, 25, NULL),
  ('Filibabba Muslin Baby Blanket', 'Soft muslin swaddle blanket, GOTS-certified cotton.', 'Denmark', 'Baby Bedding', 5399.00, 15, NULL),
  ('Joha Merino Wool Baby Bodysuit', 'Danish merino wool bodysuit for temperature regulation.', 'Denmark', 'Baby Clothing', 7599.00, 15, NULL),
  ('CeLaVi Wool Baby Suit', 'Warm wool baby suit, Danish design.', 'Denmark', 'Baby Clothing', 8399.00, 10, NULL),
  ('Reima Fleece Mittens & Beanie Set', 'Finnish technical kidswear brand, warm fleece set.', 'Finland', 'Baby Clothing', 5999.00, 15, NULL),
  ('Stokke Tripp Trapp Newborn Set', 'Newborn cushion insert for the Tripp Trapp high chair.', 'Norway', 'Baby Bedding', 13199.00, 10, NULL),

  -- Segment 2: Nordic Home, Design & Gifting
  ('Iittala Kastehelmi Bowl', 'Finnish glassware with a dewdrop pattern.', 'Finland', 'Tableware', 3399.00, 15, NULL),
  ('Iittala Taika Mug', 'Finnish porcelain mug with a forest-inspired print.', 'Finland', 'Tableware', 5099.00, 15, NULL),
  ('Marimekko Unikko Tote Bag', 'Finnish design house tote bag with the classic poppy print.', 'Finland', 'Bags', 7599.00, 15, NULL),
  ('Marimekko Unikko Cushion Cover', 'Cotton cushion cover with the iconic Unikko poppy print.', 'Finland', 'Home Decor', 6999.00, 15, NULL),
  ('Marimekko Oiva Mug', 'Minimalist Finnish stoneware mug.', 'Finland', 'Tableware', 3999.00, 15, NULL),
  ('Georg Jensen Stainless Steel Cutlery Set', 'Premium Danish cutlery set, 24-piece.', 'Denmark', 'Kitchenware & Tools', 41799.00, 10, NULL),
  ('Georg Jensen Bloom Candle Holder', 'Sculptural stainless steel candle holder.', 'Denmark', 'Home Decor', 11899.00, 10, NULL),
  ('Royal Copenhagen Mini Ornament', 'Fine porcelain ornament, hand-painted.', 'Denmark', 'Tableware', 6199.00, 15, NULL),
  ('Kay Bojesen Wooden Monkey Figurine', 'Iconic Danish design object, hand-turned teak.', 'Denmark', 'Home Decor', 16699.00, 10, NULL),
  ('HAY Kitchen Tea Towel Set', 'Danish design house kitchen textiles, set of two.', 'Denmark', 'Textiles', 4199.00, 15, NULL),
  ('Muuto Small Candle Holder', 'Minimalist Scandinavian candle holder.', 'Denmark', 'Home Decor', 5199.00, 15, NULL),
  ('Skagerak Wooden Serving Board', 'FSC-certified oak serving board, Danish design.', 'Denmark', 'Kitchenware & Tools', 9499.00, 10, NULL),
  ('Fjällräven Kånken Mini Backpack', 'Compact version of the iconic Swedish backpack.', 'Sweden', 'Bags', 12599.00, 10, NULL),
  ('Klippan Wool Throw Blanket', 'Small lambswool throw, woven in Sweden since 1879.', 'Sweden', 'Textiles', 12399.00, 10, NULL),
  ('Arabia Small Mug', 'Finnish tableware brand, sister company to Iittala.', 'Finland', 'Tableware', 3599.00, 15, NULL),

  -- Segment 3: Finland-specific additions - Moomin (existing India TV
  -- nostalgia via Cartoon Network/POGO), Fiskars (globally recognized,
  -- lower price-anchor item), Lumene (Nordic skincare, taps India's
  -- beauty market rather than gifting/baby)
  ('Arabia Moomin Mug - Moominmamma', 'Official Arabia porcelain mug featuring Moominmamma.', 'Finland', 'Tableware', 4099.00, 15, NULL),
  ('Arabia Moomin Mug - Little My', 'Official Arabia porcelain mug featuring Little My.', 'Finland', 'Tableware', 4699.00, 15, NULL),
  ('Arabia Moomin Bowl', 'Official Arabia porcelain bowl from the Moomin collection.', 'Finland', 'Tableware', 5499.00, 15, NULL),
  ('Arabia Moomin Egg Cup Set', 'Set of two Moomin-print porcelain egg cups.', 'Finland', 'Tableware', 6199.00, 15, NULL),
  ('Fiskars Classic Orange-Handled Scissors', 'The original 1967 Fiskars scissors design.', 'Finland', 'Kitchenware & Tools', 1799.00, 25, NULL),
  ('Fiskars Garden Pruning Shears', 'Precision pruning shears, Finnish steel.', 'Finland', 'Kitchenware & Tools', 3999.00, 15, NULL),
  ('Fiskars Functional Form Kitchen Knife', 'Ergonomic Finnish-designed kitchen knife.', 'Finland', 'Kitchenware & Tools', 4699.00, 15, NULL),
  ('Fiskars Multi-Purpose Scissors', 'Compact all-purpose scissors for home use.', 'Finland', 'Kitchenware & Tools', 2199.00, 25, NULL),
  ('Lumene Valo Vitamin C Glow Serum', 'Nordic vitamin C serum with Arctic cloudberry.', 'Finland', 'Skincare', 3999.00, 20, NULL),
  ('Lumene Lähde Nordic Hydra Sensitive Toner', 'Alcohol-free hydrating toner with Arctic spring water.', 'Finland', 'Skincare', 3199.00, 20, NULL),
  ('Lumene Kaunis Birch Sap Moisturizer', 'Moisturizer formulated with Finnish birch sap.', 'Finland', 'Skincare', 3599.00, 20, NULL),
  ('Lumene Arctic Aha Cloudberry Enzyme Gel Wash', 'Gentle enzyme cleanser with Arctic cloudberry.', 'Finland', 'Skincare', 2799.00, 20, NULL);

-- gst_rate defaults to 18% (see migration 005_gst.sql). Tableware (glass/
-- porcelain, HSN 7013/6911) likely moved to the 5% slab in the Sept 2025
-- reform - reconfirm with a CA before relying on this for real filings.
UPDATE products SET gst_rate = 0.05 WHERE category = 'Tableware';
