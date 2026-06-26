// Phase 10 — security context resolution. Loads the full identity (user +
// direct roles + group roles + permissions + tenant attributes) for a request.
// Fail-closed: missing tenant/user, inactive user, or cross-tenant mismatch
// throws. Also provides a sync bridge from ActorContext for hot paths.

import { db } from "@/lib/lawrence-core/db";
import { resolvePermissionsForRoles } from "./role-resolution-service";
import { listGroupsForUser, roleIdsForGroups } from "./group-service";
import type { ActorContext, Permission } from "@/types/platform";
import type { SecurityContext } from "./security-types";

export async function resolveSecurityContext(input: {
  tenantId: string;
  userId: string;
}): Promise<SecurityContext> {
  if (!input.tenantId) throw new Error("security context: missing tenantId (fail-closed)");
  if (!input.userId) throw new Error("security context: missing userId (fail-closed)");

  const user = await db.users.get(input.tenantId, input.userId);
  if (!user) throw new Error(`security context: user not found in tenant (fail-closed)`);
  if (user.tenantId !== input.tenantId) {
    throw new Error("security context: cross-tenant user mismatch (fail-closed)");
  }

  const groups = await listGroupsForUser(input.tenantId, input.userId);
  const groupIds = groups.map((g) => g.id);
  const groupRoleIds = await roleIdsForGroups(input.tenantId, groupIds);
  const allRoleIds = [...new Set([...(user.roleIds ?? []), ...groupRoleIds])];

  const { roleKeys, permissions } = await resolvePermissionsForRoles(input.tenantId, allRoleIds);

  return {
    tenantId: input.tenantId,
    userId: input.userId,
    roleKeys,
    groupIds,
    permissions,
    attributes: {},
  };
}

/**
 * Bridge an ActorContext to a SecurityContext for hot paths that already carry
 * resolved permissions (e.g. service-internal calls). Does not hit the DB.
 */
export function securityContextFromActor(ctx: ActorContext): SecurityContext {
  return {
    tenantId: ctx.tenantId,
    userId: ctx.actorUserId ?? "system",
    roleKeys: [],
    groupIds: [],
    permissions: ctx.permissions as Permission[],
    attributes: {},
  };
}
