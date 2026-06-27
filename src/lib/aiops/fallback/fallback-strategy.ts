// IOS-012 — Fallback Orchestrator — strategy.
//
// Deterministic ordered fallback ONLY. No adaptive routing, cost optimization,
// probabilistic selection, or evaluation-informed routing (future specifications).
//
// The target sequence is derived deterministically from the immutable policy and
// the execution context:
//   - With fallback providers configured: each provider in order, paired by index
//     with the fallback model at the same position, or the primary model when no
//     paired model is given.
//   - With no fallback providers but fallback models configured: each model in
//     order on the PRIMARY provider (same-provider model fallback).
// The primary target itself is excluded (re-trying the just-failed target is
// pointless), and the sequence is bounded by maxFallbackAttempts.

import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import type { InvocationTarget } from "@/lib/aiops/execution/invocation-target";
import type { FallbackPolicy } from "./fallback-types";

export function orderedFallbackTargets(
  policy: FallbackPolicy,
  ctx: InferenceExecutionContext,
): InvocationTarget[] {
  const out: InvocationTarget[] = [];
  if (policy.fallbackProviders.length > 0) {
    policy.fallbackProviders.forEach((provider, i) => {
      out.push({ provider, model: policy.fallbackModels[i] ?? ctx.model });
    });
  } else {
    policy.fallbackModels.forEach((model) => out.push({ provider: ctx.provider, model }));
  }
  const deduped = out.filter((t) => !(t.provider === ctx.provider && t.model === ctx.model));
  return deduped.slice(0, Math.max(0, policy.maxFallbackAttempts));
}
