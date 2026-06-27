// IOS-010 — Retry Policy (per AS-001) — policy + contracts.
//
// Retry attaches through the IOS-004 `aroundInvoke` provider-invocation hook
// (added by ADR-0003), positioned after the security middleware and around the
// provider call. Behavior is governed entirely by immutable RetryPolicy objects.
// Default policy is DISABLED, so installing the middleware changes nothing until a
// tenant opts in.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";

export type RetryMode = "disabled" | "enabled";
export type RetryBackoff = "fixed" | "exponential";

export interface RetryPolicy {
  mode: RetryMode;
  /** Total attempts including the first (>= 1). */
  maxAttempts: number;
  /** Delay before the first retry, in milliseconds. */
  initialDelayMs: number;
  /** Upper bound on any single delay, in milliseconds. */
  maxDelayMs: number;
  backoff: RetryBackoff;
  /** Error kinds eligible for retry (deterministic classification). */
  retryableErrorClasses: ExecutionErrorKind[];
  /** Providers eligible for retry (by registry id). Empty = all. */
  retryableProviders: string[];
  /** Workloads eligible for retry. Empty = all. */
  retryableWorkloads: string[];
  /** When true, skip retry entirely for this execution. */
  bypass: boolean;
}

/** Default policy: retry OFF. The default retryable classes are the transient
 *  kinds only — never authentication, validation, security, cancelled, or generic
 *  execution failures. */
export function defaultRetryPolicy(): RetryPolicy {
  return {
    mode: "disabled",
    maxAttempts: 3,
    initialDelayMs: 50,
    maxDelayMs: 2000,
    backoff: "exponential",
    retryableErrorClasses: ["timeout", "rate_limit", "provider_unavailable"],
    retryableProviders: [],
    retryableWorkloads: [],
    bypass: false,
  };
}

/** Holds the active retry policy as an immutable snapshot. */
export class RetryPolicyStore {
  private policy: RetryPolicy;

  constructor(policy: RetryPolicy = defaultRetryPolicy()) {
    this.policy = deepFreeze(policy);
  }

  current(): RetryPolicy {
    return this.policy;
  }

  configure(policy: RetryPolicy): void {
    this.policy = deepFreeze(policy);
  }
}

/** Whether the policy permits retrying this execution (provider/workload filters).
 *  Does NOT consider mode/bypass — the middleware checks those. */
export function retryEligible(policy: RetryPolicy, ctx: InferenceExecutionContext): boolean {
  if (policy.retryableProviders.length > 0 && !policy.retryableProviders.includes(ctx.provider)) return false;
  if (policy.retryableWorkloads.length > 0 && !policy.retryableWorkloads.includes(ctx.workloadType)) return false;
  return true;
}

/** Chain position: retry runs after the security middleware and wraps the
 *  provider call. Its aroundInvoke composition order is by priority (this is the
 *  only aroundInvoke hook today; future resilience layers compose around it). */
export const RETRY_PRIORITY = 2.5;
