// Phase 10 — the command center drops queue items referencing objects the caller
// cannot read, so cross-permission data never surfaces in the overview.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { setObjectAcl } from "@/lib/security/object-acl-service";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";
import type { ActorContext } from "@/types/platform";

test("risk items are filtered to those the caller can read", async () => {
  await resetDatabase();
  resetClock();
  const admin = systemActor("tnt_test");
  const visible = await upsertObject(admin, { objectType: "RiskSignal", title: "visible", status: "open", properties: { severity: "high", riskType: "churn" } });
  const hidden = await upsertObject(admin, { objectType: "RiskSignal", title: "hidden", status: "open", properties: { severity: "high", riskType: "fraud" } });

  const reader: ActorContext = { tenantId: "tnt_test", actorUserId: "usr_r", permissions: [] };
  await setObjectAcl(admin, {
    objectType: "RiskSignal", objectId: visible.id, principalType: "user", principalId: "usr_r", permission: "read", effect: "allow",
  });

  const overview = await getCommandCenterOverview(reader);
  const riskIds = overview.riskQueue.map((i) => i.objectRef?.objectId);
  assert.ok(riskIds.includes(visible.id));
  assert.ok(!riskIds.includes(hidden.id));
});
