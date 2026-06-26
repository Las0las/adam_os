// Phase 9 — readiness score reflects platform state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";
import { getProductionReadiness } from "@/lib/mission-control/readiness/readiness-service";

test("a bootstrapped tenant scores high; an empty tenant has blockers", async () => {
  await resetDatabase();
  resetClock();
  await bootstrapTenant({ tenantId: "tnt_ready", bundleKey: "support_os", adminEmail: "a@x.com" });
  const ready = await getProductionReadiness(systemActor("tnt_ready"));
  assert.ok(ready.score >= 85, `expected >=85, got ${ready.score}`);

  const empty = await getProductionReadiness(systemActor("tnt_empty"));
  assert.ok(empty.blockers.length > 0);
  assert.equal(empty.prodReady, false);
});
