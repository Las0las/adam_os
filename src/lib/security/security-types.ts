// Phase 10 — core security types: policies, findings, and the SecurityContext
// resolved per request (richer than ActorContext — adds roles/groups).

import type { Permission } from "@/types/platform";

export type SecurityPolicyType =
  | "tenant"
  | "rbac"
  | "abac"
  | "data_classification"
  | "retention"
  | "export"
  | "ai"
  | "integration"
  | "audit";

export interface SecurityPolicy {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  policyType: SecurityPolicyType;
  status: "active" | "inactive";
  config: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export type SecurityFindingType =
  | "tenant_leak"
  | "missing_permission_check"
  | "secret_exposure"
  | "audit_gap"
  | "policy_gap"
  | "retention_gap"
  | "ai_access_violation";

export interface SecurityFinding {
  id: string;
  tenantId: string;
  severity: SecuritySeverity;
  findingType: SecurityFindingType;
  title: string;
  summary?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  status: "open" | "in_review" | "resolved" | "accepted_risk";
  evidence: Array<Record<string, unknown>>;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface SecurityContext {
  tenantId: string;
  userId: string;
  roleKeys: string[];
  groupIds: string[];
  permissions: Permission[];
  attributes?: Record<string, unknown>;
}
