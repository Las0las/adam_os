// Phase 9 — tenant bootstrap creates defaults.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";

test("bootstrap creates environments, policies, packs, evals", async () => {
  await resetDatabase();
  resetClock();
  const result = await bootstrapTenant({ tenantId: "tnt_new", bundleKey: "support_os", adminEmail: "admin@x.com" });
  assert.equal(result.environmentsCreated, 3);
  assert.ok(result.approvalPoliciesCreated >= 5);
  assert.ok(result.packsInstalled.includes("support"));
  assert.ok(result.evalSuitesInstalled >= 1);
  // Tenant + admin role exist.
  assert.ok(await db.tenants.get("tnt_new", "tnt_new"));
  assert.ok(await db.roles.find("tnt_new", (r) => r.name === "Administrator"));
});
