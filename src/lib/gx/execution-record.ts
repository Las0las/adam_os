// L1 — RFC-C0-X · the append-only Governed Execution record store.
//
// C0-X.5 Immutable History: execution history SHALL be immutable. There is
// deliberately NO update and NO delete — the only mutating operation is append.
// Corrections are represented by NEW records (see GovernedExecution.corrects),
// never by rewriting a prior one. State that surfaces show is REPLAYED from this
// log, never stored independently.
//
// In-memory and process-local (consistent with the kernel's demo stores); the
// seam is the same one a durable Postgres-backed store would sit behind.

import type { GovernedExecution } from "./contracts";

const records: GovernedExecution[] = [];
const listeners = new Set<() => void>();

/**
 * Append one immutable execution record. The ONLY mutating operation. The
 * record is frozen by the runtime before it arrives here; we keep it append-only
 * and notify subscribers. Idempotent on executionId (re-appending the same
 * execution is a no-op, so exercising the runtime twice can't double-count).
 */
export function appendExecution(record: GovernedExecution): GovernedExecution {
  const existing = records.find((r) => r.executionId === record.executionId);
  if (existing) return existing;
  records.push(record);
  for (const l of listeners) l();
  return record;
}

/** Read the full execution history in append order — oldest first. */
export function getExecutions(limit?: number): GovernedExecution[] {
  const all = [...records];
  return typeof limit === "number" ? all.slice(-limit) : all;
}

/** Read newest-first (for surfaces that show recent activity). */
export function getExecutionsDescending(limit?: number): GovernedExecution[] {
  const all = [...records].reverse();
  return typeof limit === "number" ? all.slice(0, limit) : all;
}

/** Total number of governed executions recorded. */
export function executionCount(): number {
  return records.length;
}

/** Subscribe to appends (for useSyncExternalStore-style consumers). */
export function subscribeExecutions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Fold the immutable history into a derived projection. State is never stored;
 * it is REPLAYED from the record log. Pure given a pure reducer — the same
 * history always folds to the same result, which is the C0-X.5 replay guarantee.
 */
export function replayExecutions<S>(
  seed: S,
  reducer: (state: S, record: GovernedExecution) => S,
): S {
  let state = seed;
  for (const record of records) state = reducer(state, record);
  return state;
}
