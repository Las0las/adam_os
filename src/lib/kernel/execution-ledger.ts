// L0 kernel — the Execution Ledger.
//
// A single append-only record of every governed behavior in the enterprise:
// authority granted/denied, projections rendered, mutations committed, workflow
// transitions, AI recommendations. This is the enterprise's operational
// history — nothing here can be mutated or deleted after it is written.
//
// In-memory and process-local (consistent with the demo object-service). The
// seam is the same one a durable Postgres-backed ledger would sit behind.

import type { LedgerEntry, LedgerEntryKind } from "./contracts";

const entries: LedgerEntry[] = [];
const listeners = new Set<() => void>();
let seq = 0;

/** Deterministic, dependency-free hash (FNV-1a 32-bit) for entry ids. */
function stableId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface AppendInput {
  kind: LedgerEntryKind;
  at: string;
  authorityId: string | null;
  decisionId: string | null;
  actorKind: LedgerEntry["actorKind"];
  actorId: string | null;
  enterpriseId: string;
  summary: string;
  detail?: Record<string, unknown>;
}

/**
 * Append one entry. The ONLY mutating operation the ledger exposes — there is
 * deliberately no update or delete. Returns the written, frozen entry.
 */
export function appendLedger(input: AppendInput): LedgerEntry {
  const nextSeq = ++seq;
  const entry: LedgerEntry = Object.freeze({
    seq: nextSeq,
    entryId: `le_${stableId(`${nextSeq}:${input.kind}:${input.at}:${input.decisionId ?? ""}`)}`,
    kind: input.kind,
    at: input.at,
    authorityId: input.authorityId,
    decisionId: input.decisionId,
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

/** Read the full ledger, newest first. Returns a defensive copy. */
export function getLedger(limit?: number): LedgerEntry[] {
  const all = [...entries].reverse();
  return typeof limit === "number" ? all.slice(0, limit) : all;
}

/** Read entries scoped to one authority. */
export function getLedgerForAuthority(authorityId: string): LedgerEntry[] {
  return entries.filter((e) => e.authorityId === authorityId).reverse();
}

/** Total number of entries written. */
export function ledgerSize(): number {
  return entries.length;
}

/** Subscribe to appends (for useSyncExternalStore-style consumers). */
export function subscribeLedger(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
