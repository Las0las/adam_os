// IOS-012 — Fallback Orchestrator — failure classifier.
//
// Deterministic: a primary failure is fallback-eligible only when its normalized
// kind is in the policy's eligible classes (default: timeout, rate_limit,
// provider_unavailable — which also covers circuit-breaker rejections, since
// those normalize to provider_unavailable). Authentication, validation, security,
// and generic execution errors are NOT fallback-eligible — a different provider
// would not fix them. (Security/validation rejections occur outside the provider
// invocation and never reach the orchestrator regardless.)

import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import type { FallbackPolicy } from "./fallback-types";

export function isFallbackEligible(kind: ExecutionErrorKind, policy: FallbackPolicy): boolean {
  return policy.fallbackErrorClasses.includes(kind);
}
