// Execution Plan (ADR-0004) — the routing/execution boundary contract.
//
// Separation of responsibilities:
//   - Routing owns target SELECTION + AUTHORIZATION. The routing engine emits an
//     immutable, ordered ExecutionPlan of authorized ExecutionTargets on the
//     RoutingDecision.
//   - Execution owns INVOCATION. The pipeline invokes ONLY targets contained in
//     the plan; it never authorizes or constructs alternate targets.
//   - Middleware owns execution POLICY. It may select among plan targets but SHALL
//     NOT invent, authorize, or mutate them.
//
// This module derives the plan from a RoutingDecision and tests membership. It
// does NOT select or authorize targets — that already happened in routing.

import { deepFreeze, type ExecutionPlan, type ExecutionTarget, type RoutingDecision } from "./routing-types";

/**
 * The immutable Execution Plan for a decision. When the routing engine attached a
 * plan, it is returned as-is. Otherwise the plan is the single selected target
 * (no alternates) — this is NOT execution constructing alternates, only naming the
 * primary the routing layer already selected. A decision with no selection yields
 * an empty plan.
 */
export function buildExecutionPlan(decision: RoutingDecision): ExecutionPlan {
  if (decision.executionPlan) return decision.executionPlan;
  if (decision.selectedProvider && decision.selectedModel) {
    return deepFreeze({ targets: [{ provider: decision.selectedProvider, model: decision.selectedModel }] });
  }
  return deepFreeze({ targets: [] });
}

/** Whether a target is contained in (authorized by) the plan. */
export function planContains(plan: ExecutionPlan, target: ExecutionTarget): boolean {
  return plan.targets.some((t) => t.provider === target.provider && t.model === target.model);
}

/** The plan's primary (selected) target, or null for an empty plan. */
export function primaryTarget(plan: ExecutionPlan): ExecutionTarget | null {
  return plan.targets[0] ?? null;
}
