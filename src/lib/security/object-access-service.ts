// Phase 10 — object access service + guard. checkObjectAccess composes ACLs +
// policies and evaluates a decision; enforceObjectAccess throws on deny and
// audits denied + sensitive-allowed access.

import { db } from "@/lib/lawrence-core/db";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listAclsForObject, aclsMatchingPrincipal } from "./object-acl-service";
import { evaluateObjectAccess } from "./object-policy-engine";
import { getEffectiveClassification } from "./data-classification-service";
import type { AccessDecision, ObjectPermission } from "./access-control-types";
import type { SecurityContext } from "./security-types";

export class AccessDeniedError extends Error {
  constructor(
    public readonly objectType: string,
    public readonly objectId: string,
    public readonly reason: string,
  ) {
    super(`Access denied to ${objectType}:${objectId} — ${reason}`);
    this.name = "AccessDeniedError";
  }
}

export interface ObjectAccessInput {
  objectType: string;
  objectId: string;
  permission: ObjectPermission;
  /** The object's tenant, when known, for the mandatory tenant-match check. */
  objectTenantId?: string | null;
}

export async function checkObjectAccess(
  ctx: SecurityContext,
  input: ObjectAccessInput,
): Promise<AccessDecision> {
  const allAcls = await listAclsForObject(ctx.tenantId, input.objectType, input.objectId);
  const acls = aclsMatchingPrincipal(allAcls, ctx);
  const policies = await db.objectAccessPolicies.list(
    ctx.tenantId,
    (p) => p.objectType === input.objectType,
  );
  return evaluateObjectAccess({
    securityContext: ctx,
    objectTenantId: input.objectTenantId ?? null,
    objectType: input.objectType,
    objectId: input.objectId,
    permission: input.permission,
    acls,
    policies,
  });
}

export async function enforceObjectAccess(
  ctx: SecurityContext,
  input: ObjectAccessInput,
): Promise<AccessDecision> {
  const decision = await checkObjectAccess(ctx, input);
  const sys = systemActor(ctx.tenantId);
  if (!decision.allowed) {
    await emitAudit(sys, "security.access.denied", { type: input.objectType, id: input.objectId }, {
      userId: ctx.userId,
      permission: input.permission,
      reason: decision.reason,
    });
    throw new AccessDeniedError(input.objectType, input.objectId, decision.reason);
  }
  // Audit sensitive-allowed access to restricted/regulated data.
  const classification = await getEffectiveClassification(ctx.tenantId, input.objectType, input.objectId);
  if (classification && ["restricted", "health", "legal", "financial", "credential", "pii"].includes(classification)) {
    await emitAudit(sys, "security.access.sensitive_allowed", { type: input.objectType, id: input.objectId }, {
      userId: ctx.userId,
      classification,
      permission: input.permission,
    });
  }
  return decision;
}
