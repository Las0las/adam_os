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
} from "./contracts";
export { Kernel, AuthorityDeniedError } from "./kernel-runtime";
export {
  appendLedger,
  getLedger,
  getLedgerForAuthority,
  ledgerSize,
  subscribeLedger,
} from "./execution-ledger";
export type { AppendInput } from "./execution-ledger";
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
