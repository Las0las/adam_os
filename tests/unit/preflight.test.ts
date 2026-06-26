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
