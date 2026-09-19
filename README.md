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
bug a mock would hide. 90 tests covering: order creation/validation, GST
tax-breakdown math, the order-access-token authorization fix, Razorpay
payment verification + webhook confirmation, the reservation-expiry
sweep, admin auth/product management, rate limiting, customer accounts
(signup/login/logout, session-based order access, guest-order retroactive
linking, and that one customer can't view another's order), and the
stock-movement audit trail (correct deltas for order/release/admin-edit
paths, and the low-stock list updating as stock crosses the threshold).
Runs with `--runInBand --forceExit` - serial because test files share one
real database; `--forceExit` only after directly ruling out a real leak
(see `tests/teardown.js` for the investigation - it's a Jest-runner
artifact from many isolated per-file module registries, not something
the running server actually does).

**Frontend** - Vitest + React Testing Library, 45 tests covering
`CartContext` (the source of truth for what a customer is about to buy),
`Home`'s search/category filtering, `ProductThumb`'s placeholder-image
logic, `AuthContext`/`MyOrders` (login state, redirect-when-logged-out),
and `OrderConfirmation`'s GST display and payment-retry flow
(verified the retry reopens Razorpay on the *same* `razorpay_order_id`,
not a new one - the exact behavior the double-reservation fix depends on).

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
bare-bones styling. Deliberately kept the placeholder product-thumb logic
in `ProductThumb.jsx` completely unchanged (same inline `style.background`
per category, same tests passing) and added visual polish (a sheen
overlay, a decorative snowflake watermark in the hero) purely through
CSS, specifically so the tests asserting on the exact computed background
color didn't need to know or care about the redesign.

**Inventory management** - `stock_movements` audit log plus a per-product
`reorder_point`. Every real stock change (an order placed, an expired
reservation released back, an admin's manual correction) is logged with
its actual delta and reason, not just silently applied - `/admin/stock-
activity` shows the full history, and low-stock products are highlighted
directly in `/admin/products`. Deliberately did NOT build sales
forecasting alongside this: the store has zero sales history pre-launch,
and fitting a forecasting model to no data is worse than not having one -
simple methods (moving averages, etc.) become worth building once a few
months of real orders exist to learn from.

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
