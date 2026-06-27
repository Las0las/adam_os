// IOS-012 — Fallback Orchestrator — strategy.
//
// Deterministic ordered fallback ONLY. No adaptive routing, cost optimization,
// probabilistic selection, or evaluation-informed routing (future specifications).
//
// Targets are SELECTED FROM the immutable, routing-authorized Execution Plan
// (ADR-0004) — never invented. The candidate sequence is:
//   - the plan's alternates (every plan target except the primary), in plan
//     (routing-preference) order;
//   - optionally restricted/reordered by policy.fallbackProviders (an allow-list
//     over plan members — it can never add a target not already in the plan);
//   - bounded by maxFallbackAttempts.

import type { ExecutionPlan, ExecutionTarget } from "@/lib/aiops/routing/routing-types";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import type { FallbackPolicy } from "./fallback-types";

export function orderedFallbackTargets(
  plan: ExecutionPlan,
  policy: FallbackPolicy,
  ctx: InferenceExecutionContext,
): ExecutionTarget[] {
  // Plan alternates: every authorized target except the primary one in use.
  const alternates = plan.targets.filter((t) => !(t.provider === ctx.provider && t.model === ctx.model));
  let chosen: ExecutionTarget[];
  if (policy.fallbackProviders.length > 0) {
    // Restrict to and order by the policy's provider allow-list — but only among
    // plan members (never adding an un-authorized target).
    chosen = policy.fallbackProviders.flatMap((p) => alternates.filter((t) => t.provider === p));
  } else {
    chosen = [...alternates];
  }
  return chosen.slice(0, Math.max(0, policy.maxFallbackAttempts));
}
