// Just-in-time tenant + user provisioning (§7, §47). When an authenticated Clerk
// session is resolved (see app/demo-context.ts), this guarantees the backing
// rows exist: a tenant row for the Clerk organization, an Administrator/Member
// role, and an app user whose id IS the stable Clerk user id (reusing the
// existing `id` field as the external link — no schema change). The Clerk org
// role is authoritative: an admin maps to the Administrator role, everyone else
// to Member. All writes are idempotent and run under the caller's tenant context
// (so they satisfy row-level security). Full tenant setup — packs, environments,
// approval policies — remains the heavier, explicit `bootstrapTenant`.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS } from "./default-tenant-config";
import type { Permission, Role, User } from "@/types/platform";

const ADMIN_ROLE_NAME = "Administrator";
const MEMBER_ROLE_NAME = "Member";

export function isAdminOrgRole(orgRole: string | null | undefined): boolean {
  return orgRole === "org:admin" || orgRole === "admin";
}

/** Insert the tenant row if it does not yet exist. Idempotent. */
export async function ensureTenant(tenantId: string, name?: string): Promise<void> {
  if (await db.tenants.get(tenantId, tenantId)) return;
  await db.tenants.insert({
    id: tenantId,
    tenantId,
    name: name ?? tenantId,
    slug: tenantId,
    createdAt: now(),
  });
}

/** Find-or-create a named role with the given permissions; returns its id. */
async function ensureRole(
  tenantId: string,
  name: string,
  permissions: Permission[],
): Promise<string> {
  const existing = await db.roles.find(tenantId, (r) => r.name === name);
  if (existing) return existing.id;
  const role: Role = { id: id("role"), tenantId, name, permissions };
  await db.roles.insert(role);
  return role.id;
}

/**
 * Find-or-create the app user for a Clerk session and keep its role aligned with
 * the Clerk org role. The user id is the Clerk user id. Returns the user.
 */
export async function ensureUser(
  tenantId: string,
  input: { userId: string; email?: string | null; displayName?: string | null; orgRole?: string | null },
): Promise<User> {
  const admin = isAdminOrgRole(input.orgRole);
  const roleId = admin
    ? await ensureRole(tenantId, ADMIN_ROLE_NAME, DEFAULT_ADMIN_PERMISSIONS)
    : await ensureRole(tenantId, MEMBER_ROLE_NAME, DEFAULT_MEMBER_PERMISSIONS);

  const existing = await db.users.get(tenantId, input.userId);
  if (existing) {
    // Keep the org role authoritative: realign if Clerk membership changed.
    if (!existing.roleIds.includes(roleId)) {
      return db.users.update(existing.id, { roleIds: [roleId] });
    }
    return existing;
  }
  return db.users.insert({
    id: input.userId,
    tenantId,
    email: input.email ?? "",
    displayName: input.displayName || input.email || "User",
    roleIds: [roleId],
    createdAt: now(),
  });
}

/** Union of the permissions granted by a user's assigned roles. */
export async function resolveUserPermissions(tenantId: string, user: User): Promise<Permission[]> {
  if (user.roleIds.length === 0) return [];
  const roles = await db.roles.list(tenantId, (r) => user.roleIds.includes(r.id));
  const perms = new Set<Permission>();
  for (const role of roles) for (const p of role.permissions) perms.add(p);
  return [...perms];
}
