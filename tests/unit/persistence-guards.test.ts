// Production-hardening: persistence guards. These prove that the destructive
// demo seed can never run against a configured Postgres on the request path
// (the data-loss-on-cold-start defect) and that a production process refuses to
// run on the ephemeral in-memory store unless explicitly overridden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPersistenceReady, shouldAutoSeedDemo } from "@/lib/lawrence-core/bootstrap";

test("shouldAutoSeedDemo: in-memory backend (no DATABASE_URL) auto-seeds the demo", () => {
  assert.equal(shouldAutoSeedDemo({}), true);
});

test("shouldAutoSeedDemo: configured Postgres NEVER auto-seeds (no destructive reset on cold start)", () => {
  assert.equal(shouldAutoSeedDemo({ DATABASE_URL: "postgres://localhost/lawrence" }), false);
});

test("shouldAutoSeedDemo: explicit disable flag suppresses the demo seed even on memory", () => {
  assert.equal(shouldAutoSeedDemo({ LAWRENCE_DISABLE_DEMO_SEED: "1" }), false);
});

test("assertPersistenceReady: production without a durable store fails closed", () => {
  assert.throws(() => assertPersistenceReady({ NODE_ENV: "production" }), /Production persistence not configured/);
});

test("assertPersistenceReady: production with DATABASE_URL passes", () => {
  assert.doesNotThrow(() =>
    assertPersistenceReady({ NODE_ENV: "production", DATABASE_URL: "postgres://localhost/lawrence" }),
  );
});

test("assertPersistenceReady: production with explicit memory-store override passes", () => {
  assert.doesNotThrow(() =>
    assertPersistenceReady({ NODE_ENV: "production", LAWRENCE_ALLOW_MEMORY_STORE: "1" }),
  );
});

test("assertPersistenceReady: non-production (dev/test) never blocks on the memory store", () => {
  assert.doesNotThrow(() => assertPersistenceReady({}));
});
