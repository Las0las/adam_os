// Phase 6 — approval policy engine (§35 hardened). Pure, deterministic
// evaluation of whether a governance subject requires human approval. Fail
// closed: a governance subject with no governing policy is treated as requiring
// approval. Kill-switch enablement and rollbacks default to reason-required.

import type {
  ApprovalEvaluation,
  ApprovalPolicy,
  ApprovalPolicyRule,
} from "./approval-policy-types";
import type { ApprovalSubjectType } from "../runtime/mission-control-hardening-types";

/** Resolve a dot-path field out of a payload (e.g. "target.environmentType"). */
function readField(payload: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, payload);
}

function ruleMatches(rule: ApprovalPolicyRule, payload: Record<string, unknown>): boolean {
  if (rule.operator === "always") return true;
  const actual = readField(payload, rule.field);
  switch (rule.operator) {
    case "eq":
      return actual === rule.value;
    case "neq":
      return actual !== rule.value;
    case "in":
      return Array.isArray(rule.value) && rule.value.includes(actual);
    case "gte":
      return typeof actual === "number" && typeof rule.value === "number" && actual >= rule.value;
    case "lte":
      return typeof actual === "number" && typeof rule.value === "number" && actual <= rule.value;
    case "exists":
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
}

/**
 * Evaluate an approval policy for a subject. When no policy is supplied the
 * engine fails closed (approval required), because every ApprovalSubjectType is
 * a governance-sensitive operation.
 */
export function evaluateApprovalPolicy(input: {
  tenantId: string;
  policy: ApprovalPolicy | null | undefined;
  subjectType: ApprovalSubjectType;
  subjectPayload: Record<string, unknown>;
  actorUserId?: string | null;
}): ApprovalEvaluation {
  const { policy, subjectType, subjectPayload } = input;

  // Reason is always required to enable a kill switch or to roll back.
  const defaultReasonRequired = subjectType === "kill_switch" || subjectType === "rollback";

  if (!policy) {
    // Fail closed: no governing policy => require approval.
    return {
      approvalRequired: true,
      matchedRules: [],
      assignedTo: null,
      reasonRequired: defaultReasonRequired || true,
      reason: "no governing approval policy — failing closed (approval required)",
    };
  }

  // Emergency bypass (rollback only, when the policy explicitly allows it).
  if (
    subjectType === "rollback" &&
    policy.config.allowEmergencyBypass === true &&
    subjectPayload.emergency === true
  ) {
    return {
      approvalRequired: false,
      matchedRules: [],
      assignedTo: null,
      reasonRequired: true,
      reason: "emergency rollback bypass per policy",
    };
  }

  const rules = policy.config.rules ?? [];
  const matchedRules = rules.filter((r) => ruleMatches(r, subjectPayload));
  const approvalRequired = policy.config.requireApproval || matchedRules.length > 0;

  return {
    approvalRequired,
    matchedRules,
    assignedTo: null,
    reasonRequired: policy.config.reasonRequired ?? defaultReasonRequired,
  };
}
