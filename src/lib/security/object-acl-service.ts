// Phase 10 — object ACL store. Per-object allow/deny entries for user/group/role
// principals. Deny entries override allow in the policy engine.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import type { ActorContext } from "@/types/platform";
import type { AclEffect, ObjectAclEntry, ObjectPermission } from "./access-control-types";
import type { SecurityContext } from "./security-types";

export interface AclInput {
  objectType: string;
  objectId: string;
  principalType: "user" | "group" | "role";
  principalId: string;
  permission: ObjectPermission;
  effect?: AclEffect;
}

export async function setObjectAcl(ctx: ActorContext, input: AclInput): Promise<ObjectAclEntry> {
  requirePermission(ctx, "security.access_manage");
  return await db.objectAclEntries.insert({
    id: id("acl"),
    tenantId: ctx.tenantId,
    objectType: input.objectType,
    objectId: input.objectId,
    principalType: input.principalType,
    principalId: input.principalId,
    permission: input.permission,
    effect: input.effect ?? "allow",
    createdBy: ctx.actorUserId ?? null,
    createdAt: now(),
  });
}

export async function listAclsForObject(
  tenantId: string,
  objectType: string,
  objectId: string,
): Promise<ObjectAclEntry[]> {
  return await db.objectAclEntries.list(
    tenantId,
    (a) => a.objectType === objectType && a.objectId === objectId,
  );
}

/** ACLs whose principal matches the security context (user/group/role). */
export function aclsMatchingPrincipal(
  acls: ObjectAclEntry[],
  ctx: SecurityContext,
): ObjectAclEntry[] {
  return acls.filter((a) => {
    if (a.principalType === "user") return a.principalId === ctx.userId;
    if (a.principalType === "group") return ctx.groupIds.includes(a.principalId);
    if (a.principalType === "role") return ctx.roleKeys.includes(a.principalId);
    return false;
  });
}
