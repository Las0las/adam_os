// Deterministic-friendly id + clock helpers.
// Centralised so tests can seed/replace them and so we never sprinkle
// Date.now()/Math.random() across the codebase.

let counter = 0;
let clock = 0;

/** Monotonic id with a typed prefix, e.g. id("job") -> "job_000007". */
export function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36).padStart(6, "0")}`;
}

/** Monotonic ISO timestamp. Deterministic for reproducible runs/tests. */
export function now(): string {
  clock += 1000;
  return new Date(clock).toISOString();
}

/** Reset internal counters — used by tests for isolation. */
export function resetClock(): void {
  counter = 0;
  clock = 0;
}
