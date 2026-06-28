/**
 * LAWRENCE Platform Engineering Program — executable contract.
 *
 * This is NOT documentation. It is the typed, machine-readable backlog that
 * drives the construction of LAWRENCE into a self-hosting Constitutional
 * Enterprise Operating System. The `engine` consumes these contracts to
 * compute dependency order, the critical path, Definition-of-Done coverage,
 * and production-readiness gates — and grounds milestone status against the
 * LIVE runtime, so the program reports what is actually true, not asserted.
 *
 * Normative language: SHALL / MUST denote hard gates. A milestone is COMPLETE
 * only when its acceptance criteria, constitutional gates, conformance tests,
 * and the universal Definition of Done are all satisfied.
 */

/** Identifier of one of the parallel engineering workstreams. */
export type WorkstreamId =
  | "enterprise-kernel"
  | "constitution-runtime"
  | "enterprise-object-runtime"
  | "projection-runtime"
  | "platform-builder"
  | "universal-workspace"
  | "runtime-explorer"
  | "ai-runtime"
  | "host-runtime"
  | "sdk-extensions"
  | "marketplace"
  | "enterprise-graph";

export interface Workstream {
  id: WorkstreamId;
  label: string;
  /** What this workstream owns. */
  charter: string;
  /** Other workstreams that MUST have shipped contracts before this one starts. */
  dependsOn: WorkstreamId[];
}

/** A runtime contract a milestone introduces (the API/behavior other layers bind to). */
export interface RuntimeContractRef {
  name: string;
  /** Whether the contract exists in the codebase today (grounded), or is planned. */
  state: "live" | "planned";
  note?: string;
}

/** An Enterprise Object a milestone registers into the object runtime. */
export interface EnterpriseObjectRef {
  objectType: string;
  state: "live" | "planned";
}

/** How a milestone's status is established. */
export type MilestoneStatus = "complete" | "in-progress" | "blocked" | "planned";

/**
 * A ground-truth probe. The engine evaluates `check` against live runtime
 * inputs; the milestone cannot be reported COMPLETE unless every probe passes.
 * This is what makes the program executable rather than a checklist.
 */
export interface GroundingProbe {
  id: string;
  description: string;
  /** Pure predicate over the injected live runtime snapshot. */
  check: (live: LiveRuntimeFacts) => boolean;
}

/** Live facts harvested from the real runtime at evaluation time. */
export interface LiveRuntimeFacts {
  registeredObjectTypes: string[];
  registeredProjectionIds: string[];
  runtimeIds: string[];
  conformanceChecks: number;
  conformanceFailures: number;
  replayDeterministic: boolean;
  reconstructable: boolean;
  /** Routes that exist as governance/builder surfaces. */
  surfaces: string[];
  /** Vertical domains that execute state changes THROUGH the kernel chokepoint. */
  governedVerticals: string[];
}

export interface Milestone {
  id: string;
  ordinal: number;
  label: string;
  objective: string;
  architecturalOutcome: string;
  owningWorkstreams: WorkstreamId[];
  /** Milestones that MUST complete first (dependency order, not priority). */
  dependsOn: string[];
  runtimeContracts: RuntimeContractRef[];
  enterpriseObjects: EnterpriseObjectRef[];
  uiSurfaces: string[];
  acceptanceCriteria: string[];
  constitutionalGates: string[];
  conformanceTests: string[];
  deliverables: string[];
  /** Declared status; the engine RECONCILES this against `probes`. */
  declaredStatus: MilestoneStatus;
  probes: GroundingProbe[];
  epics: Epic[];
}

export interface Epic {
  id: string;
  label: string;
  userStories: string[];
  technicalTasks: string[];
  runtimeChanges: string[];
  uiChanges: string[];
  testRequirements: string[];
  risks: string[];
  exitCriteria: string[];
}

/** The universal Definition of Done. Every dimension MUST hold per milestone. */
export type DoDDimension =
  | "runtime-implemented"
  | "contracts-documented"
  | "conformance-passing"
  | "constitutional-validation-passing"
  | "runtime-explorer-visibility"
  | "replay-support"
  | "evidence-generation"
  | "multi-host-compatible"
  | "ai-compatible";

export const DOD_DIMENSIONS: { id: DoDDimension; label: string }[] = [
  { id: "runtime-implemented", label: "Runtime implemented" },
  { id: "contracts-documented", label: "Contracts documented" },
  { id: "conformance-passing", label: "Conformance suite passing" },
  { id: "constitutional-validation-passing", label: "Constitutional validation passing" },
  { id: "runtime-explorer-visibility", label: "Runtime Explorer visibility" },
  { id: "replay-support", label: "Replay support" },
  { id: "evidence-generation", label: "Evidence generation" },
  { id: "multi-host-compatible", label: "Multi-host compatibility" },
  { id: "ai-compatible", label: "AI compatibility" },
];

/** Self-hosting artifact: the moment a builder stops being bespoke code. */
export interface SelfHostingArtifact {
  id: string;
  label: string;
  /** Milestone at which this artifact becomes a LAWRENCE-built (not bespoke) artifact. */
  becomesSelfHostedAt: string;
  state: "bespoke" | "partial" | "self-hosted";
  note: string;
}

export type ReadinessStage = "developer-preview" | "alpha" | "beta" | "release-candidate" | "v1.0";

export interface ProductionStage {
  id: ReadinessStage;
  label: string;
  /** Milestone ids that MUST be COMPLETE to enter this stage. */
  requiresMilestones: string[];
  performance: string;
  governance: string;
  replay: string;
  observability: string;
  security: string;
  conformance: string;
}

/** The whole program. */
export interface PlatformProgram {
  version: string;
  workstreams: Workstream[];
  milestones: Milestone[];
  selfHosting: SelfHostingArtifact[];
  productionStages: ProductionStage[];
}

/* ------------------------------------------------------------------ */
/* Engine output types                                                 */
/* ------------------------------------------------------------------ */

export interface MilestoneEvaluation {
  milestone: Milestone;
  /** Reconciled status: declared status, downgraded if probes fail or deps incomplete. */
  effectiveStatus: MilestoneStatus;
  probesPassed: number;
  probesTotal: number;
  failedProbeIds: string[];
  /** Unmet dependencies (ids not COMPLETE). */
  blockedBy: string[];
  /** DoD dimensions satisfied (derived from probes + status). */
  dodSatisfied: DoDDimension[];
  onCriticalPath: boolean;
}

export interface ProgramReport {
  generatedFor: string;
  topologicalOrder: string[];
  criticalPath: string[];
  cycles: string[][];
  evaluations: MilestoneEvaluation[];
  unmetContractIntroductions: { milestoneId: string; contract: string }[];
  stageReadiness: { stage: ReadinessStage; ready: boolean; blockingMilestones: string[] }[];
  totals: { complete: number; inProgress: number; blocked: number; planned: number };
}
