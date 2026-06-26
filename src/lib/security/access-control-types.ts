// Phase 10 — access control contracts. Object-level RBAC/ABAC: ACL entries,
// access policies, groups, and the AccessDecision returned by the policy engine.

export type ObjectPermission = "read" | "write" | "approve" | "execute" | "admin";

export type AclEffect = "allow" | "deny";

export type ObjectPolicyRuleType = "allow" | "deny" | "mask" | "redact" | "require_approval";

export interface ObjectAccessPolicy {
  id: string;
  tenantId: string;
  objectType: string;
  policyKey: string;
  ruleType: ObjectPolicyRuleType;
  config: Record<string, unknown>;
  status: "active" | "inactive";
  createdAt: string;
}

export interface ObjectAclEntry {
  id: string;
  tenantId: string;
  objectType: string;
  objectId: string;
  principalType: "user" | "group" | "role";
  principalId: string;
  permission: ObjectPermission;
  effect: AclEffect;
  createdBy?: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface GroupMembership {
  id: string;
  tenantId: string;
  groupId: string;
  userId: string;
  createdAt: string;
}

export interface GroupRole {
  id: string;
  tenantId: string;
  groupId: string;
  roleId: string;
  createdAt: string;
}

export interface AccessDecision {
  allowed: boolean;
  effect: AclEffect;
  reason: string;
  redactions?: Array<{ fieldPath: string; strategy: string }>;
  requiredApproval?: boolean;
}
