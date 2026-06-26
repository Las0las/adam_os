// Phase 10 — group service. Groups bundle users + roles for ABAC-style access.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import type { ActorContext } from "@/types/platform";
import type { Group, GroupMembership, GroupRole } from "./access-control-types";

export async function createGroup(
  ctx: ActorContext,
  input: { key: string; name: string; description?: string },
): Promise<Group> {
  requirePermission(ctx, "security.access_manage");
  const existing = await db.groups.find(ctx.tenantId, (g) => g.key === input.key);
  if (existing) return existing;
  return await db.groups.insert({
    id: id("grp"),
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    createdAt: now(),
  });
}

export async function addUserToGroup(ctx: ActorContext, groupId: string, userId: string): Promise<GroupMembership> {
  requirePermission(ctx, "security.access_manage");
  const existing = await db.groupMemberships.find(
    ctx.tenantId,
    (m) => m.groupId === groupId && m.userId === userId,
  );
  if (existing) return existing;
  return await db.groupMemberships.insert({
    id: id("gmem"),
    tenantId: ctx.tenantId,
    groupId,
    userId,
    createdAt: now(),
  });
}

export async function removeUserFromGroup(ctx: ActorContext, groupId: string, userId: string): Promise<boolean> {
  requirePermission(ctx, "security.access_manage");
  const m = await db.groupMemberships.find(ctx.tenantId, (x) => x.groupId === groupId && x.userId === userId);
  if (!m) return false;
  return await db.groupMemberships.delete(ctx.tenantId, m.id);
}

export async function assignRoleToGroup(ctx: ActorContext, groupId: string, roleId: string): Promise<GroupRole> {
  requirePermission(ctx, "security.access_manage");
  const existing = await db.groupRoles.find(ctx.tenantId, (r) => r.groupId === groupId && r.roleId === roleId);
  if (existing) return existing;
  return await db.groupRoles.insert({
    id: id("grole"),
    tenantId: ctx.tenantId,
    groupId,
    roleId,
    createdAt: now(),
  });
}

export async function listGroupsForUser(tenantId: string, userId: string): Promise<Group[]> {
  const memberships = await db.groupMemberships.list(tenantId, (m) => m.userId === userId);
  const groupIds = new Set(memberships.map((m) => m.groupId));
  return await db.groups.list(tenantId, (g) => groupIds.has(g.id));
}

export async function roleIdsForGroups(tenantId: string, groupIds: string[]): Promise<string[]> {
  const groupRoles = await db.groupRoles.list(tenantId, (r) => groupIds.includes(r.groupId));
  return [...new Set(groupRoles.map((r) => r.roleId))];
}
