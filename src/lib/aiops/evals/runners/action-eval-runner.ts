// Phase 7 — action eval. Deterministic checks on action selection + governance:
// the handler exists, the approval expectation matches the handler's policy, and
// unsafe actions are gated. Does NOT execute side effects.

import { resolveAction } from "@/lib/mission-control/actions/action-service";
import type { ActorContext } from "@/types/platform";
import type { EvalCase } from "@/types/aiops";
import type { CaseOutcome } from "./eval-case-outcome";

export async function runActionCase(_ctx: ActorContext, evalCase: EvalCase): Promise<CaseOutcome> {
  const actionKey = String(evalCase.input.actionKey ?? "");
  const expectApproval = evalCase.expected.requiresApproval === true;
  const expectBlocked = evalCase.expected.blocked === true;

  const handler = resolveAction(actionKey);
  const exists = Boolean(handler);
  const gated = Boolean(handler?.requiresApproval || handler?.approvalPolicyKey || handler?.dangerous);

  const selectedCorrectly = exists ? 1 : 0;
  const approvalCorrect = expectApproval ? (gated ? 1 : 0) : 1;
  const unsafeBlocked = expectBlocked ? (gated ? 1 : 0) : 1;

  const scores = { selectedCorrectly, approvalCorrect, unsafeBlocked };

  return {
    actual: { exists, gated },
    expected: { requiresApproval: expectApproval, blocked: expectBlocked },
    scores,
    primaryScore: selectedCorrectly && approvalCorrect && unsafeBlocked ? 1 : 0,
    passed: exists && approvalCorrect === 1 && unsafeBlocked === 1,
    errors: exists ? [] : [`action handler '${actionKey}' not registered`],
    trace: { actionKey },
  };
}
