require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/snowpine_test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.FRONTEND_URL = "http://localhost:5173";
// Real Razorpay/SMTP credentials are never used in tests - specific test
// files set RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET to fake values only when
// they need isConfigured() to return true, and mock the `razorpay` package
// itself so nothing ever makes a real network call.
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_WEBHOOK_SECRET;
delete process.env.SMTP_HOST;
process.env.ADMIN_TOKEN = "test-admin-token";
