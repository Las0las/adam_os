// L0 kernel — the Execution Journal.
//
// Review item #1: replace the audit ledger with an append-only execution
// journal. The journal is the runtime/event-sourcing mindset — the CANONICAL
// replay source. Every governed step in the lifecycle (intent received,
// authority requested/granted, snapshot created, projection resolved/rendered,
// mutation prepared/committed, evidence attached) is recorded here in total
// order, and nothing can be mutated or deleted after it is written.
//
// In-memory and process-local (consistent with the demo stores). The seam is
// the same one a durable Postgres-backed journal would sit behind.

import type { JournalEntry, JournalEventKind } from "./contracts";
import { stableStringHash } from "./stable-hash";

const entries: JournalEntry[] = [];
const listeners = new Set<() => void>();
let seq = 0;

export interface JournalAppendInput {
  kind: JournalEventKind;
  at: string;
  snapshotId?: string | null;
  authorityId?: string | null;
  decisionId?: string | null;
  actorKind: JournalEntry["actorKind"];
  actorId: string | null;
  enterpriseId: string;
  summary: string;
  detail?: Record<string, unknown>;
}

/**
 * Append one event. The ONLY mutating operation — there is deliberately no
 * update or delete. Returns the written, frozen entry.
 */
export function appendJournal(input: JournalAppendInput): JournalEntry {
  const nextSeq = ++seq;
  const entry: JournalEntry = Object.freeze({
    seq: nextSeq,
    entryId: `je_${stableStringHash(`${nextSeq}:${input.kind}:${input.at}:${input.snapshotId ?? ""}:${input.decisionId ?? ""}`)}`,
    kind: input.kind,
    at: input.at,
    snapshotId: input.snapshotId ?? null,
    authorityId: input.authorityId ?? null,
    decisionId: input.decisionId ?? null,
    actorKind: input.actorKind,
    actorId: input.actorId,
    enterpriseId: input.enterpriseId,
    summary: input.summary,
    detail: input.detail ? Object.freeze({ ...input.detail }) : undefined,
  });
  entries.push(entry);
  for (const l of listeners) l();
  return entry;
}

/** Read the full journal in causal (append) order — oldest first. */
export function getJournal(limit?: number): JournalEntry[] {
  const all = [...entries];
  return typeof limit === "number" ? all.slice(-limit) : all;
}

/** Read the journal newest-first (for surfaces that show recent activity). */
export function getJournalDescending(limit?: number): JournalEntry[] {
  const all = [...entries].reverse();
  return typeof limit === "number" ? all.slice(0, limit) : all;
}

/** Read entries scoped to one snapshot (everything that one execution produced). */
export function getJournalForSnapshot(snapshotId: string): JournalEntry[] {
  return entries.filter((e) => e.snapshotId === snapshotId);
}

/** Total number of events written. */
export function journalSize(): number {
  return entries.length;
}

/** Subscribe to appends (for useSyncExternalStore-style consumers). */
export function subscribeJournal(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Fold the journal into a derived projection. This is the essence of the
 * event-sourcing model: state is never stored, it is REPLAYED from the journal.
 * `reducer` is applied to each entry in causal order from `seed`. Pure given a
 * pure reducer — the same journal always folds to the same result.
 */
export function replayJournal<S>(
  seed: S,
  reducer: (state: S, entry: JournalEntry) => S,
  upToSeq?: number,
): S {
  let state = seed;
  for (const entry of entries) {
    if (typeof upToSeq === "number" && entry.seq > upToSeq) break;
    state = reducer(state, entry);
  }
  return state;
}
