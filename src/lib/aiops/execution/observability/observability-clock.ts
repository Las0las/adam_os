// Execution Observability (Milestone 5.0) — wall-clock helper.
//
// Observability timestamps deliberately use the real wall clock (Date.now())
// rather than the platform's deterministic monotonic clock (utils/ids `now()`).
// Reading the deterministic clock would ADVANCE it as a side effect, perturbing
// id/timestamp sequences that the rest of the system asserts on. Observation must
// never change deterministic behavior, so it reads a clock it does not own.

/** Epoch milliseconds, guarded so a clock failure can never break execution. */
export function observedNowMs(): number {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

/** ISO-8601 form of `observedNowMs()`, or null if unavailable. */
export function observedNowIso(): string | null {
  const ms = observedNowMs();
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}
