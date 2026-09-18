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

## Project structure

```
backend/
  server.js       Express app entrypoint
  db.js           Postgres pool + startup migrate/seed
  migrate.js      runs database/migrations/*.sql in order, once each
  routes/         thin route handlers per resource
  services/       business logic + queries
  database/
    migrations/   one numbered file per schema change
    seed.sql      sample product data (dev only)

frontend/
  src/
    pages/        page-level components
    api/          backend API client
```

## Status

Early scaffold: product catalog (list/detail) end-to-end against a real
Postgres database, with a minimal storefront listing page. Not yet built:
cart, checkout, payments, order management, auth.

**Payments note:** Stripe is not viable for domestic INR settlement by an
India-registered seller (RBI restricts it to export-only/cross-border use).
Razorpay, Cashfree, or PayU are the standard choice for an India-facing
checkout - pick one before building the checkout flow.
