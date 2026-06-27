// IOS-010 — Retry Policy — Retry Classifier.
//
// Deterministic classification of whether a normalized error is retryable under a
// policy. Retry occurs ONLY for transient failures explicitly listed in the
// policy's retryable error classes (default: timeout, rate_limit,
// provider_unavailable). It NEVER occurs for authentication, validation,
// security, cancellation, or generic/deterministic execution errors — those are
// not transient and are excluded by not being in the retryable classes.
//
// Note: security rejections (firewall/PII) and validation failures occur OUTSIDE
// the provider invocation (in interceptRequest / interceptResponse), so they
// never reach the retry middleware at all; this classifier is the second line of
// defense for whatever the provider call itself throws.

import type { ExecutionErrorKind } from "@/lib/aiops/execution/execution-errors";
import type { RetryPolicy } from "./retry-types";

/** True iff `kind` is retryable under `policy` (membership in retryableErrorClasses). */
export function isRetryableUnder(kind: ExecutionErrorKind, policy: RetryPolicy): boolean {
  return policy.retryableErrorClasses.includes(kind);
}
