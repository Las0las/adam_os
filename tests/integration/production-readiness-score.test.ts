// Phase 9 — readiness detects blockers below threshold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { getProductionReadiness } from "@/lib/mission-control/readiness/readiness-service";

test("empty tenant is not prod-ready and lists blockers", async () => {
  await resetDatabase();
  resetClock();
  const report = await getProductionReadiness(systemActor("tnt_blank"));
  assert.equal(report.prodReady, false);
  assert.ok(report.blockers.some((b) => b.key === "environments" || b.key === "approval_policies"));
});
