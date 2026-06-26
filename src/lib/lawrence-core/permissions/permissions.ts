// Permission guards (§47). Services call requirePermission() before any
// privileged operation; retrieval/write-backs must never bypass these.

import type { ActorContext, Permission } from "@/types/platform";

export class PermissionError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing required permission: ${permission}`);
    this.name = "PermissionError";
  }
}

export function hasPermission(ctx: ActorContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

export function requirePermission(ctx: ActorContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) throw new PermissionError(permission);
}

/** Convenience for building a fully-privileged system actor (seed/tests/jobs). */
export function systemActor(tenantId: string): ActorContext {
  return {
    tenantId,
    actorUserId: null,
    permissions: [
      "dataops.admin",
      "ontology.admin",
      "aiops.function_admin",
      "aiops.agent_admin",
      "review.reviewer",
      "mission_control.admin",
      "deploy.promote",
      "notifications.manage",
      "integrations.manage",
      "security.admin",
      "security.access_manage",
      "security.classification_manage",
      "security.retention_manage",
      "security.compliance_export",
      "security.full_evidence_export",
      "security.audit_verify",
      "security.finding_resolve",
    ],
  };
}
