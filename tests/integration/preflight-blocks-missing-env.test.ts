// Phase 9 — preflight blocks a deploy missing critical env.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPreflight } from "../../scripts/preflight";

test("preflight blocks when ENCRYPTION_KEY is missing", () => {
  const result = runPreflight({ APP_BASE_URL: "http://x", LAWRENCE_ALLOW_MOCK_MODEL: "1" });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.key === "ENCRYPTION_KEY"));
});
