// VS-006 — Graph Integrity Review Surface (presenter). PURE: turns a VS-005
// GraphIntegrityReport into an executive-grade, operationally-useful view-model.
// No DB, no validation, no side effects — deterministic and fully testable. The
// review surface is read-only and never changes write behavior.

import type { GraphFinding, GraphIntegrityReport } from "./graph-types";
import type { GraphEnforcementMode } from "./graph-enforcement";

export type GovernanceState = "pass" | "warning" | "failed";

export interface GraphFindingGroup {
  key: string;
  label: string;
  count: number;
  errors: number;
  warnings: number;
  findings: GraphFinding[];
}

export interface GraphIntegritySurfaceSummary {
  governanceState: GovernanceState;
  /** The tenant's resolved enforcement mode (display only; the surface always
   *  validates in warn mode so review never throws). */
  resolvedMode: GraphEnforcementMode;
  /** True when error-severity findings exist — i.e. enforce mode WOULD reject. */
  wouldRejectInEnforce: boolean;
  totalFindings: number;
  blockingFindings: number;
  warningFindings: number;
  affectedNodes: number;
  affectedEdges: number;
  orphanCount: number;
  cycleCount: number;
  duplicateEdgeCount: number;
  missingCriticalRelationships: number;
  objects: number;
  edges: number;
  disconnectedSubgraphs: number;
  validationTimeMs: number;
}

export interface GraphIntegritySurface {
  summary: GraphIntegritySurfaceSummary;
  groups: {
    bySeverity: GraphFindingGroup[];
    byCode: GraphFindingGroup[];
    byObject: GraphFindingGroup[];
    byRelationship: GraphFindingGroup[];
    byRule: GraphFindingGroup[];
  };
  /** Raw report retained for traceability to VS-005 codes. */
  report: GraphIntegrityReport;
  target: { scope: "tenant"; objectTypes: string[] | null };
}

function group(
  findings: GraphFinding[],
  keyOf: (f: GraphFinding) => string | undefined,
  labelOf: (key: string) => string = (k) => k,
): GraphFindingGroup[] {
  const buckets = new Map<string, GraphFinding[]>();
  for (const f of findings) {
    const key = keyOf(f);
    if (key == null) continue;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(f);
  }
  return [...buckets.entries()]
    .map(([key, fs]) => ({
      key,
      label: labelOf(key),
      count: fs.length,
      errors: fs.filter((f) => f.severity === "error").length,
      warnings: fs.filter((f) => f.severity === "warning").length,
      findings: fs,
    }))
    .sort((a, b) => b.errors - a.errors || b.count - a.count || a.key.localeCompare(b.key));
}

export function governanceStateOf(report: GraphIntegrityReport): GovernanceState {
  if (report.errors.length > 0) return "failed";
  if (report.warnings.length > 0) return "warning";
  return "pass";
}

/** Build the deterministic review view-model from a report. */
export function buildGraphIntegritySurface(
  report: GraphIntegrityReport,
  resolvedMode: GraphEnforcementMode,
  target: { scope: "tenant"; objectTypes: string[] | null } = { scope: "tenant", objectTypes: null },
): GraphIntegritySurface {
  const all = [...report.errors, ...report.warnings];

  const affectedNodes = new Set(all.filter((f) => f.objectId).map((f) => f.objectId!)).size;
  const affectedEdges = new Set(
    all
      .filter((f) => f.linkType || (f.path && f.path.length === 2))
      .map((f) => `${f.linkType ?? ""}:${(f.path ?? []).join("->")}`),
  ).size;

  const summary: GraphIntegritySurfaceSummary = {
    governanceState: governanceStateOf(report),
    resolvedMode,
    wouldRejectInEnforce: report.errors.length > 0,
    totalFindings: all.length,
    blockingFindings: report.errors.length,
    warningFindings: report.warnings.length,
    affectedNodes,
    affectedEdges,
    orphanCount: report.orphanObjects.length,
    cycleCount: report.cycles.length,
    duplicateEdgeCount: report.duplicateEdges.length,
    missingCriticalRelationships: all.filter((f) => f.code === "GRAPH_REQUIRED_RELATIONSHIP").length,
    objects: report.statistics.objects,
    edges: report.statistics.edges,
    disconnectedSubgraphs: report.statistics.disconnectedSubgraphs,
    validationTimeMs: report.statistics.validationTimeMs,
  };

  return {
    summary,
    groups: {
      bySeverity: group(all, (f) => f.severity),
      byCode: group(all, (f) => f.code),
      byObject: group(all, (f) => f.objectId, (k) => k),
      byRelationship: group(all, (f) => f.linkType, (k) => k),
      byRule: group(all, (f) => `${f.code}${f.linkType ? `:${f.linkType}` : ""}`),
    },
    report,
    target,
  };
}
