// VS-007 — Mission / Workflow Graph Preflight. The MACHINE-facing gate that
// consumes the VS-005 validateGraph() engine before a mission/workflow executes.
// It does NOT wire graph validation into object/relationship writes, and it does
// not change existing mission/workflow behavior unless explicitly called.
//
//   VS-005 graph engine  — produces the deterministic GraphIntegrityReport.
//   VS-006 review surface — HUMAN-facing presenter of that report.
//   VS-007 preflight gate — MACHINE-facing decision (advisory in warn mode; can
//                            block execution in enforce mode) over that report.
//
// Deterministic; no AI/heuristics. Business rules live in the graph rule registry,
// never here.

import { db } from "@/lib/lawrence-core/db";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import { validateGraph } from "./graph-integrity";
import { resolveGraphEnforcementMode, type GraphEnforcementMode } from "./graph-enforcement";
import type { GraphFinding, GraphRule, GraphGlobalConfig, OntologyGraph } from "./graph-types";

export type PreflightSubjectType = "mission" | "workflow";
export type PreflightStatus = "pass" | "warning" | "blocked";

export interface GraphPreflightResult {
  status: PreflightStatus;
  mode: GraphEnforcementMode;
  subjectType: PreflightSubjectType;
  subjectId: string;
  findings: GraphFinding[];
  blockingFindings: GraphFinding[];
  warningFindings: GraphFinding[];
  affectedObjects: string[];
  affectedRelationships: string[];
  recommendedHumanAction: string | null;
  audit: {
    event: string;
    subjectType: PreflightSubjectType;
    subjectId: string;
    tenantId: string;
    codes: string[];
  };
}

// ── Typed errors (enforce-mode blocking) ──────────────────────────────────────
export class GraphPreflightError extends Error {
  readonly result: GraphPreflightResult;
  readonly codes: string[];
  constructor(result: GraphPreflightResult) {
    super(
      `${result.subjectType} ${result.subjectId} blocked by graph preflight: ${result.blockingFindings.length} blocking finding(s) [${result.audit.codes.join(", ")}]`,
    );
    this.name = "GraphPreflightError";
    this.result = result;
    this.codes = result.audit.codes;
  }
}
export class MissionPreflightError extends GraphPreflightError {
  constructor(result: GraphPreflightResult) {
    super(result);
    this.name = "MissionPreflightError";
  }
}
export class WorkflowPreflightError extends GraphPreflightError {
  constructor(result: GraphPreflightResult) {
    super(result);
    this.name = "WorkflowPreflightError";
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────
export interface PreflightMetrics {
  preflightsRun: number;
  preflightsPassed: number;
  preflightsWarned: number;
  preflightsBlocked: number;
}
const METRICS: PreflightMetrics = { preflightsRun: 0, preflightsPassed: 0, preflightsWarned: 0, preflightsBlocked: 0 };
export function getPreflightMetrics(): PreflightMetrics {
  return { ...METRICS };
}
export function resetPreflightMetrics(): void {
  METRICS.preflightsRun = 0;
  METRICS.preflightsPassed = 0;
  METRICS.preflightsWarned = 0;
  METRICS.preflightsBlocked = 0;
}

// ── Deterministic recommended action (no AI) ──────────────────────────────────
const ACTION_BY_CODE: Record<string, string> = {
  GRAPH_ORPHAN: "connect or remove orphaned objects",
  GRAPH_CYCLE: "break the illegal relationship cycle(s)",
  GRAPH_DUPLICATE_EDGE: "remove duplicate canonical edges",
  GRAPH_INVALID_PATH: "remove illegal shortcut path(s) and route through the canonical chain",
  GRAPH_REQUIRED_RELATIONSHIP: "add the missing required relationship(s)",
  GRAPH_CARDINALITY: "fix relationship cardinality (too few/too many)",
  GRAPH_POLICY: "satisfy the failing policy precondition(s)",
  GRAPH_UNREACHABLE: "connect the disconnected required object(s)",
  GRAPH_CONSTRAINT: "resolve the failing graph constraint(s)",
};
function recommendedAction(findings: GraphFinding[]): string | null {
  if (findings.length === 0) return null;
  const codes = [...new Set(findings.map((f) => f.code))].sort();
  return `Resolve graph integrity issues before execution: ${codes.map((c) => `${c} — ${ACTION_BY_CODE[c] ?? "review finding"}`).join("; ")}.`;
}

export interface PreflightOptions {
  subjectType: PreflightSubjectType;
  subjectId: string;
  /** Scope: validate only objects of these types (and edges between them). */
  objectTypes?: string[];
  /** Validate this snapshot instead of loading the tenant graph. */
  graph?: OntologyGraph;
  rules?: readonly GraphRule[];
  config?: GraphGlobalConfig;
  /** Override the resolved mode (else per tenant/global/env/default warn). */
  mode?: GraphEnforcementMode;
}

async function loadScopedGraph(ctx: ActorContext, objectTypes?: string[]): Promise<OntologyGraph> {
  const [objects, links] = await Promise.all([
    db.ontologyObjects.list(ctx.tenantId),
    db.ontologyLinks.list(ctx.tenantId),
  ]);
  const scope = (objectTypes ?? []).filter((t) => t.trim().length > 0);
  if (scope.length === 0) return { objects, links };
  const allow = new Set(scope);
  const scopedObjects = objects.filter((o) => allow.has(o.objectType));
  const ids = new Set(scopedObjects.map((o) => o.id));
  return { objects: scopedObjects, links: links.filter((l) => ids.has(l.fromObjectId) && ids.has(l.toObjectId)) };
}

function errorFor(result: GraphPreflightResult): GraphPreflightError {
  return result.subjectType === "mission"
    ? new MissionPreflightError(result)
    : new WorkflowPreflightError(result);
}

/**
 * Run the graph preflight for a mission/workflow. Always validates in warn mode
 * internally (so the underlying validation never throws); the preflight then
 * decides advisory (warn) vs blocking (enforce) from the resolved mode.
 *
 *  - warn mode: NEVER blocks; returns status pass|warning, emits a governance
 *    event + metric.
 *  - enforce mode: blocks ONLY on blocking (error-severity) VS-005 findings —
 *    returns a status:"blocked" result via a thrown MissionPreflightError /
 *    WorkflowPreflightError; warning-only graphs return status:"warning".
 *
 * Set `throwOnBlock: false`-style handling by catching the typed error; the error
 * carries the full result.
 */
export async function preflightGraph(
  ctx: ActorContext,
  opts: PreflightOptions,
): Promise<GraphPreflightResult> {
  const mode = opts.mode ?? resolveGraphEnforcementMode(ctx.tenantId);
  const graph = opts.graph ?? (await loadScopedGraph(ctx, opts.objectTypes));

  // Always warn-mode validation so the engine never throws here; the preflight
  // owns the block decision.
  const report = await validateGraph(ctx, { graph, rules: opts.rules, config: opts.config, mode: "warn" });

  const blockingFindings = report.errors;
  const warningFindings = report.warnings;
  const findings = [...blockingFindings, ...warningFindings];

  let status: PreflightStatus;
  if (mode === "enforce") {
    status = blockingFindings.length > 0 ? "blocked" : warningFindings.length > 0 ? "warning" : "pass";
  } else {
    status = findings.length > 0 ? "warning" : "pass";
  }

  const affectedObjects = [...new Set(findings.filter((f) => f.objectId).map((f) => f.objectId!))].sort();
  const affectedRelationships = [
    ...new Set(
      findings
        .filter((f) => f.linkType || (f.path && f.path.length === 2))
        .map((f) => `${f.linkType ?? ""}:${(f.path ?? []).join("->")}`),
    ),
  ].sort();
  const codes = [...new Set(findings.map((f) => f.code))].sort();

  const event =
    status === "blocked"
      ? "ontology.graph.preflight.blocked"
      : status === "warning"
        ? "ontology.graph.preflight.warning"
        : "ontology.graph.preflight.passed";

  const result: GraphPreflightResult = {
    status,
    mode,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    findings,
    blockingFindings,
    warningFindings,
    affectedObjects,
    affectedRelationships,
    recommendedHumanAction: recommendedAction(findings),
    audit: { event, subjectType: opts.subjectType, subjectId: opts.subjectId, tenantId: ctx.tenantId, codes },
  };

  // Metrics.
  METRICS.preflightsRun += 1;
  if (status === "pass") METRICS.preflightsPassed += 1;
  else if (status === "warning") METRICS.preflightsWarned += 1;
  else METRICS.preflightsBlocked += 1;

  // Governance event (best-effort; never changes the outcome).
  try {
    await emitAudit(
      ctx,
      event,
      { type: opts.subjectType, id: opts.subjectId },
      { status, mode, codes, blocking: blockingFindings.length, warnings: warningFindings.length },
    );
  } catch {
    // auditing SHALL NOT change the preflight outcome
  }

  if (status === "blocked") throw errorFor(result);
  return result;
}
