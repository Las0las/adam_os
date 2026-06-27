// VS-008 — Enterprise Governance Orchestrator types. Composes the existing
// governance services (VS-003 object validation, VS-004 relationship validation,
// VS-005 graph integrity, VS-007 graph preflight) plus a policy extension point
// into ONE deterministic GovernanceDecision. The orchestrator composes — it does
// not replace — each service, which all remain independently callable.

import type { ActorContext } from "@/types/platform";
import type { OntologyGraph } from "../graph/graph-types";
import type { GraphPreflightResult } from "../graph/graph-preflight";
import type { GovernanceEnforcementMode } from "./governance-enforcement";

/** Who is asking for a governance decision (the canonical entry points). */
export type GovernanceSubjectType =
  | "mission"
  | "workflow"
  | "import"
  | "api"
  | "agent"
  | "automation";

/** Which governance stage produced a finding. */
export type GovernanceStage = "object" | "relationship" | "graph" | "policy";

export type GovernanceSeverity = "error" | "warning";

/** Integrity verdict (mode-independent). */
export type OverallStatus = "pass" | "warning" | "failed";

/** Mode-applied execution decision. */
export type ExecutionDecision = "PASS" | "PASS_WITH_WARNINGS" | "BLOCKED";

/** A normalized finding from any stage. `code` preserves the originating code
 *  (object/relationship validator codes, VS-005 GRAPH_* codes, or policy codes)
 *  so every finding remains traceable to its source service. */
export interface GovernanceFinding {
  stage: GovernanceStage;
  code: string;
  severity: GovernanceSeverity;
  message: string;
  objectId?: string;
  objectType?: string;
  linkType?: string;
  path?: string[];
}

export interface GovernanceDecisionMetrics {
  objects: number;
  relationships: number;
  objectFindings: number;
  relationshipFindings: number;
  graphFindings: number;
  policyFindings: number;
  blocking: number;
  warnings: number;
  /** The stages executed, in order. */
  stages: GovernanceStage[];
}

export interface GovernanceReport {
  subjectType: GovernanceSubjectType;
  subjectId: string;
  executionMode: GovernanceEnforcementMode;
  overallStatus: OverallStatus;
  executionDecision: ExecutionDecision;
  counts: {
    objectFindings: number;
    relationshipFindings: number;
    graphFindings: number;
    policyFindings: number;
    blocking: number;
    warnings: number;
  };
  /** The VS-007 preflight result (advisory; run in warn mode inside the pipeline). */
  preflight: GraphPreflightResult | null;
  graphStatistics: { objects: number; edges: number; disconnectedSubgraphs: number };
}

export interface GovernanceDecision {
  overallStatus: OverallStatus;
  executionDecision: ExecutionDecision;
  executionMode: GovernanceEnforcementMode;
  subjectType: GovernanceSubjectType;
  subjectId: string;
  objectFindings: GovernanceFinding[];
  relationshipFindings: GovernanceFinding[];
  graphFindings: GovernanceFinding[];
  policyFindings: GovernanceFinding[];
  blockingFindings: GovernanceFinding[];
  warningFindings: GovernanceFinding[];
  metrics: GovernanceDecisionMetrics;
  /** Governance event actions emitted during this decision (traceability). */
  events: string[];
  governanceReport: GovernanceReport;
}

// ── Policy extension point (interfaces + registry only; NO business policies) ──

export interface GovernancePolicyContext {
  ctx: ActorContext;
  subjectType: GovernanceSubjectType;
  subjectId: string;
  graph: OntologyGraph;
}

/** A pluggable governance policy. Implementations live OUTSIDE this layer; the
 *  orchestrator only runs whatever is registered. Must be deterministic. */
export interface GovernancePolicy {
  id: string;
  description: string;
  evaluate(input: GovernancePolicyContext): GovernanceFinding[] | Promise<GovernanceFinding[]>;
}

// Re-export for convenience.
export type { GovernanceEnforcementMode } from "./governance-enforcement";
