// Phase 10 — security context resolution: a user inherits permissions from
// group-assigned roles, and resolution fails closed for unknown/cross-tenant
// users.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock, now } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { createGroup, assignRoleToGroup, addUserToGroup } from "@/lib/security/group-service";
import { resolveSecurityContext } from "@/lib/security/security-context-service";

test("a user inherits permissions from a group-assigned role", async () => {
  await resetDatabase();
  resetClock();
  const admin = systemActor("tnt_test");
  await db.users.insert({ id: "usr_x", tenantId: "tnt_test", email: "x@t.dev", displayName: "X", roleIds: [], createdAt: now() });
  await db.roles.insert({ id: "role_sec", tenantId: "tnt_test", name: "Sec", permissions: ["security.audit_verify"] });

  const group = await createGroup(admin, { key: "g1", name: "G1" });
  await assignRoleToGroup(admin, group.id, "role_sec");
  await addUserToGroup(admin, group.id, "usr_x");

  const sc = await resolveSecurityContext({ tenantId: "tnt_test", userId: "usr_x" });
  assert.ok(sc.permissions.includes("security.audit_verify"));
  assert.ok(sc.groupIds.includes(group.id));
});

test("resolution fails closed for an unknown user", async () => {
  await resetDatabase();
  resetClock();
  await assert.rejects(() => resolveSecurityContext({ tenantId: "tnt_test", userId: "ghost" }));
});

test("resolution fails closed for a missing tenant", async () => {
  await resetDatabase();
  resetClock();
  await assert.rejects(() => resolveSecurityContext({ tenantId: "", userId: "u" }));
});
