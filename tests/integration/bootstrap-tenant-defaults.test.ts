// Phase 9 — bootstrap emits audit + creates governance defaults.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";

test("bootstrap emits setup audit and creates defaults", async () => {
  await resetDatabase();
  resetClock();
  await bootstrapTenant({ tenantId: "tnt_b", bundleKey: "claims_validation_os" });
  assert.ok((await db.auditEvents.list("tnt_b", (a) => a.action === "setup.tenant_bootstrapped")).length >= 1);
  assert.equal((await db.environments.list("tnt_b")).length, 3);
});
