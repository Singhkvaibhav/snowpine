const { check, assertValidConfig } = require("../configCheck");

// check() reads process.env fresh on every call (no module-load-time
// capture), so these can freely mutate and restore process.env per test
// without needing jest.isolateModules.
function withEnv(overrides, fn) {
  const original = {};
  for (const key of Object.keys(overrides)) original[key] = process.env[key];
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

const SAFE_PROD_ENV = {
  NODE_ENV: "production",
  RAZORPAY_KEY_ID: "rzp_live_real",
  RAZORPAY_KEY_SECRET: "real_secret",
  RAZORPAY_WEBHOOK_SECRET: "real_webhook_secret",
  FRONTEND_URL: "https://snowpine.example",
  DATABASE_URL: "postgres://user:pass@db.internal:5432/snowpine",
  ADMIN_TOKEN: "a-real-long-random-token",
};

describe("configCheck", () => {
  test("is a no-op outside production, regardless of how bad the config is", () => {
    const result = withEnv(
      { NODE_ENV: "development", RAZORPAY_KEY_ID: "", DATABASE_URL: "postgres://localhost/whatever" },
      () => check()
    );
    expect(result).toEqual({ errors: [], warnings: [], ok: true });
  });

  test("passes with no errors or warnings when everything is properly configured in production", () => {
    const result = withEnv(SAFE_PROD_ENV, () => check());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  // This is the failure mode that matters most: a live site that silently
  // never charges anyone while still shipping real inventory.
  test("errors when Razorpay is unconfigured in production", () => {
    const result = withEnv({ ...SAFE_PROD_ENV, RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" }, () => check());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("RAZORPAY_KEY_ID"))).toBe(true);
  });

  test("errors when FRONTEND_URL is missing or still points at localhost", () => {
    expect(withEnv({ ...SAFE_PROD_ENV, FRONTEND_URL: "" }, () => check()).ok).toBe(false);
    expect(withEnv({ ...SAFE_PROD_ENV, FRONTEND_URL: "http://localhost:5173" }, () => check()).ok).toBe(false);
  });

  test("errors when DATABASE_URL is missing or still points at localhost", () => {
    expect(withEnv({ ...SAFE_PROD_ENV, DATABASE_URL: "" }, () => check()).ok).toBe(false);
    expect(
      withEnv({ ...SAFE_PROD_ENV, DATABASE_URL: "postgres://postgres:postgres@localhost:5432/snowpine" }, () => check())
        .ok
    ).toBe(false);
  });

  test("warns (does not error) when RAZORPAY_WEBHOOK_SECRET is unset", () => {
    const result = withEnv({ ...SAFE_PROD_ENV, RAZORPAY_WEBHOOK_SECRET: "" }, () => check());
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("RAZORPAY_WEBHOOK_SECRET"))).toBe(true);
  });

  test("warns (does not error) when ADMIN_TOKEN is unset", () => {
    const result = withEnv({ ...SAFE_PROD_ENV, ADMIN_TOKEN: "" }, () => check());
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("ADMIN_TOKEN"))).toBe(true);
  });
});

describe("assertValidConfig", () => {
  test("exits the process when production config is unsafe", () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      withEnv({ ...SAFE_PROD_ENV, RAZORPAY_KEY_ID: "" }, () => assertValidConfig());
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test("does not exit when config is safe", () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    try {
      withEnv(SAFE_PROD_ENV, () => assertValidConfig());
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });
});
