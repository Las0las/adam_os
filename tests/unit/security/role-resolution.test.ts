// Phase 10 — role resolution collects + de-duplicates permissions across roles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { resolvePermissionsForRoles } from "@/lib/security/role-resolution-service";

test("permissions are unioned and de-duplicated across roles", async () => {
  await resetDatabase();
  resetClock();
  await db.roles.insert({ id: "r1", tenantId: "t1", name: "A", permissions: ["security.admin", "review.reviewer"] });
  await db.roles.insert({ id: "r2", tenantId: "t1", name: "B", permissions: ["review.reviewer", "security.audit_verify"] });

  const { roleKeys, permissions } = await resolvePermissionsForRoles("t1", ["r1", "r2"]);
  assert.deepEqual(roleKeys.sort(), ["A", "B"]);
  assert.equal(permissions.length, 3);
  assert.ok(permissions.includes("security.admin"));
  assert.ok(permissions.includes("security.audit_verify"));
});

test("unknown role ids resolve to empty permissions", async () => {
  await resetDatabase();
  resetClock();
  const { permissions } = await resolvePermissionsForRoles("t1", ["missing"]);
  assert.equal(permissions.length, 0);
});
