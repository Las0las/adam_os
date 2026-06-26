// Phase 9 — a default pack bundle installs all its packs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { bootstrapTenant } from "@/lib/setup/tenant-bootstrap-service";

test("staffing bundle installs recruiting + onboarding + executive", async () => {
  await resetDatabase();
  resetClock();
  const r = await bootstrapTenant({ tenantId: "tnt_bundle", bundleKey: "staffing_recruiting_os" });
  for (const k of ["recruiting", "onboarding", "executive"]) assert.ok(r.packsInstalled.includes(k));
  const installs = await db.domainPackInstallations.list("tnt_bundle", (i) => i.status === "installed");
  assert.ok(installs.length >= 3);
});
