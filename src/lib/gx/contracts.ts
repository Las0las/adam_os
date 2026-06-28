// L1 — RFC-C0-X · Governed Execution Lifecycle contracts.
//
// RFC-C0-X is normative for the platform: every governed execution SHALL be
// PLANNED before execution, GOVERNED during execution, OBSERVABLE throughout,
// EVALUATED after execution, and continuously IMPROVABLE without altering
// historical records. The canonical lifecycle is:
//
//   Intent → Plan → Govern → Execute → Observe → Evaluate → Learn → Optimize
//
// This module does NOT reinvent authority or journalling — those are the L0
// kernel's job. It composes the kernel (Kernel.requestAuthority +
// ExecutionAuthority + the append-only Journal) into the explicit lifecycle and
// adds the three artifacts the kernel does not yet name as first-class:
//   • the ExecutionPlan   (C0-X.1 Planned Execution)
//   • the ExecutionEvaluation (C0-X.4 Evaluated Execution)
//   • Learning + an OptimizedStrategy (C0-X.6 Continuous Improvement)
//
// Everything here is serializable and deterministic.

import type { ConstitutionActor } from "@/lib/constitution";

/** The eight normative phases of every governed execution. */
export type ExecutionPhase =
  | "intent"
  | "plan"
  | "govern"
  | "execute"
  | "observe"
  | "evaluate"
  | "learn"
  | "optimize";

/** The lifecycle in canonical order. Normative for the platform. */
export const EXECUTION_LIFECYCLE: readonly ExecutionPhase[] = [
  "intent",
  "plan",
  "govern",
  "execute",
  "observe",
  "evaluate",
  "learn",
  "optimize",
] as const;

// ── C0-X.1 Planned Execution ──────────────────────────────────────────────--

/**
 * Why this execution exists and what it is expected to produce. No governed
 * execution may begin without an objective, authority, strategy, and expected
 * outcome — this is the objective + expected-outcome half of that requirement.
 */
export interface ExecutionObjective {
  id: string;
  /** What this execution is meant to achieve. */
  statement: string;
  /** The outcome the execution is expected to produce (measurable). */
  expectedOutcome: string;
}

/** How a step is carried out relative to the originating request. */
export type StepExecutionMode = "immediate" | "scheduled" | "async";

/** One concrete unit of work in an execution strategy. */
export interface StrategyStep {
  id: string;
  label: string;
  mode: StepExecutionMode;
  /** True when the step performs a write. */
  mutates: boolean;
}

/**
 * An ordered, named strategy for achieving the objective. Optimization
 * (C0-X.6) creates NEW strategies (derivedFrom set) rather than rewriting an
 * existing one, so a strategy is itself immutable history.
 */
export interface ExecutionStrategy {
  id: string;
  label: string;
  steps: StrategyStep[];
  /** The strategy this one was derived from, or null for an original. */
  derivedFrom: string | null;
}

/**
 * The explicit plan that MUST exist before any governed execution begins
 * (C0-X.1). It binds an objective to a strategy and an expected outcome.
 */
export interface ExecutionPlan {
  planId: string;
  objective: ExecutionObjective;
  strategy: ExecutionStrategy;
  /** Restated for convenience at the plan level. */
  expectedOutcome: string;
  createdAt: string;
}

// ── C0-X.3 Observable Execution ───────────────────────────────────────────--

export type StepStatus = "succeeded" | "failed" | "skipped";

/** The recorded result of executing one strategy step. */
export interface StepOutcome {
  stepId: string;
  label: string;
  status: StepStatus;
  mutated: boolean;
  at: string;
}

/**
 * The six mandatory observation dimensions of C0-X.3. Every execution SHALL
 * expose sufficient evidence to determine what occurred, why, who authorized
 * it, which resources participated, when each step occurred, and what decisions
 * were made — and observation may not depend on implementation-specific
 * logging, so it references the canonical kernel Journal by sequence number.
 */
export interface ObservedEvidence {
  /** What occurred. */
  what: string;
  /** Why it occurred (objective + authority rationale). */
  why: string;
  /** Who authorized it. */
  who: { kind: ConstitutionActor["kind"]; id: string | null; label: string | null };
  /** Which resources participated (capabilities, object types). */
  which: string[];
  /** When each step occurred. */
  when: { startedAt: string; completedAt: string; steps: { stepId: string; at: string }[] };
  /** What decisions were made (authority outcome, denials, advisories). */
  decisions: string[];
  /** Canonical Journal sequence numbers this execution produced (not a private log). */
  journalRefs: number[];
}

// ── C0-X.4 Evaluated Execution ────────────────────────────────────────────--

export type EvaluationOutcome = "success" | "partial" | "failure";
export type RiskBand = "low" | "medium" | "high";

/**
 * The objective evaluation that becomes part of the permanent enterprise
 * record (C0-X.4). Carries all seven required dimensions.
 */
export interface ExecutionEvaluation {
  outcome: EvaluationOutcome;
  /** Quality of the produced outcome, 0..1. */
  quality: number;
  /** Confidence in the evaluation, 0..1. */
  confidence: number;
  /** Fraction of the six observation dimensions actually present, 0..1. */
  evidenceCoverage: number;
  /** Whether the execution complied with policy. */
  policyCompliance: "compliant" | "violations";
  /** What the execution consumed. */
  resourceConsumption: { steps: number; mutations: number; durationMs: number };
  /** Residual execution risk. */
  risk: RiskBand;
  rationale: string;
  at: string;
}

// ── C0-X.6 Continuous Improvement ─────────────────────────────────────────--

/** A learning derived from a completed execution that MAY inform future plans. */
export interface LearningSignal {
  id: string;
  observation: string;
  /** Constitutionally true: learning influences the FUTURE, never the past. */
  influencesFuture: true;
}

// ── The permanent, immutable execution record ─────────────────────────────--

export type ExecutionStatus =
  | "completed" // granted, all steps succeeded
  | "completed_with_failures" // granted, some steps failed
  | "denied"; // authority denied — execution never ran (C0-X.2)

/**
 * The permanent record of one governed execution. It is frozen on creation and
 * content-hashed (recordHash) so any tampering is detectable; corrections are
 * represented by NEW records, never by mutating this one (C0-X.5).
 */
export interface GovernedExecution {
  executionId: string;
  intentKind: string;
  actor: { kind: ConstitutionActor["kind"]; id: string | null; label: string | null };
  enterpriseId: string;
  objective: ExecutionObjective;
  plan: ExecutionPlan;
  /** The authority that governed it (null when denied before mint). */
  authorityId: string | null;
  granted: boolean;
  stepOutcomes: StepOutcome[];
  observation: ObservedEvidence;
  evaluation: ExecutionEvaluation;
  learnings: LearningSignal[];
  /** A new strategy proposed for FUTURE executions (never mutates the plan). */
  optimizedStrategy: ExecutionStrategy | null;
  /** The phases that actually completed, in order. */
  phasesCompleted: ExecutionPhase[];
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string;
  /** If this record corrects a prior one, the prior id (C0-X.5 corrections). */
  corrects: string | null;
  /** Content hash over the record payload — tamper-evident immutability. */
  recordHash: string;
}

// ── Law conformance ────────────────────────────────────────────────────────

export type ConstitutionalLaw =
  | "C0-X.1"
  | "C0-X.2"
  | "C0-X.3"
  | "C0-X.4"
  | "C0-X.5"
  | "C0-X.6";

export interface LawConformance {
  law: ConstitutionalLaw;
  title: string;
  satisfied: boolean;
  detail: string;
}
