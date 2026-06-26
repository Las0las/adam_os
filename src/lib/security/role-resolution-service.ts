// Phase 10 — role resolution. Collects permissions from a set of role ids
// (direct + group-inherited), de-duplicated.

import { db } from "@/lib/lawrence-core/db";
import type { Permission } from "@/types/platform";

export async function resolvePermissionsForRoles(
  tenantId: string,
  roleIds: string[],
): Promise<{ roleKeys: string[]; permissions: Permission[] }> {
  const roles = await db.roles.list(tenantId, (r) => roleIds.includes(r.id));
  const permissions = new Set<Permission>();
  const roleKeys: string[] = [];
  for (const role of roles) {
    roleKeys.push(role.name);
    for (const p of role.permissions) permissions.add(p);
  }
  return { roleKeys, permissions: [...permissions] };
}
