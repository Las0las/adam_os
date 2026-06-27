// IOS-010 — Retry Policy — Retry Strategy.
//
// Computes the delay before a given retry attempt. Deterministic: fixed delay or
// exponential backoff, bounded by maxDelayMs. Randomized jitter is explicitly out
// of scope (IOS-010), so delays are fully reproducible.

import type { RetryPolicy } from "./retry-types";

/**
 * Delay (ms) before retry number `attempt` (1-based: the delay before the 2nd
 * total attempt is `attempt = 1`). Fixed → initialDelayMs; exponential →
 * initialDelayMs * 2^(attempt-1), capped at maxDelayMs.
 */
export function computeDelayMs(attempt: number, policy: RetryPolicy): number {
  const n = Math.max(1, attempt);
  const raw = policy.backoff === "exponential"
    ? policy.initialDelayMs * Math.pow(2, n - 1)
    : policy.initialDelayMs;
  return Math.min(raw, policy.maxDelayMs);
}
