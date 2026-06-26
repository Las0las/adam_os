// Phase 10 — object access policy engine. Pure, deterministic evaluation of an
// AccessDecision in a fixed order: tenant match → explicit deny ACL → policy
// deny → explicit allow ACL → role-permission allow → policy allow → default
// deny. Deny always overrides allow.

import type { Permission } from "@/types/platform";
import type {
  AccessDecision,
  ObjectAccessPolicy,
  ObjectAclEntry,
  ObjectPermission,
} from "./access-control-types";
import type { SecurityContext } from "./security-types";

const ROLE_PERMISSION_MAP: Record<ObjectPermission, Permission[]> = {
  read: [
    "dataops.admin",
    "ontology.admin",
    "mission_control.admin",
    "security.admin",
    "review.reviewer",
    "aiops.function_admin",
    "aiops.agent_admin",
  ],
  write: ["dataops.admin", "ontology.admin", "mission_control.admin", "security.admin"],
  approve: ["review.reviewer", "mission_control.admin", "security.admin"],
  execute: ["mission_control.admin", "deploy.promote", "security.admin", "aiops.function_admin"],
  admin: ["security.admin", "mission_control.admin"],
};

export function hasRolePermission(ctx: SecurityContext, permission: ObjectPermission): boolean {
  const grants = ROLE_PERMISSION_MAP[permission];
  return ctx.permissions.some((p) => grants.includes(p));
}

export interface EvaluateInput {
  securityContext: SecurityContext;
  objectTenantId?: string | null;
  objectType: string;
  objectId: string;
  permission: ObjectPermission;
  acls: ObjectAclEntry[];
  policies: ObjectAccessPolicy[];
}

export function evaluateObjectAccess(input: EvaluateInput): AccessDecision {
  const { securityContext: ctx, permission } = input;

  // 1. Tenant match is mandatory.
  if (input.objectTenantId != null && input.objectTenantId !== ctx.tenantId) {
    return { allowed: false, effect: "deny", reason: "tenant mismatch" };
  }

  const relevant = input.acls.filter((a) => a.permission === permission || a.permission === "admin");

  // 2. Explicit deny ACL.
  if (relevant.some((a) => a.effect === "deny")) {
    return { allowed: false, effect: "deny", reason: "explicit deny ACL" };
  }

  // 3. Object access policy deny.
  const activePolicies = input.policies.filter((p) => p.status === "active");
  if (activePolicies.some((p) => p.ruleType === "deny")) {
    return { allowed: false, effect: "deny", reason: "object access policy deny" };
  }

  // Collect redaction/approval signals from policies.
  const redactions = activePolicies
    .filter((p) => p.ruleType === "redact" || p.ruleType === "mask")
    .map((p) => ({ fieldPath: String(p.config.fieldPath ?? "*"), strategy: p.ruleType === "mask" ? "mask" : "token" }));
  const requiredApproval = activePolicies.some((p) => p.ruleType === "require_approval");

  // 4. Explicit allow ACL.
  if (relevant.some((a) => a.effect === "allow")) {
    return { allowed: true, effect: "allow", reason: "explicit allow ACL", redactions, requiredApproval };
  }

  // 5. Role-permission allow.
  if (hasRolePermission(ctx, permission)) {
    return { allowed: true, effect: "allow", reason: "role permission", redactions, requiredApproval };
  }

  // 6. Object access policy allow.
  if (activePolicies.some((p) => p.ruleType === "allow")) {
    return { allowed: true, effect: "allow", reason: "object access policy allow", redactions, requiredApproval };
  }

  // 7. Default deny.
  return { allowed: false, effect: "deny", reason: "default deny" };
}
