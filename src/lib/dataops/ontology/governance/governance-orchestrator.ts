// VS-008 — Enterprise Governance Orchestrator. The canonical, on-demand governance
// entry point for missions, workflows, imports, API execution, agents, and future
// automation. It composes the existing services in order — VS-003 object
// validation, VS-004 relationship validation, VS-005 graph integrity, VS-007 graph
// preflight, plus a policy extension point — into one deterministic
// GovernanceDecision. It does NOT replace those services (each remains
// independently callable) and is NOT wired into any write path.
//
// All sub-services are invoked in warn mode internally so nothing throws
// mid-pipeline; the orchestrator makes a SINGLE execution decision from the
// resolved governance mode. No AI, no heuristics, no auto-remediation.

import { db } from "@/lib/lawrence-core/db";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import type { ActorContext } from "@/types/platform";
import { schemaFor } from "../schemas/registry";
import { validateCanonicalObject } from "../schemas/validate";
import { validateRelationship } from "../relationships/validate";
import { validateGraph } from "../graph/graph-integrity";
import { preflightGraph, type GraphPreflightResult } from "../graph/graph-preflight";
import type { GraphRule, GraphGlobalConfig, OntologyGraph } from "../graph/graph-types";
import {
  resolveGovernanceEnforcementMode,
  type GovernanceEnforcementMode,
} from "./governance-enforcement";
import { runGovernancePolicies } from "./governance-policy-registry";
import { GovernanceDecisionError } from "./governance-errors";
import type {
  GovernanceDecision,
  GovernanceFinding,
  GovernanceStage,
  GovernanceSubjectType,
  OverallStatus,
  ExecutionDecision,
} from "./governance-types";

// ── Metrics ───────────────────────────────────────────────────────────────────
export interface GovernanceMetrics {
  decisions: number;
  passed: number;
  passedWithWarnings: number;
  blocked: number;
}
const METRICS: GovernanceMetrics = { decisions: 0, passed: 0, passedWithWarnings: 0, blocked: 0 };
export function getGovernanceMetrics(): GovernanceMetrics {
  return { ...METRICS };
}
export function resetGovernanceMetrics(): void {
  METRICS.decisions = 0;
  METRICS.passed = 0;
  METRICS.passedWithWarnings = 0;
  METRICS.blocked = 0;
}

// ── Options ───────────────────────────────────────────────────────────────────
export interface EvaluateGovernanceOptions {
  subjectType: GovernanceSubjectType;
  subjectId: string;
  /** Scope: govern only objects of these types (and edges between them). */
  objectTypes?: string[];
  /** Validate this snapshot instead of loading the tenant graph. */
  graph?: OntologyGraph;
  rules?: readonly GraphRule[];
  config?: GraphGlobalConfig;
  /** Override the resolved governance mode (else per tenant/global/env/default). */
  mode?: GovernanceEnforcementMode;
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

// ── Stage 1: object validation (VS-003) ───────────────────────────────────────
function stageObjects(graph: OntologyGraph): GovernanceFinding[] {
  const findings: GovernanceFinding[] = [];
  for (const o of graph.objects) {
    const schema = schemaFor(o.objectType);
    if (!schema) continue; // unregistered objects are unaffected (mirrors VS-003)
    const violations = validateCanonicalObject(schema, {
      objectType: o.objectType,
      externalKey: o.externalKey,
      title: o.title,
      status: o.status,
      properties: o.properties,
    });
    for (const v of violations) {
      findings.push({
        stage: "object",
        code: v.code,
        severity: "error", // registered-object violations are blocking-eligible (VS-003 enforce)
        message: `${o.objectType} ${o.externalKey ?? o.id}: ${v.message}`,
        objectId: o.id,
        objectType: o.objectType,
      });
    }
  }
  return findings;
}

// ── Stage 2: relationship validation (VS-004) ─────────────────────────────────
function stageRelationships(graph: OntologyGraph): GovernanceFinding[] {
  const findings: GovernanceFinding[] = [];
  for (const link of graph.links) {
    const sameType = graph.links.filter((l) => l.linkType === link.linkType);
    const sourceOutDegree = sameType.filter((l) => l.fromObjectId === link.fromObjectId && l.id !== link.id).length;
    const targetInDegree = sameType.filter((l) => l.toObjectId === link.toObjectId && l.id !== link.id).length;
    const violations = validateRelationship(
      { linkType: link.linkType, sourceType: link.fromObjectType, targetType: link.toObjectType },
      { sourceOutDegree, targetInDegree },
    );
    for (const v of violations) {
      findings.push({
        stage: "relationship",
        code: v.code,
        // Mirrors VS-004 enforce: unregistered relationship types are never
        // blocking; invalid registered relationships are.
        severity: v.code === "unknown_relationship_type" ? "warning" : "error",
        message: `${link.fromObjectType} --${link.linkType}--> ${link.toObjectType}: ${v.message}`,
        linkType: link.linkType,
        path: [link.fromObjectId, link.toObjectId],
      });
    }
  }
  return findings;
}

// ── Stage 3: graph integrity (VS-005) ─────────────────────────────────────────
async function stageGraph(
  ctx: ActorContext,
  graph: OntologyGraph,
  rules?: readonly GraphRule[],
  config?: GraphGlobalConfig,
): Promise<{ findings: GovernanceFinding[]; statistics: { objects: number; edges: number; disconnectedSubgraphs: number } }> {
  const report = await validateGraph(ctx, { graph, rules, config, mode: "warn" });
  const findings: GovernanceFinding[] = [...report.errors, ...report.warnings].map((f) => ({
    stage: "graph",
    code: f.code,
    severity: f.severity,
    message: f.message,
    objectId: f.objectId,
    objectType: f.objectType,
    linkType: f.linkType,
    path: f.path,
  }));
  return {
    findings,
    statistics: {
      objects: report.statistics.objects,
      edges: report.statistics.edges,
      disconnectedSubgraphs: report.statistics.disconnectedSubgraphs,
    },
  };
}

const STAGES: GovernanceStage[] = ["object", "relationship", "graph", "policy"];

/**
 * Evaluate the enterprise governance pipeline and return a single
 * GovernanceDecision. In enforce mode a BLOCKED decision throws
 * GovernanceDecisionError (carrying the decision). In warn mode it never throws.
 */
export async function evaluateGovernance(
  ctx: ActorContext,
  opts: EvaluateGovernanceOptions,
): Promise<GovernanceDecision> {
  const mode = opts.mode ?? resolveGovernanceEnforcementMode(ctx.tenantId);
  const graph = opts.graph ?? (await loadScopedGraph(ctx, opts.objectTypes));

  // Stages 1–3.
  const objectFindings = stageObjects(graph);
  const relationshipFindings = stageRelationships(graph);
  const { findings: graphFindings, statistics } = await stageGraph(ctx, graph, opts.rules, opts.config);

  // Stage 4: graph preflight (VS-007) — advisory input run in warn mode (never
  // throws here). Its findings equal the graph findings, so they are NOT
  // re-aggregated; the result is retained for traceability.
  let preflight: GraphPreflightResult | null = null;
  try {
    preflight = await preflightGraph(ctx, {
      subjectType: opts.subjectType === "mission" ? "mission" : "workflow",
      subjectId: opts.subjectId,
      graph,
      rules: opts.rules,
      config: opts.config,
      mode: "warn",
    });
  } catch {
    preflight = null; // warn-mode preflight does not throw; defensive only
  }

  // Stage 5: policy evaluation (extension point).
  const policyFindings = await runGovernancePolicies({
    ctx,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    graph,
  });

  // Aggregate.
  const all = [...objectFindings, ...relationshipFindings, ...graphFindings, ...policyFindings];
  const blockingFindings = all.filter((f) => f.severity === "error");
  const warningFindings = all.filter((f) => f.severity === "warning");

  const overallStatus: OverallStatus =
    blockingFindings.length > 0 ? "failed" : warningFindings.length > 0 ? "warning" : "pass";
  const executionDecision: ExecutionDecision =
    blockingFindings.length > 0
      ? mode === "enforce"
        ? "BLOCKED"
        : "PASS_WITH_WARNINGS"
      : warningFindings.length > 0
        ? "PASS_WITH_WARNINGS"
        : "PASS";

  const event =
    executionDecision === "BLOCKED"
      ? "ontology.governance.blocked"
      : executionDecision === "PASS_WITH_WARNINGS"
        ? "ontology.governance.warning"
        : "ontology.governance.passed";

  const decision: GovernanceDecision = {
    overallStatus,
    executionDecision,
    executionMode: mode,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    objectFindings,
    relationshipFindings,
    graphFindings,
    policyFindings,
    blockingFindings,
    warningFindings,
    metrics: {
      objects: graph.objects.length,
      relationships: graph.links.length,
      objectFindings: objectFindings.length,
      relationshipFindings: relationshipFindings.length,
      graphFindings: graphFindings.length,
      policyFindings: policyFindings.length,
      blocking: blockingFindings.length,
      warnings: warningFindings.length,
      stages: STAGES,
    },
    events: [event],
    governanceReport: {
      subjectType: opts.subjectType,
      subjectId: opts.subjectId,
      executionMode: mode,
      overallStatus,
      executionDecision,
      counts: {
        objectFindings: objectFindings.length,
        relationshipFindings: relationshipFindings.length,
        graphFindings: graphFindings.length,
        policyFindings: policyFindings.length,
        blocking: blockingFindings.length,
        warnings: warningFindings.length,
      },
      preflight,
      graphStatistics: statistics,
    },
  };

  // Metrics.
  METRICS.decisions += 1;
  if (executionDecision === "PASS") METRICS.passed += 1;
  else if (executionDecision === "PASS_WITH_WARNINGS") METRICS.passedWithWarnings += 1;
  else METRICS.blocked += 1;

  // Governance event (best-effort; never changes the outcome).
  try {
    await emitAudit(
      ctx,
      event,
      { type: opts.subjectType, id: opts.subjectId },
      {
        executionDecision,
        overallStatus,
        mode,
        blocking: blockingFindings.length,
        warnings: warningFindings.length,
        codes: [...new Set(blockingFindings.map((f) => f.code))].sort(),
      },
    );
  } catch {
    // auditing SHALL NOT change the governance outcome
  }

  if (executionDecision === "BLOCKED") throw new GovernanceDecisionError(decision);
  return decision;
}
