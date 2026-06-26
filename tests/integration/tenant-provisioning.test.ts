// Just-in-time tenant + user provisioning. Proves the rows backing an
// authenticated Clerk session are created idempotently, that the Clerk org role
// maps to the right app role/permissions (and realigns on change), and that
// provisioning is tenant-scoped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import {
  ensureTenant,
  ensureUser,
  resolveUserPermissions,
} from "@/lib/setup/tenant-provisioning-service";

test("ensureTenant creates the tenant row once (idempotent)", async () => {
  await resetDatabase();
  await ensureTenant("tnt_acme", "Acme");
  await ensureTenant("tnt_acme", "Acme");
  const tenants = await db.tenants.list("tnt_acme");
  assert.equal(tenants.length, 1);
  assert.equal(tenants[0]?.name, "Acme");
});

test("ensureUser provisions an admin with full permissions; user id is the Clerk id", async () => {
  await resetDatabase();
  await ensureTenant("tnt_acme");
  const user = await ensureUser("tnt_acme", {
    userId: "user_clerk_1",
    email: "a@acme.com",
    orgRole: "org:admin",
  });
  assert.equal(user.id, "user_clerk_1", "app user id is the Clerk user id");
  const perms = await resolveUserPermissions("tnt_acme", user);
  assert.ok(perms.includes("mission_control.admin"));
  assert.ok(perms.includes("integrations.manage"));
});

test("ensureUser provisions a non-admin member with least privilege", async () => {
  await resetDatabase();
  await ensureTenant("tnt_acme");
  const user = await ensureUser("tnt_acme", { userId: "user_2", orgRole: "org:member" });
  const perms = await resolveUserPermissions("tnt_acme", user);
  assert.deepEqual(perms, ["review.reviewer"]);
});

test("ensureUser is idempotent and realigns the role when the org role changes", async () => {
  await resetDatabase();
  await ensureTenant("tnt_acme");
  await ensureUser("tnt_acme", { userId: "user_3", orgRole: "org:member" });
  // Same call → no duplicate user.
  await ensureUser("tnt_acme", { userId: "user_3", orgRole: "org:member" });
  assert.equal((await db.users.list("tnt_acme")).length, 1);
  // Promote to admin → role realigns, permissions upgrade.
  const promoted = await ensureUser("tnt_acme", { userId: "user_3", orgRole: "org:admin" });
  const perms = await resolveUserPermissions("tnt_acme", promoted);
  assert.ok(perms.includes("mission_control.admin"), "promotion grants admin permissions");
  assert.equal((await db.users.list("tnt_acme")).length, 1, "still one user after realignment");
});

test("provisioning is tenant-scoped: a user in one tenant is not visible in another", async () => {
  await resetDatabase();
  await ensureTenant("tnt_a");
  await ensureTenant("tnt_b");
  await ensureUser("tnt_a", { userId: "user_x", orgRole: "org:admin" });
  assert.ok(await db.users.get("tnt_a", "user_x"));
  assert.equal(await db.users.get("tnt_b", "user_x"), undefined, "not visible from another tenant");
});
