// Invocation Target Override (ADR-0004) — a GENERAL execution capability.
//
// The AroundInvoke provider-invocation contract (AS-001 R9 / IOS-004) lets a
// middleware re-invoke the provider via `next`. By default `next` invokes the
// routing-selected target. ADR-0004 adds an OPTIONAL invocation target: a
// middleware MAY ask the pipeline to invoke an ALTERNATE (provider, model) —
// but only one ALREADY AUTHORIZED by the routing layer for this execution.
//
// This is NOT routing. Execution middleware does not (and cannot) compute a
// RoutingDecision, mutate it, or re-run routing. It may only name a target the
// routing layer already evaluated and did not reject, and the PIPELINE resolves
// and invokes it (the single sanctioned `.complete()` call site is unchanged).
// When no target is supplied, behavior is byte-for-byte identical to before.
//
// First consumer: IOS-012 Fallback Orchestrator. Future execution-governance
// middleware (IOS-013 Provider Health Manager, adaptive selection,
// evaluation-guided execution) reuse this contract without further architectural
// change.

import type { RoutingDecision } from "@/lib/aiops/routing/routing-types";

/** A provider+model the pipeline may invoke, subject to routing authorization. */
export interface InvocationTarget {
  provider: string;
  model: string;
}

/**
 * Whether `target` was authorized by the routing layer for this execution —
 * i.e. it is contained within the immutable RoutingDecision's execution plan.
 *
 * A target is authorized when EITHER it is the routing-selected target, OR its
 * provider was evaluated by routing AND the (provider, model) pair was not
 * rejected. This reads the decision only; it never re-runs or mutates routing.
 * Executions with no RoutingDecision (already-resolved provider paths) authorize
 * no overrides.
 */
export function isAuthorizedTarget(
  decision: RoutingDecision | null,
  target: InvocationTarget,
): boolean {
  if (!decision) return false;
  if (target.provider === decision.selectedProvider && target.model === decision.selectedModel) {
    return true;
  }
  if (!decision.evaluatedProviders.includes(target.provider)) return false;
  const rejected = decision.rejectionReasons.some(
    (r) => r.provider === target.provider && r.model === target.model,
  );
  return !rejected;
}
