// L0 kernel — the Execution Ledger, now a PROJECTION over the Execution Journal.
//
// The journal (execution-journal.ts) is the canonical, event-sourced source of
// truth. The ledger is the audit-oriented VIEW of it: the financial/compliance
// subset (authority granted/denied, projections rendered, mutations committed,
// workflow transitions, AI recommendations) mapped to the stable LedgerEntry
// shape that audit surfaces consume.
//
// `appendLedger` is retained as a compatibility shim — it appends to the
// journal. There is no separate ledger store, so the two can never diverge.

import type { JournalEntry, JournalEventKind, LedgerEntry, LedgerEntryKind } from "./contracts";
import { appendJournal, getJournalDescending, subscribeJournal } from "./execution-journal";

/** Compatibility input for callers still speaking the ledger vocabulary. */
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

/** Map a ledger kind onto its canonical journal event kind. */
const LEDGER_TO_JOURNAL: Record<LedgerEntryKind, JournalEventKind> = {
  "authority.granted": "AuthorityGranted",
  "authority.denied": "AuthorityDenied",
  "projection.rendered": "ProjectionRendered",
  "mutation.committed": "MutationCommitted",
  "workflow.transitioned": "WorkflowTransitioned",
  "ai.recommendation": "TelemetryRecorded",
};

/** The journal event kinds that are audit-relevant, and their ledger label. */
const JOURNAL_TO_LEDGER: Partial<Record<JournalEventKind, LedgerEntryKind>> = {
  AuthorityGranted: "authority.granted",
  AuthorityDenied: "authority.denied",
  ProjectionRendered: "projection.rendered",
  MutationCommitted: "mutation.committed",
  WorkflowTransitioned: "workflow.transitioned",
};

/**
 * Compatibility shim: append an audit event by writing to the canonical journal.
 * Returns the projected LedgerEntry view of the written journal entry.
 */
export function appendLedger(input: AppendInput): LedgerEntry {
  const entry = appendJournal({
    kind: LEDGER_TO_JOURNAL[input.kind],
    at: input.at,
    authorityId: input.authorityId,
    decisionId: input.decisionId,
    actorKind: input.actorKind,
    actorId: input.actorId,
    enterpriseId: input.enterpriseId,
    summary: input.summary,
    detail: input.detail,
  });
  return toLedgerEntry(entry, input.kind);
}

function toLedgerEntry(entry: JournalEntry, kind: LedgerEntryKind): LedgerEntry {
  return {
    seq: entry.seq,
    entryId: entry.entryId.replace(/^je_/, "le_"),
    kind,
    at: entry.at,
    authorityId: entry.authorityId,
    decisionId: entry.decisionId,
    actorKind: entry.actorKind,
    actorId: entry.actorId,
    enterpriseId: entry.enterpriseId,
    summary: entry.summary,
    detail: entry.detail,
  };
}

/** Read the audit ledger (projection of the journal), newest first. */
export function getLedger(limit?: number): LedgerEntry[] {
  const projected: LedgerEntry[] = [];
  for (const entry of getJournalDescending()) {
    const kind = JOURNAL_TO_LEDGER[entry.kind];
    if (!kind) continue;
    projected.push(toLedgerEntry(entry, kind));
    if (typeof limit === "number" && projected.length >= limit) break;
  }
  return projected;
}

/** Read ledger entries scoped to one authority. */
export function getLedgerForAuthority(authorityId: string): LedgerEntry[] {
  return getLedger().filter((e) => e.authorityId === authorityId);
}

/** Total number of audit-relevant entries in the ledger projection. */
export function ledgerSize(): number {
  return getLedger().length;
}

/** Subscribe to journal appends (the ledger updates whenever the journal does). */
export function subscribeLedger(fn: () => void): () => void {
  return subscribeJournal(fn);
}
