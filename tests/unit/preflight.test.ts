// Phase 9 — preflight fails on missing critical env, passes when present.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPreflight } from "../../scripts/preflight";

test("missing required env fails", () => {
  const result = runPreflight({});
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.key === "APP_BASE_URL"));
});

test("present required env + mock model passes", () => {
  const result = runPreflight({ APP_BASE_URL: "http://x", ENCRYPTION_KEY: "k", LAWRENCE_ALLOW_MOCK_MODEL: "1" });
  assert.equal(result.ok, true);
});

test("production without DATABASE_URL fails (durable store required)", () => {
  const result = runPreflight({
    NODE_ENV: "production",
    APP_BASE_URL: "http://x",
    ENCRYPTION_KEY: "k",
    LAWRENCE_ALLOW_MOCK_MODEL: "1",
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.key === "DATABASE_URL"));
});

test("production with DATABASE_URL passes", () => {
  const result = runPreflight({
    NODE_ENV: "production",
    APP_BASE_URL: "http://x",
    ENCRYPTION_KEY: "k",
    LAWRENCE_ALLOW_MOCK_MODEL: "1",
    DATABASE_URL: "postgres://localhost/lawrence",
  });
  assert.equal(result.ok, true);
});

test("production with explicit memory-store override passes without DATABASE_URL", () => {
  const result = runPreflight({
    NODE_ENV: "production",
    APP_BASE_URL: "http://x",
    ENCRYPTION_KEY: "k",
    LAWRENCE_ALLOW_MOCK_MODEL: "1",
    LAWRENCE_ALLOW_MEMORY_STORE: "1",
  });
  assert.equal(result.ok, true);
});
