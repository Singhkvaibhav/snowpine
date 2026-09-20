# Snowpine

An online fulfillment shop bringing European/Nordic products to India.

## Stack

- **Frontend** - React + Vite
- **Backend** - Node + Express
- **Database** - PostgreSQL

## Quick start

Requires **Node 18+** and **PostgreSQL 16**.

```bash
cp backend/.env.example backend/.env   # then fill in real values
createdb snowpine
npm run migrate
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173 (proxies /api)
```

Leave `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` unset to run without payment
collection (checkout places an unpaid "pending" order - fine for local
dev/demo). Set real test-mode keys from [razorpay.com](https://razorpay.com)
to test the actual payment flow, and `RAZORPAY_WEBHOOK_SECRET` once you've
added the webhook URL (`/api/webhooks/razorpay`) in the Razorpay dashboard.
Set `ADMIN_TOKEN` to a long random string to enable `/admin` (order list +
status updates) - it's the only thing gating that page, so treat it like a
password; leave unset to disable admin access entirely.

## Testing

```bash
createdb snowpine_test   # once
npm test                 # backend (Jest) + frontend (Vitest)
```

**CI** (`.github/workflows/ci.yml`) runs all of this automatically on
every push/PR to `main`: backend tests against a real Postgres service
container, frontend tests + production build, and a `docker-build` job
that builds the real backend image and validates the nginx config syntax
(the exact commands used to manually validate `deploy/nginx/snowpine.conf`
throughout this build - run verbatim locally before committing this
workflow, not just "something similar"). Only takes effect once this repo
has a GitHub remote and gets pushed - not active yet on a local-only repo.

**Backend** - Jest + Supertest, against a **real** `snowpine_test` Postgres
database, not mocks - the concurrency test below is exactly the kind of
bug a mock would hide. 152 tests covering: order creation/validation, GST
tax-breakdown math, the order-access-token authorization fix, Razorpay
payment verification + webhook confirmation, the reservation-expiry
sweep, admin auth/product management, rate limiting, customer accounts
(signup/login/logout, session-based order access, guest-order retroactive
linking, and that one customer can't view another's order), the
stock-movement audit trail (correct deltas for order/release/admin-edit
paths, and the low-stock list updating as stock crosses the threshold),
the low-stock email alert (fires exactly on the crossing into low stock,
not on every sale of an already-low item, and not on unrelated edits or
restocks), the sales overview (revenue counted only from
paid/shipped/delivered orders, top-products aggregation across multiple
orders), the returns/refunds state machine (each of the three
transitions rejects being called out of order, restocking uses the real
audit trail, and the refund path calls a mocked Razorpay refund with the
correct payment id and amount), discount codes (percent/flat math,
minimum-order and expiry/deactivation rejections, `max_uses` enforced
across separate concurrent-style requests without over-redeeming, a
failed order never consuming a use, and the GST breakdown reflecting the
discount pro-rata rather than the pre-discount price), abandoned-cart
reminders (fires once inside the delay-to-expiry window, never before the
delay or after expiry, never for an order with nothing to click through
to, never twice, and never for a paid order), the wishlist (requires
login, idempotent add/remove, 404 on a nonexistent product, and one
customer's saved items never leak into another's), and reviews (only a
customer with an order that reached "delivered" can review a product,
submitting again updates the existing review rather than duplicating it,
rating/body validation, and the rating aggregate on `GET /api/products`
reflecting a submitted review).
Runs with `--runInBand --forceExit` - serial because test files share one
real database; `--forceExit` only after directly ruling out a real leak
(see `tests/teardown.js` for the investigation - it's a Jest-runner
artifact from many isolated per-file module registries, not something
the running server actually does).

**Frontend** - Vitest + React Testing Library, 88 tests covering
`CartContext` (the source of truth for what a customer is about to buy),
`Home`'s search/category filtering, `ProductThumb`'s category-icon logic,
`ProductDetail`'s quantity stepper/related-products/add-to-cart-with-
quantity, `Cart`'s line/order totals and remove behavior, `usePageMeta`'s
per-route title/description, `AuthContext`/`MyOrders` (login state,
redirect-when-logged-out), `OrderConfirmation`'s GST display, discount
breakdown, and payment-retry flow (verified the retry reopens Razorpay on
the *same* `razorpay_order_id`, not a new one - the exact behavior the
double-reservation fix depends on), the wishlist (`WishlistContext`'s
optimistic toggle reverting on a failed request, `WishlistButton`
redirecting a logged-out click to `/login` instead of toggling and never
triggering the surrounding product-card `<Link>`'s navigation, and
`MyWishlist`'s empty/populated/out-of-stock states), and `ReviewsSection`
(logged-out/ineligible/eligible states each rendering the right UI, the
submit button disabled until a star is picked, and editing/deleting an
existing review).

A few worth calling out because they test actual bugs this project hit,
not hypotheticals:
- `ordersConcurrency.test.js` - fires two simultaneous checkouts at the
  last unit of stock and asserts exactly one wins; this is what the
  `SELECT ... FOR UPDATE` row lock in `ordersService.createOrder` exists
  to guarantee, and a test using a mocked database could never catch a
  regression here.
- `razorpayFailure.test.js` - regression test for the orphaned-order bug
  caught during manual testing (see Status below).
- `reservationExpiry.test.js` - regression test for the stock-exhaustion
  bug (abandoned checkouts permanently holding stock).
- `orders.test.js`'s access-control tests - regression tests for the PII
  leak (order ids were enumerable with no authorization at all).

**Known dependency advisories (`npm audit`), deliberately not force-fixed:**
`vite`/`vitest`/`esbuild` flag path-traversal issues, but all three are
dev-server-only - never present in the static `vite build` output nginx
actually serves, so only reachable if someone can hit a developer's local
dev server directly. `react-router-dom` flags an open-redirect CVE with no
patched v6 release (only fixed in v7, a breaking migration) - checked our
actual usage first: every `<Link to=>`/`navigate()` call here uses a
static path or a value from our own trusted API data (product/order ids),
never attacker-controlled text, which is what that CVE requires to be
exploitable. Forcing a routing-library major-version migration to close a
vulnerability this codebase doesn't actually trigger isn't a good trade -
revisit if that usage pattern ever changes.

## Project structure

```
backend/
  server.js       Express app entrypoint
  db.js           Postgres pool + startup migrate/seed
  migrate.js      runs database/migrations/*.sql in order, once each
  razorpay.js     pluggable payment client - no-op when unconfigured
  configCheck.js  refuses to boot on unsafe production config
  middleware/     adminAuth, customerAuth, rateLimit
  routes/         thin route handlers per resource (incl. auth.js)
  services/       business logic + queries (incl. customersService.js)
  database/
    migrations/   one numbered file per schema change
    seed.sql      sample product data (dev only)
  tests/          Jest + Supertest, against a real database (see Testing)

frontend/
  src/
    pages/        page-level components (incl. legal/ and admin/ pages)
    components/   shared UI (ProductThumb placeholder imagery)
    cart/         CartContext - localStorage-backed cart state
    auth/         AuthContext - cookie-session-backed login state
    api/          backend API client
    styles.css    design system (icy winter palette, Fraunces + Inter)
    *.test.jsx    Vitest + React Testing Library, alongside the files
                  they test (see Testing)
```

## Status

**Design** - a real visual identity (Fraunces serif for headings/brand
paired with Inter for body text, an icy winter palette actually fitting
the "Snowpine" name, a hero section, unified search+category toolbar,
consistent card heights via line-clamped names) replacing the earlier
bare-bones styling.

**UX pass based on real review feedback** (not self-directed guesses):
- **Placeholder thumbnails were the single biggest issue** - most of the
  catalog sits in a few categories (Tableware, Baby Feeding), so coloring
  by category rendered as a near-monotone wall of blue. `ProductThumb.jsx`
  now hashes color from the product NAME into a 12-color palette spanning
  distinct hue families (blue/green/red/purple/yellow), not shades of one
  hue - `ProductThumb.test.jsx` was deliberately rewritten (same-category
  consistency was the old contract; same-name determinism + real variety
  across names is the new one) since the old test asserted the exact
  behavior being changed, not a fixed bug. Thumb aspect ratio also
  dropped from 1:1 to 4:3 so the placeholder doesn't dominate the card.
- **Mobile header ate roughly a sixth of the screen** while staying
  sticky - the tagline, nav links, and cart pill could each wrap onto
  their own row. Now hidden tagline + tightened spacing below 640px,
  and `.nav-links` stays one non-wrapping unit so it collapses to at
  most two rows instead of three-plus.
- **A dozen category pills wrapped onto three rows on mobile** - now a
  horizontally scrolling strip below that width, the standard pattern
  for this.
- **"Cutlery & Kitchenware" and "Kitchenware & Tools" overlapped** -
  merged into one category in `seed.sql` (real data cleanup, not a
  display-only fix - 10 categories now, not 11).
- **Added**: sort-by-price and origin-country filters in the toolbar, a
  stock/delivery hint on every card ("Only N left" below the reorder-
  point-adjacent threshold, otherwise "In stock · ships in 5-10 days"),
  and a shipping-estimate + Shipping & Returns link in the hero. The
  product detail page and per-card click-through to it already existed
  from earlier in the build - not a gap, just not obvious from a
  screenshot alone.

**Significant UI/UX pass** (self-directed, in response to "still looks very
basic" feedback - a from-scratch visual/interaction upgrade, not another
round of small fixes):
- **Placeholder thumbnails redesigned from a plain color+initial block into
  category-matched line-icon illustrations** (`ProductThumb.jsx`) - a
  bottle for Baby Feeding, a mug-with-handle for Tableware, a droplet for
  Skincare, etc., across all 10 categories, each icon built only from
  primitive SVG shapes (circle/rect/line/ellipse/one well-known arc or
  teardrop path) so there's no risk of a hand-tuned bezier curve rendering
  as a blob. Still hashes the base color from the product NAME (the fix
  from the previous round), just with a real pictogram on top instead of
  a bare letter. `ProductThumb.test.jsx` rewritten again since the
  contract changed again - this time asserting the right icon shape
  renders per category and an unrecognized category falls back to a
  generic gift-box icon, not asserting on letter text that no longer
  exists.
- **Hero rebuilt** as a two-column layout on wider screens: copy + a
  primary "Shop the collection" CTA (anchors down to the grid) on the
  left, a decorative Nordic-landscape illustration (layered mountains,
  a sun, a snowflake - all inline SVG, `aria-hidden`) on the right. Trust
  badges upgraded from plain bullet dots to actual icons.
- **Product detail page rebuilt from nearly empty to a real PDP**: a
  breadcrumb (Shop / Category / Product - the category link actually
  filters the shop page via a `?category=` param `Home.jsx` now reads on
  mount), a quantity stepper (bounded by real stock, not just a bare
  "Add to cart"), a trust-signal list (secure payment, GST invoice,
  delivery estimate), and a "You may also like" row of same-category
  products. New `ProductDetail.test.jsx` covers the stepper's bounds, that
  related products exclude the current item and other categories, and
  that add-to-cart actually uses the selected quantity.
- **Cart rebuilt** from a bare HTML table into item cards (with the same
  category-icon thumbnail, now hashed onto cart items too - `CartContext`
  stores `category` per line item for this) plus a sticky order-summary
  sidebar, replacing a raw number `<input>` with the same quantity-stepper
  pattern the product page uses. New `Cart.test.jsx`.
- **Checkout given an order-summary sidebar** - previously the form was
  the entire page and a customer filling it out couldn't see what they
  were actually buying. Also fixed two real bugs this surfaced: the
  Razorpay widget was passed the cart's pre-discount `total` instead of
  the order's actual (possibly discounted) total as `amount`, and would
  have shown a payment amount mismatch to any customer using a discount
  code.
- **Order confirmation wrapped in a card** matching the rest of the site
  (it was rendering directly on the page background before, the only
  page that did), with a green check icon for paid/shipped/delivered
  orders.
- **Mobile product grid switched from 1 to 2 columns** below 480px -
  with 39 placeholder-thumbnail products, a single full-width column was
  a very long scroll for very little information per screen.
- **Footer expanded** from a single copyright line into brand blurb +
  Shop/Help link columns, matching a real site footer instead of reading
  like a placeholder.

A caught-and-fixed bug from this work, not a design decision: the first
draft of `Cart.test.jsx` seeded cart items by calling `addItem` directly
in a test component's render body with no guard - since `addItem` changes
`CartProvider`'s state, every state change re-rendered the seed component,
which called `addItem` again, forever. Moved the seed into a `useEffect`
with a ran-once ref; startup-hang bugs like this are exactly why this
project runs tests with everything actually verified, not left running
in the background unread.

**Admin panel polish** - a follow-up pass on the same "still looks very
basic" feedback, scoped down for what's actually a single-operator
internal tool rather than given the storefront's full treatment:
- **`AdminNav.jsx`** - one shared sub-navigation component (styled as
  underlined tabs, active route highlighted) replacing five hand-copied
  plain-text link lines, one per admin page, that had no mechanism
  keeping them in sync - each had stayed correct so far purely by care
  taken while adding new admin pages, not by anything structural
  preventing drift.
- **Tables wrapped in a real card** (`.admin-card`) with a sticky header
  row, zebra striping, and row hover - the Products table (39 rows, all
  inline-editable) was the worst offender, a dense wall of table rows
  directly on the page background with nothing to anchor it visually.
- **Sales overview's numbers turned into actual stat cards** instead of
  a plain label-over-heading pair floating on the page.
- **Discount codes' status column turned into color-coded pills**
  (green/active, grey/deactivated, amber/expired-or-used-up) instead of
  plain text - scannable at a glance across many codes.
- **Two real display bugs fixed, both from the returns/refunds feature
  not being propagated everywhere a status/reason is shown**:
  `AdminStockActivity`'s reason column had no label for
  `return_restocked`, so it fell back to printing the raw enum value
  instead of "Returned & restocked" like every other reason already did;
  `AdminSalesOverview`'s "Orders by status" table iterated a hardcoded
  five-status list that predated `return_requested`/`returned`/
  `refunded`, so any order in one of those states was silently missing
  from the breakdown entirely rather than showing as zero or counted.

**Inventory management** - `stock_movements` audit log plus a per-product
`reorder_point`. Every real stock change (an order placed, an expired
reservation released back, an admin's manual correction) is logged with
its actual delta and reason, not just silently applied - `/admin/stock-
activity` shows the full history, and low-stock products are highlighted
directly in `/admin/products`. An `ADMIN_EMAIL` alert (`sendLowStockAlert`
in `email.js`) fires the moment a product crosses INTO low stock - not on
every subsequent sale of an already-low item, which would spam the inbox
for a slow-moving product instead of flagging it once when it actually
needs attention. Verified live: created a product at stock 6/reorder
point 5, placed an order for 2, confirmed the alert logged with the
correct post-order quantity (4) and product name.

Deliberately did NOT build sales forecasting alongside this: the store
has zero sales history pre-launch, and fitting a forecasting model to no
data is worse than not having one - simple methods (moving averages,
etc.) become worth building once a few months of real orders exist to
learn from.

**Sales overview** (`/admin/sales`) - total revenue, order counts by
status, and top-selling products by units/revenue. Descriptive only, on
purpose (see above) - counts paid/shipped/delivered orders as revenue,
explicitly excluding pending (may never be paid) and cancelled (reversed)
orders, which would otherwise overstate it.

**Abandoned-cart recovery email** - rides the same in-process 5-minute
sweep that already released expired reservations (`server.js`), just
looking at a different time window: a "pending" order older than
`ABANDONED_CART_EMAIL_DELAY_MINUTES` (default 15) but still inside its
`RESERVATION_TTL_MINUTES` window (default 30) gets a one-time reminder
email with a link back to the SAME order - not a fresh checkout, so it
resumes the same Razorpay order and the same reserved stock. Guarded
three ways: `abandoned_email_sent_at IS NULL` caps it to exactly one
reminder ever per order (a failed send leaves this NULL so the next tick
retries, bounded by however many ticks fit before expiry); excludes any
order already past its own expiry (about to be, or already, released by
the other half of the same sweep); and excludes any order with no
`razorpay_order_id` (Razorpay unconfigured, or the attach step hasn't run
yet) since there'd be nothing for the customer to click through to.
Verified live against the running dev API: with Razorpay unconfigured
locally, an aged order correctly gets skipped rather than emailing a
broken link.

**Wishlist / save for later** (`/account/wishlist`) - tied to a customer
account, not a guest-friendly `localStorage` list like the cart, since
the entire point of a wishlist is that it's still there later, possibly
on a different device - only a server-side record tied to a login
actually supports that. A heart-icon toggle (`WishlistButton.jsx`)
overlays every product thumbnail (grid cards, related products, the
detail page's main image) plus a labeled "Save for later" variant next
to the detail page's "Add to cart"; clicking it while logged out routes
to `/login` instead of silently failing or toggling nothing.
`WishlistContext` updates optimistically and reverts on a failed
request, so the heart flips state immediately rather than waiting on a
round trip. Add/remove are both idempotent (`ON CONFLICT DO NOTHING` /
deleting a row that isn't there) since a heart-icon toggle can't cleanly
distinguish "already saved" from a genuine double-click race, and
neither case should surface as an error. Verified end-to-end against the
running dev API and visually via Playwright: logged-out click redirects
to login, a fresh signup + save renders the filled heart and lists the
product on `/account/wishlist` with a working "Add to cart".

**Product reviews & ratings** - the single biggest trust signal available
given there's no real product photography yet (`ReviewsSection.jsx`,
below the trust-list on the product detail page). Gated on a verified
purchase, not just a login: `reviewsService.canReview` requires an order
for that product currently in `delivered`/`return_requested`/`returned`/
`refunded` - any of which necessarily passed through `delivered` first
per the order state machine, so checking the current status alone is
enough without keeping a separate status history. One review per
customer per product (`UNIQUE (customer_id, product_id)`); submitting
again is an upsert (`ON CONFLICT ... DO UPDATE`), not a duplicate or a
rejection, since a customer changing their mind later is normal, not an
error case. A reviewer's full signup name is truncated to first name +
last initial ("Priya Sharma" → "Priya S.") before ever being shown
publicly - a full legal name is more exposure than a public review
needs. `productsService.listProducts`/`getProduct` join in the rating
average/count directly (`LEFT JOIN` a `GROUP BY` subquery) so a rating
badge on every card in the 39-product grid comes for free in the
storefront's existing product-list call, rather than one extra round
trip per card. Caught a real rendering bug while verifying this live:
the star icons defaulted to solid black instead of grey/gold, because
neither `StarRating` nor `RatingInput` had ever set `fill="currentColor"`
on the `<svg>` - the CSS `color` rules were correct and simply had
nothing to apply to. No moderation/flagging admin UI yet - the
verified-purchase requirement is the primary spam defense for now.

**Discount codes** (`/admin/discount-codes`) - percent-off or flat-₹-off
codes with an optional minimum order value, expiry date, and `max_uses`
cap. Redeeming a code claims a use with the same atomic-conditional-UPDATE
pattern the stock reservation already relies on
(`discountService.redeemDiscountCode`, run inside the same DB transaction
as order creation), so a limited code can't be over-redeemed under
concurrent checkouts and a failed order never burns a use it shouldn't
have. The discount is applied pro-rata across line items, not just
subtracted from the order total, so the GST breakdown (and the order
confirmation email) reflects what was actually paid per item rather than
the pre-discount price - a discount known at the time of sale is meant to
reduce taxable value under GST, not sit outside it. Invalid/expired/
deactivated/used-up codes all return the same generic error, the same
reasoning as the login flow's generic error: distinguishing them would
let a caller probe which codes exist. Verified end-to-end against the
running dev API and visually via Playwright (checkout with a code ->
order confirmation showing subtotal/discount/GST/total all correctly
recomputed).

**Returns & refunds** - a real state machine, not a value bolted onto the
generic status PATCH: `delivered → return_requested → returned →
refunded`, each transition its own admin action (`POST /admin/orders/:id/
return|restock|refund`) that rejects being called out of order rather
than accepting any status a caller hands in. `returned` restocks every
line item and logs it to the same `stock_movements` audit trail as every
other stock change (tagged `return_restocked`, distinct from an
`admin_adjustment`, so reconstructing why a product is at its current
quantity stays accurate). `refunded` calls Razorpay's refund API against
the order's real `razorpay_payment_id` for the full amount and records
the resulting `refund_id`/`refunded_amount_inr`/`refunded_at`; a demo/dev
order that never went through real Razorpay payment still moves to
`refunded` for bookkeeping, just without a real refund call, matching the
pluggable pattern the rest of the payment/email integrations already use.
Sends a refund-confirmation email through the existing `email.js`
pipeline. Verified end-to-end against the running dev API and visually in
the admin UI (`/admin`'s new "Returns" column swaps between "Request
return"/"Mark restocked"/"Refund" based on the order's current status).

**Email delivery** - `email.js` was already pluggable (real SMTP via
nodemailer when configured, console-log fallback otherwise); what was
missing was an actual provider. Defaults to Resend's shared
`onboarding@resend.dev` test sender when `SMTP_FROM` is unset, which
needs no domain verification but can only deliver to the Resend account's
own signup address - swap in a verified custom domain's address once one
exists to email real customers.

**SEO basics** - honest about what a client-rendered SPA can and can't do
here without a bigger SSR/prerendering investment. `usePageMeta.js` sets
`document.title` and the meta description per route (product name +
description on the detail page, a page-specific title everywhere else,
reverting to the site default when a page doesn't set one - otherwise the
*previous* page's title would leak into the next one). `GET /api/sitemap.xml`
generates a sitemap from live product data on every request rather than a
static file that goes stale as the catalog changes; `frontend/public/robots.txt`
declares it via a `Sitemap:` directive (needed since this route lives
under `/api/`, not the site root - see the route's own comment for why)
and disallows `/admin` and `/order/` (the latter carries an
authorization token in the URL and should never be indexed). Static
Open Graph/Twitter meta tags in `index.html` cover crawlers that don't
execute JS at all; deliberately no `og:image` since there's no real
product photography yet - a broken image in a share preview is worse
than none. What this does NOT solve: a crawler that doesn't execute
JavaScript still only ever sees the homepage's static title/description,
never a real product's - that needs SSR or prerendering, a meaningfully
bigger change than "basics."

**Customer accounts** - `customers`/`customer_sessions` tables, cookie-
based sessions (DB-backed, not a stateless signed token - logout is a
real revocation, deleting the session row, not just something that
happens to expire eventually regardless of what the customer asked for).
Additive to guest checkout, not a replacement: `orders.customer_id` is
nullable, and every order-related endpoint accepts EITHER the per-order
access token OR a logged-in session for the account that order belongs
to - never the order id alone. Signing up retroactively links any prior
guest orders placed with the same email, so a returning guest who
creates an account doesn't lose access to what they already bought.
Passwords hashed with bcryptjs (pure JS, no native build step - keeps
the same lean Dockerfile the rest of this project already committed to);
login failures return an identical generic error whether the email
doesn't exist or the password is wrong, so the response itself can't be
used to enumerate registered emails. Verified directly against the
running API (not just automated tests): signup issuing a real session
cookie, order auto-linking, guest-order retroactive linking, session-
based order access being revoked by logout while the token keeps
working, and a customer being unable to view another customer's order
without the token.

**Startup config validation** (`backend/configCheck.js`) - refuses to
boot in production if Razorpay isn't configured (the site would otherwise
run "successfully" while silently never collecting payment for real
shipped inventory), or if `FRONTEND_URL`/`DATABASE_URL` are unset or
still point at localhost. A no-op in dev/test. Runs before the database
connection is even attempted, not after - bad config should fail
instantly, not look like a successful boot right up until the first real
order. Verified directly (not just via mocked tests): ran it standalone
with `NODE_ENV=production` and missing Razorpay keys and confirmed a real
process exit with a clear error, then again with full valid config to
confirm it passes cleanly.

Product catalog (list + detail pages, category filtering), cart, and a
checkout flow that collects **real payment via Razorpay** - order
creation, client-side signature verification, *and* a server-authoritative
webhook (`POST /api/webhooks/razorpay`) so a payment still confirms even
if the customer's browser closes right after paying. Includes automatic
stock rollback if Razorpay itself fails mid-checkout, so a payment-provider
outage can't strand stock on an unpayable order (`releaseOrder` in
`ordersService.js` - this was an actual bug caught and fixed during
testing, not a hypothetical). Every order also gets a `RESERVATION_TTL_MINUTES`
(default 30) reservation window - stock decrements immediately at order
creation, before payment, so without an expiry an abandoned checkout
(widget closed, tab crashed, customer just gave up) would hold that stock
hostage forever. An in-process sweep (`sweepExpiredOrders`, every 5 min -
no separate queue/worker exists at this scale) releases anything left
"pending" past its window; verified end-to-end by backdating an order's
expiry and confirming stock actually comes back. A minimal token-gated `/admin` page lists
orders and updates status (pending → paid → shipped → delivered) - no
per-user login, just a shared secret, since there's one operator. An
order confirmation email sends automatically once payment is confirmed
(`backend/email.js` - pluggable like `razorpay.js`: logs to the console
when SMTP isn't configured, sends real email once it is), and includes a
tracking link back to the order.

Customers view their own order via a random per-order `access_token`, not
the order id - order ids are sequential and trivially guessable, so
`GET /api/orders/:id` requires a matching `?token=` or returns 404
regardless of whether the id exists (`getOrderForCustomer` in
`ordersService.js`). This closes a real gap from earlier in the build:
that endpoint originally had no authorization at all, meaning anyone
could enumerate order ids and read every customer's name, email, phone,
and address.

Every order carries a **GST tax invoice breakdown** - `products.gst_rate`
(5% for glass/porcelain tableware post the Sept 2025 GST reform, 18%
elsewhere - see `seed.sql`) is snapshotted onto each `order_items` row at
order time, not looked up live, so a past order's invoice stays correct
even after tax rates change. `unit_price_inr` is treated as GST-inclusive
MRP (standard Indian retail convention) and the taxable value/GST amount
are derived backward from it (`withTaxBreakdown` in `ordersService.js`),
shown on both the order confirmation page and the confirmation email.
This is a plain-text/HTML breakdown, not a formal numbered tax invoice
(sequential invoice numbering, company letterhead, etc.) - add that before
relying on it for real GST filings.

**API hardening:** rate limiting (`express-rate-limit`, in-memory - fine
for one instance, swap in a shared store like ParentOS's before scaling
horizontally) on order creation (stock decrements before payment, so an
unlimited endpoint could be hammered faster than the reservation sweep
releases abandoned orders) and on the admin API. `helmet` for baseline
security headers on the API; the Content-Security-Policy that actually
matters lives in `deploy/nginx/snowpine.conf` instead, since nginx - not
the Node API - serves the SPA's HTML in production, scoped to allow
exactly what Razorpay's checkout widget needs and nothing else. Server-
side email/phone format validation in `ordersService.js`, since the
client-side checks on the checkout form are trivially bypassed by calling
the API directly.

**Admin product management** (`/admin/products`) - edit price/stock on
existing products and add new ones, without needing SQL access. Writes go
through a field whitelist (`EDITABLE_FIELDS` in `productsService.js`), not
a raw pass-through of the request body, so a client can't sneak in changes
to `id`/`created_at`/etc. No product delete - `order_items` references
products with no cascade, so deleting one with past orders would break;
set stock to 0 to retire an item instead. Also fixed a real gap while
building this: the order confirmation email promises "we'll email you
again once it ships," but nothing ever sent that email - `updateOrderStatus`
now triggers it when an admin marks an order shipped.

**Payment retry and search:** the order confirmation page now offers a
"Complete payment" button for any still-`pending` order, which reopens
Razorpay on the *same* `razorpay_order_id` rather than starting a new
checkout - if a customer's widget gets dismissed (ad blocker, accidental
close, browser hiccup) and they just start over instead, that creates a
second order reserving the same stock a second time, until one of the two
reservations expires. Backed by a small public `GET /api/config` endpoint
exposing Razorpay's `key_id` - not `key_secret` - which Razorpay's own
model treats as safe to embed client-side. The storefront also has a
basic client-side search (name/description/origin) alongside the existing
category filter - no backend endpoint needed at 39 products.

Legal/policy pages (Shipping & Returns, Terms, Privacy) are drafted as
founder-template placeholders - **not legal advice**, and marked
`[FILL IN]` where real business details (registered entity, GSTIN,
grievance officer, etc.) are needed before launch. Product images are a
placeholder color-block component (`components/ProductThumb.jsx`) - real
photography still needed.

**Catalog strategy:** launching with curated segments only, chosen where
Nordic countries are genuinely best-in-class *and* India already shows
real demand - see `database/seed.sql` (39 products):

- **Nordic Baby & Kids** - small, light, giftable items only (carriers,
  feeding/bedding items, wool wear). Deliberately excludes strollers/car
  seats - highest-demand but bulkiest/highest-duty/most breakage-prone to
  ship, and toy-classified items (BRIO, Kid's Concept, Done by Deer) -
  HSN 9503 carries a 70% basic customs duty in India, which makes the
  category economically non-viable regardless of demand.
- **Nordic Home, Design & Gifting** - tableware, textiles, small decor
  objects for India's wedding/corporate gifting market, including
  Moomin-branded Arabia porcelain (real cross-generational brand
  recognition in India from the dubbed Moomin cartoon's Cartoon
  Network/POGO run) and Fiskars tools (lower price-anchor item to lift
  average order value).
- **Nordic Skincare** - Lumene, taps India's beauty/skincare market
  rather than gifting/baby demand specifically.

Excluded for now: food/confectionery (perishability, FSSAI/customs
labeling complexity) and furniture (shipping cost/logistics).

**Pricing methodology:** prices are landed-cost-based, not arbitrary -
`(FOB x 1.15 freight/insurance) x (1 + category BCD + 10% SWS) + flat
logistics`, then a 3x multiplier (mid-point of a 2.5-3.5x heuristic sized
to absorb India's COD/RTO losses, which run 20-35%). FOB costs are still
placeholder estimates, not real supplier quotes - before committing
capital, replace them with actual wholesale quotes and sanity-check
against real India retail comparables (e.g. Fjällräven's own India
pricing) rather than trusting cost-plus math alone. Per-category duty
rates (BCD %, HSN code) are documented inline in `seed.sql`.

**Payments note:** Stripe is not viable for domestic INR settlement by an
India-registered seller (RBI restricts it to export-only/cross-border use).
Razorpay, Cashfree, or PayU are the standard choice for an India-facing
checkout - pick one before wiring up real payments.

## Deployment

`docker-compose.yml` describes a single-host production stack: nginx
(TLS termination + static frontend + API proxy) → the API container →
Postgres. Only nginx publishes ports; Postgres is not reachable from the
host. No queue/worker/backup services yet - add them when the store
actually has background jobs or uploads that need them, not before.

```bash
npm run build:frontend                        # writes frontend/dist
cp .env.production.example .env.production    # fill in real values
export POSTGRES_PASSWORD=...                   # or put it in a top-level .env
docker compose up -d --build
```

Before `docker compose up`, point your domain's DNS at the host and edit
`deploy/nginx/snowpine.conf`'s `server_name _;` to your real domain, and
run certbot's cert-issuance command once manually (the `certbot` service
only handles *renewal* after a cert already exists - see
[certbot's webroot docs](https://certbot.eff.org/instructions) for the
first-issuance command). The nginx config and backend Dockerfile have
been build- and syntax-validated (`docker build`, `nginx -t`) - the
Postgres/nginx/api orchestration together has not been run end-to-end in
this environment, so treat the first `docker compose up` as a real test,
not something already proven to work.

Database migrations and the initial catalog seed run automatically on API
startup (`db.js`'s `initDb()`) - no separate migrate step needed in
production.
