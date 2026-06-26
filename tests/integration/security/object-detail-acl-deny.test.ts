// Phase 10 — an explicit deny ACL blocks object-detail read even when the actor
// holds a read-granting role permission. Deny overrides everything. Proves the
// object-level guard is wired into the object-detail assembly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock, now } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { setObjectAcl } from "@/lib/security/object-acl-service";
import { getObjectDetail } from "@/lib/domains/object-detail/object-detail-service";
import { AccessDeniedError } from "@/lib/security/access-guard";
import type { ActorContext } from "@/types/platform";

test("deny ACL blocks object-detail read despite a read-granting role", async () => {
  await resetDatabase();
  resetClock();
  const admin = systemActor("tnt_test");
  const obj = await upsertObject(admin, { objectType: "Doc", title: "secret doc", properties: {} });

  // The reader holds dataops.admin (a read-granting role) but is explicitly denied.
  const reader: ActorContext = { tenantId: "tnt_test", actorUserId: "usr_reader", permissions: ["dataops.admin"] };
  await setObjectAcl(admin, {
    objectType: "Doc",
    objectId: obj.id,
    principalType: "user",
    principalId: "usr_reader",
    permission: "read",
    effect: "deny",
  });

  await assert.rejects(() => getObjectDetail(reader, "Doc", obj.id), AccessDeniedError);

  // The denial emitted a security.access.denied audit.
  const denials = await db.auditEvents.list("tnt_test", (e) => e.action === "security.access.denied");
  assert.ok(denials.length >= 1);
});

test("allow ACL lets a permission-less reader through", async () => {
  await resetDatabase();
  resetClock();
  const admin = systemActor("tnt_test");
  const obj = await upsertObject(admin, { objectType: "Doc", title: "shared", properties: {} });
  const reader: ActorContext = { tenantId: "tnt_test", actorUserId: "usr_b", permissions: [] };
  await setObjectAcl(admin, {
    objectType: "Doc", objectId: obj.id, principalType: "user", principalId: "usr_b", permission: "read", effect: "allow",
  });
  const detail = await getObjectDetail(reader, "Doc", obj.id);
  assert.equal(detail.object.objectId, obj.id);
});
