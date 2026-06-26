// Phase 10 — an object-targeted action is blocked (and never mutates the target)
// when the caller is denied object-level write access, even before approval
// routing. A destructive action never runs without object authority.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { setObjectAcl } from "@/lib/security/object-acl-service";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import "@/lib/mission-control/actions/builtins";

test("a deny ACL on the target object blocks the action before approval", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_test");
  const obj = await upsertObject(ctx, { objectType: "Account", externalKey: "acct-1", status: "active" });

  // Deny object-level admin (covers write/execute) for the acting user.
  await setObjectAcl(ctx, {
    objectType: "Account", objectId: obj.id, principalType: "user", principalId: ctx.actorUserId ?? "system",
    permission: "admin", effect: "deny",
  });
  const actingUser = { ...ctx, actorUserId: "usr_denied" };
  await setObjectAcl(ctx, {
    objectType: "Account", objectId: obj.id, principalType: "user", principalId: "usr_denied",
    permission: "admin", effect: "deny",
  });

  const exec = await executeAction(actingUser, {
    actionKey: "update_ontology_object",
    input: { objectType: "Account", externalKey: "acct-1", status: "suspended" },
    object: { type: "Account", id: obj.id },
  });

  assert.equal(exec.status, "blocked");
  assert.ok((exec.blockedReason ?? "").includes("object access denied"));

  // Target unchanged.
  const still = await db.ontologyObjects.get("tnt_test", obj.id);
  assert.equal(still?.status, "active");

  // The block was audited.
  const blocks = await db.auditEvents.list("tnt_test", (e) => e.action === "action.blocked");
  assert.ok(blocks.length >= 1);
});
