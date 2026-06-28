// L0 kernel — public surface. The kernel sits ON the Constitution Runtime and
// issues ExecutionAuthority, the single currency every other runtime consumes.
export type {
  Intent,
  Capability,
  AuthorityOutcome,
  ExecutionAuthority,
  HostContext,
  TelemetryContext,
  KernelContext,
  LedgerEntry,
  LedgerEntryKind,
  JournalEntry,
  JournalEventKind,
} from "./contracts";
export { Kernel, AuthorityDeniedError } from "./kernel-runtime";
export {
  appendJournal,
  getJournal,
  getJournalDescending,
  getJournalForSnapshot,
  journalSize,
  subscribeJournal,
  replayJournal,
} from "./execution-journal";
export type { JournalAppendInput } from "./execution-journal";
export {
  appendLedger,
  getLedger,
  getLedgerForAuthority,
  ledgerSize,
  subscribeLedger,
} from "./execution-ledger";
export type { AppendInput } from "./execution-ledger";
export { stableHash, stableStringHash, canonicalJson } from "./stable-hash";
export {
  currentRuntimeGraph,
  nodeVersion,
} from "./runtime-version-graph";
export type { RuntimeNode, RuntimeVersionGraph } from "./runtime-version-graph";
export { createSnapshot } from "./runtime-snapshot";
export type {
  RuntimeSnapshot,
  CapturedRuntimeState,
  CreateSnapshotInput,
} from "./runtime-snapshot";
export {
  RUNTIME_LAYERS,
  layerRank,
  canDepend,
  assertCanDepend,
  RuntimeHierarchyError,
} from "./runtime-hierarchy";
export type { RuntimeLayer } from "./runtime-hierarchy";
export { liveSampleAuthorities } from "./sample-authorities";
export type { AuthoritySummary } from "./sample-authorities";
