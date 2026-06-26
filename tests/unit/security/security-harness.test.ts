// Phase 10 — the security self-test harness reports all controls passing on a
// healthy build (and creates no finding when green).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { runSecurityHarness } from "@/lib/security/security-test-harness";

test("security harness passes all probes on a healthy build", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const result = await runSecurityHarness(ctx);
  assert.equal(result.passed, true, JSON.stringify(result.probes.filter((p) => !p.passed)));
  assert.equal(result.failedCount, 0);
  assert.equal(result.probeCount, 7);
  const findings = await db.securityFindings.list("tnt_test");
  assert.equal(findings.length, 0);
});
