// L0 kernel — Execution Authority contracts.
//
// The architectural leap: downstream runtimes no longer consume a
// `ConstitutionDecision` (an evaluation artifact). They consume an
// `ExecutionAuthority` — an immutable, signed, expiring token ISSUED by the
// Constitution Runtime. The decision is how authority is reasoned about; the
// authority is the thing that is carried, checked, and spent.
//
//   Intent → Kernel (Constitution Runtime) → ExecutionAuthority → every runtime
//
// Everything here is serializable and deterministic.

import type {
  ConstitutionActionKind,
  ConstitutionActor,
  ConstitutionDecision,
  EvidenceItem,
} from "@/lib/constitution";

// ── Intent ────────────────────────────────────────────────────────────────--

/**
 * A request to act. AI agents, humans, workflows, and services all express
 * intent the same way and submit it to the kernel — none of them executes
 * directly, and none can fabricate authority.
 */
export interface Intent {
  kind: ConstitutionActionKind;
  actor: ConstitutionActor;
  enterpriseId: string;
  object?: { objectType?: string; objectId?: string; isMutation?: boolean };
  projection?: { objectType?: string; projectionId?: string; surface?: string };
  workflow?: { workflowId?: string; fromState?: string; toState?: string };
  audited?: boolean;
  payload?: Record<string, unknown>;
}

// ── Execution Authority ──────────────────────────────────────────────────────

/** A capability the authority grants, expressed as `domain:verb:scope`. */
export type Capability = string;

export type AuthorityOutcome = "granted" | "denied" | "granted_with_restriction";

/**
 * The immutable token issued by the Constitution Runtime. Every other runtime
 * accepts ONLY this. It is signed (tamper-evident), time-bounded, and carries
 * the full evidence trail so any execution is attributable and replayable.
 */
export interface ExecutionAuthority {
  /** Stable id of this authority grant. */
  authorityId: string;
  /** The constitutional decision that produced it (traceability). */
  decisionId: string;
  outcome: AuthorityOutcome;
  /** Convenience: true when this authority permits execution. */
  granted: boolean;

  /** Who the authority was issued to. */
  actor: ConstitutionActor;
  enterpriseId: string;
  tenantId: string | null;

  /** Mission objective this action serves, if any. */
  mission: { objectiveId: string; title: string } | null;
  /** What the bearer may do. */
  capabilities: Capability[];
  /** Honored rights backing the grant. */
  rights: string[];
  /** Constraints/advisories the bearer must respect (non-blocking). */
  restrictions: string[];

  /** ISO timestamps bounding validity. */
  issuedAt: string;
  expiresAt: string;

  /** The evidence trail behind the grant. */
  evidence: EvidenceItem[];
  /** Deterministic signature over the authority payload (tamper-evident). */
  signature: string;
  /** Constitution version under which it was issued. */
  constitutionVersion: string;
}

// ── Kernel Context ──────────────────────────────────────────────────────────

/** Where/when the kernel is executing (host + clock). */
export interface HostContext {
  /** "server" | "client" — the execution surface. */
  surface: "server" | "client";
  /** Logical now (ISO). Injected for determinism. */
  now: string;
  /** Optional request/host correlation id. */
  requestId?: string;
}

/** Telemetry sink carried through the kernel (no-op safe). */
export interface TelemetryContext {
  emit(event: { name: string; at: string; data?: Record<string, unknown> }): void;
}

/**
 * ONE immutable execution context handed to every runtime. Instead of threading
 * four separate context bags, a runtime receives a single KernelContext that
 * already carries its granted ExecutionAuthority.
 */
export interface KernelContext {
  authority: ExecutionAuthority;
  enterpriseId: string;
  host: HostContext;
  telemetry: TelemetryContext;
}

// ── Execution Journal ────────────────────────────────────────────────────--

/**
 * The canonical, append-only event-sourcing record of everything the runtime
 * does. Unlike the audit-oriented ledger, the journal captures the full
 * execution lifecycle so it can serve as the replay source: feed the journal
 * back through the runtimes and you reconstruct the exact same state.
 */
export type JournalEventKind =
  | "IntentReceived"
  | "AuthorityRequested"
  | "AuthorityGranted"
  | "AuthorityDenied"
  | "DecisionComposed"
  | "ConformanceValidated"
  | "SnapshotCreated"
  | "ProjectionResolved"
  | "ProjectionRendered"
  | "WorkflowStarted"
  | "WorkflowTransitioned"
  | "MutationPrepared"
  | "MutationCommitted"
  | "EvidenceAttached"
  | "TelemetryRecorded";

export interface JournalEntry {
  /** Monotonic sequence number — the journal's total order. */
  seq: number;
  /** Stable, content-derived entry id. */
  entryId: string;
  kind: JournalEventKind;
  at: string;
  /** The runtime snapshot under which this event occurred (replay linkage). */
  snapshotId: string | null;
  /** The authority under which it happened (if any). */
  authorityId: string | null;
  /** The constitutional decision behind it (if any). */
  decisionId: string | null;
  actorKind: ConstitutionActor["kind"];
  actorId: string | null;
  enterpriseId: string;
  /** Short human-readable summary. */
  summary: string;
  /** Arbitrary structured detail (frozen, read-only). */
  detail?: Record<string, unknown>;
}

// ── Execution Ledger (audit projection over the journal) ─────────────────────

/** The audit-oriented subset projected from the journal. */
export type LedgerEntryKind =
  | "authority.granted"
  | "authority.denied"
  | "projection.rendered"
  | "mutation.committed"
  | "workflow.transitioned"
  | "ai.recommendation";

export interface LedgerEntry {
  /** Monotonic sequence number within the ledger. */
  seq: number;
  /** Stable entry id. */
  entryId: string;
  kind: LedgerEntryKind;
  at: string;
  /** The authority under which it happened (if any). */
  authorityId: string | null;
  /** The constitutional decision behind it (if any). */
  decisionId: string | null;
  actorKind: ConstitutionActor["kind"];
  actorId: string | null;
  enterpriseId: string;
  /** Short human-readable summary. */
  summary: string;
  /** Arbitrary structured detail (read-only). */
  detail?: Record<string, unknown>;
}

/** Re-export the decision type for consumers that want the full trail. */
export type { ConstitutionDecision };
