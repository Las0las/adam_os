// MS-010 — Retry Manager. Deterministic retries only (no backoff/heuristics): a
// task is attempted up to `maxAttempts` times total; the first success wins.

import type { RetryPolicy } from "./mission-types";

export const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 1 };

/** Normalize a retry policy (at least one attempt). */
export function effectiveRetry(policy?: RetryPolicy): RetryPolicy {
  const max = policy?.maxAttempts ?? DEFAULT_RETRY.maxAttempts;
  return { maxAttempts: Math.max(1, Math.floor(max)) };
}

export interface AttemptOutcome<T> {
  ok: boolean;
  attempts: number;
  result?: T;
  error?: Error;
}

/** Run `fn` up to `maxAttempts` times, deterministically (no delay). `onAttemptError`
 *  fires after each failed attempt. Returns the first success or the last error. */
export async function runWithRetry<T>(
  maxAttempts: number,
  fn: (attempt: number) => Promise<T>,
  onAttemptError?: (attempt: number, error: Error) => void | Promise<void>,
): Promise<AttemptOutcome<T>> {
  let attempt = 0;
  let lastError: Error | undefined;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await fn(attempt);
      return { ok: true, attempts: attempt, result };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (onAttemptError) await onAttemptError(attempt, lastError);
    }
  }
  return { ok: false, attempts: attempt, error: lastError };
}
