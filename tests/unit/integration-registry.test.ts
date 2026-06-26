// Phase 9 — integration registry resolves known providers, fails closed on unknown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getIntegrationAdapter, hasIntegrationAdapter } from "@/lib/integrations/integration-registry";
import "@/lib/integrations/register-integrations";

test("known providers resolve", () => {
  for (const p of ["microsoft365", "google_workspace", "slack", "sharepoint", "one_drive", "greenhouse", "lever", "gusto", "custom_api", "webhook"] as const) {
    assert.ok(hasIntegrationAdapter(p), `expected adapter for ${p}`);
    assert.equal(getIntegrationAdapter(p).provider, p);
  }
});

test("unknown provider fails closed", () => {
  assert.throws(() => getIntegrationAdapter("nope" as never), /fail-closed/);
});
