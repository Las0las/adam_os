// Phase 6 — approval policy contracts (§35 hardened, §47). Policies are
// tenant-scoped, declarative rules that decide whether a subject (release,
// dangerous action, rollback, kill switch) requires human approval before any
// side effect. Fail-closed: a dangerous subject with no governing policy is
// treated as requiring approval, never auto-allowed.

import type { ApprovalSubjectType } from "../runtime/mission-control-hardening-types";

export type ApprovalRuleOperator =
  | "eq"
  | "neq"
  | "in"
  | "gte"
  | "lte"
  | "exists"
  | "always";

export interface ApprovalPolicyRule {
  field: string;
  operator: ApprovalRuleOperator;
  value?: unknown;
}

export interface ApprovalPolicyConfig {
  requireApproval: boolean;
  approverRoleKeys?: string[];
  rules?: ApprovalPolicyRule[];
  reasonRequired?: boolean;
  /** For rollback: allow skipping approval under a declared emergency. */
  allowEmergencyBypass?: boolean;
}

/** Stored approval policy row (mirrors the approval_policies reference table). */
export interface ApprovalPolicy {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  /** Subject types this policy governs; empty/undefined = applies by lookup key. */
  subjectTypes?: ApprovalSubjectType[];
  config: ApprovalPolicyConfig;
  createdAt: string;
}

export interface ApprovalEvaluation {
  approvalRequired: boolean;
  matchedRules: ApprovalPolicyRule[];
  assignedTo?: string | null;
  reasonRequired: boolean;
  reason?: string;
}
