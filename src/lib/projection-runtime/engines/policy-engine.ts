// PolicyEngine — applies governance posture to an intent: whether it is blocked
// outright and whether emission must route through human approval. This composes
// the intent's own `requiresApproval` with the runtime PolicyContext, so policy
// can tighten (never loosen) what the definition declares. The authoritative
// approval gate still lives in the action engine; this drives the UI affordance.

import type { IntentDefinition } from "../contracts/enterprise-object";
import type { PolicyContext } from "../contracts/context";

export interface IntentPolicyDecision {
  blocked: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export function evaluateIntentPolicy(
  ctx: PolicyContext,
  intent: IntentDefinition,
): IntentPolicyDecision {
  if (ctx.blockedIntents?.includes(intent.name)) {
    return { blocked: true, requiresApproval: false, reason: "Blocked by current policy posture" };
  }
  const requiresApproval =
    Boolean(intent.requiresApproval) || Boolean(ctx.requireApprovalFor?.includes(intent.name));
  return { blocked: false, requiresApproval };
}
