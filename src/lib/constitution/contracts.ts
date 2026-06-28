// L0 — Enterprise Constitution contracts.
//
// The Constitution is the ROOT RUNTIME of the platform. It is not a module that
// other code consults; it is the runtime from which every other runtime
// (Identity, Governance, Projection, Workflow, Application surfaces) derives its
// execution authority. Nothing executes until the Constitution Runtime resolves
// identity, authority, mission, policies, invariants, rights and
// responsibilities and produces a ConstitutionDecision — an evidenced,
// attributable, replayable authorization token.
//
// Everything here is declarative, serializable, and deterministic. Predicates
// are pure, so the identical document authorizes on the client (UX) and on the
// server (authoritative, fail-closed).

// ── Identity ────────────────────────────────────────────────────────────────

/**
 * Every execution in the platform is attributable to a principal of one of
 * these kinds. The kind is constitutionally significant: it determines what an
 * actor may do and how strictly identity is required.
 */
export type PrincipalKind =
  | "human" // a person acting through a session
  | "system" // the platform itself / a core service
  | "agent" // an autonomous AI agent acting on behalf of the enterprise
  | "workflow" // a running workflow instance executing a step
  | "integration" // an external system acting through a connector
  | "service" // an internal background service / job
  | "automation" // a configured no-code automation
  | "anonymous"; // no principal resolved (never authorized to mutate)

/** Kinds that represent a genuinely resolved (non-anonymous) principal. */
export const RESOLVED_PRINCIPAL_KINDS: readonly PrincipalKind[] = [
  "human",
  "system",
  "agent",
  "workflow",
  "integration",
  "service",
  "automation",
];

/** The canonical self-description of the enterprise the constitution governs. */
export interface EnterpriseIdentity {
  /** Stable identifier (maps to the platform tenantId). */
  id: string;
  /** Legal / display name. */
  name: string;
  /** One-line description of what the enterprise is. */
  descriptor: string;
  /** Operating jurisdictions (informational; drives no hidden behavior). */
  jurisdictions: string[];
  /** The constitution version this identity ratified. */
  ratifiedVersion: string;
}

// ── Mission ───────────────────────────────────────────────────────────────--

/**
 * Why the enterprise exists. The mission is not decoration: objectives and
 * their priority let the runtime ask "does this action advance the mission?"
 */
export interface Mission {
  statement: string;
  /** The outcomes the mission is measured by. */
  measures: string[];
  /** Active objectives, highest priority first (priority: lower = higher). */
  objectives: MissionObjective[];
}

export interface MissionObjective {
  id: string;
  title: string;
  statement: string;
  /** 1 = highest priority. Drives prioritization of competing actions. */
  priority: number;
  /** The measurable signal that tells us the objective is being met. */
  successMetric: string;
}

// ── Principles, Rights, Responsibilities ─────────────────────────────────────

/** A belief that shapes interpretation of every rule below it. */
export interface Principle {
  id: string;
  title: string;
  statement: string;
}

/** Something a class of actors is entitled to expect from the enterprise. */
export interface Right {
  id: string;
  /** Who holds the right (e.g. "every-actor", "candidate", "operator"). */
  holder: string;
  statement: string;
  /** Pure predicate: returns true when the right is honored for this context. */
  honored(ctx: ConstitutionContext): boolean;
  /** Reason shown when the right is not honored. */
  rationale: string;
}

/** Something a class of actors owes to the enterprise or to others. */
export interface Responsibility {
  id: string;
  /** Who bears the responsibility. */
  bearer: string;
  statement: string;
  /** Pure predicate: returns true when the responsibility is met. */
  met(ctx: ConstitutionContext): boolean;
  /** Reason shown when the responsibility is not met. */
  rationale: string;
}

// ── Invariants ────────────────────────────────────────────────────────────--

export type ConstitutionSeverity = "blocking" | "advisory";

/**
 * A rule that must hold for any governed action. `holds` is a PURE predicate:
 * given the action context it returns true when the invariant is satisfied. A
 * blocking invariant that does not hold denies the action (fail-closed).
 */
export interface Invariant {
  id: string;
  title: string;
  statement: string;
  severity: ConstitutionSeverity;
  /** The principle(s) this invariant operationalizes (traceability). */
  derivedFrom: string[];
  /** Pure, deterministic, side-effect-free. Returns true when satisfied. */
  holds(ctx: ConstitutionContext): boolean;
  /** Human-readable reason shown when the invariant is violated. */
  rationale: string;
}

// ── Executable Policies ──────────────────────────────────────────────────────

export type PolicyEffect = "allow" | "deny" | "require_review" | "advise";

/** The outcome of evaluating one executable policy. */
export interface PolicyEvaluation {
  policyId: string;
  effect: PolicyEffect;
  /** True when this policy does not block execution. */
  satisfied: boolean;
  /** Plain-language explanation of WHY this effect was produced. */
  explanation: string;
  /** Evidence items the policy relied on to reach its effect. */
  evidence: EvidenceItem[];
  /** Optional next-best-action recommendation when not satisfied. */
  recommendation?: string;
}

/**
 * A policy is an EXECUTABLE object, not text. It can evaluate itself against a
 * context and explain, evidence, recommend, and audit its own decision — so the
 * platform can answer "why was this blocked?" without anyone reading code.
 */
export interface Policy {
  id: string;
  title: string;
  statement: string;
  enforces: string[]; // invariant ids this policy operationalizes
  /** Pure self-evaluation against the action context. */
  evaluate(ctx: ConstitutionContext): PolicyEvaluation;
}

// ── The Constitution document ─────────────────────────────────────────────--

/** A ratified amendment to the constitution (self-versioning history). */
export interface ConstitutionAmendment {
  version: string;
  /** ISO date the amendment becomes effective. */
  effectiveDate: string;
  /** The version this one supersedes (null for the genesis ratification). */
  supersedes: string | null;
  summary: string;
}

/** The full constitutional document. Deep-frozen at module load. */
export interface Constitution {
  version: string;
  /** ISO date this version became effective. */
  effectiveDate: string;
  /** Ratification lineage, newest first. */
  amendments: ConstitutionAmendment[];
  identity: EnterpriseIdentity;
  mission: Mission;
  principles: Principle[];
  rights: Right[];
  responsibilities: Responsibility[];
  invariants: Invariant[];
  policies: Policy[];
}

// ── Evaluation surface ──────────────────────────────────────────────────────

/** The kind of governed action being evaluated against the constitution. */
export type ConstitutionActionKind =
  | "object.create"
  | "object.update"
  | "object.delete"
  | "intent.emit"
  | "workflow.transition"
  | "projection.resolve"
  | "read";

/** The resolved principal performing an action. */
export interface ConstitutionActor {
  /** The constitutionally-significant kind of principal. */
  kind: PrincipalKind;
  /** Stable id of the principal (a user id, agent id, service name, …). */
  id: string | null;
  /** Human-readable label for evidence/audit. */
  label?: string;
  tenantId: string | null;
  permissions: string[];
}

/**
 * The minimal, surface-independent context every dimension evaluates against.
 * Built once at the runtime entry point and passed unchanged to every evaluator
 * so authorization is deterministic and order-independent.
 */
export interface ConstitutionContext {
  kind: ConstitutionActionKind;
  actor: ConstitutionActor;
  /** The enterprise the action is scoped to. */
  enterpriseId: string;
  /** Optional object dimensions when the action touches an object. */
  object?: {
    objectType?: string;
    objectId?: string;
    /** True when the write would mutate an existing record. */
    isMutation?: boolean;
  };
  /** Optional projection dimension when the action resolves a projection. */
  projection?: {
    objectType?: string;
    projectionId?: string;
    surface?: string;
  };
  /** Optional workflow dimension when the action is a workflow step. */
  workflow?: {
    workflowId?: string;
    fromState?: string;
    toState?: string;
  };
  /** Whether the action is carried out under an audited path. */
  audited: boolean;
  /** Arbitrary payload for dimension-specific checks (read-only). */
  payload?: Record<string, unknown>;
}

// ── Evidence + Decision ──────────────────────────────────────────────────────

export type EvidenceKind =
  | "identity"
  | "authority"
  | "mission"
  | "right"
  | "responsibility"
  | "policy"
  | "invariant";

/** One piece of evidence carried by a constitutional decision. */
export interface EvidenceItem {
  kind: EvidenceKind;
  /** The constitutional element this evidence refers to (e.g. an invariant id). */
  ref: string;
  /** What was observed. */
  observation: string;
  /** Whether the observation supports authorization. */
  supports: boolean;
}

/** A violation of a blocking element (invariant, right, responsibility, policy). */
export interface ConstitutionViolation {
  dimension: EvidenceKind;
  ref: string;
  title: string;
  severity: ConstitutionSeverity;
  rationale: string;
  recommendation?: string;
}

export type DecisionOutcome = "authorized" | "denied" | "authorized_with_advice";

/**
 * The output of the Constitution Runtime. This IS the execution-authority token:
 * downstream runtimes execute only when they hold an `authorized` decision, and
 * the decision carries the full evidence trail so any action is explainable,
 * attributable, versioned, and replayable.
 */
export interface ConstitutionDecision {
  /** Stable, content-independent decision id (deterministic per evaluation). */
  decisionId: string;
  /** ISO timestamp the decision was produced. */
  timestamp: string;
  /** Constitution version under which the decision was made. */
  constitutionVersion: string;
  outcome: DecisionOutcome;
  /** Convenience: true when outcome authorizes execution. */
  authorized: boolean;
  /** The action that was evaluated. */
  context: ConstitutionContext;
  /** Mission objective this action best serves, if any. */
  missionAlignment: { objectiveId: string; title: string } | null;
  /** Per-policy evaluations. */
  policyEvaluations: PolicyEvaluation[];
  /** Blocking failures that caused (or would cause) denial. */
  violations: ConstitutionViolation[];
  /** Non-blocking advisories surfaced but not denied. */
  advisories: ConstitutionViolation[];
  /** The full evidence trail behind the decision. */
  evidence: EvidenceItem[];
  /** Counts of evaluated elements per dimension (for transparency). */
  evaluated: Record<EvidenceKind, number>;
}
