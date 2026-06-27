// Graph integrity report assembly (VS-005 / ADR-0009). Pure: buckets findings and
// computes deterministic statistics (connected components, orphan count).

import type { GraphFinding, GraphIntegrityReport, OntologyGraph } from "./graph-types";

/** Count connected components of the undirected graph over all edges. */
export function countDisconnectedSubgraphs(graph: OntologyGraph): number {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const add = (x: string) => {
    if (!parent.has(x)) parent.set(x, x);
  };
  for (const o of graph.objects) add(o.id);
  for (const l of graph.links) {
    add(l.fromObjectId);
    add(l.toObjectId);
    const a = find(l.fromObjectId);
    const b = find(l.toObjectId);
    if (a !== b) parent.set(a, b);
  }
  const roots = new Set<string>();
  for (const k of parent.keys()) roots.add(find(k));
  return roots.size;
}

/** Assemble the final report from a flat finding list. Deterministic: findings are
 *  sorted by (code, objectId, message) before bucketing. */
export function buildReport(
  findings: GraphFinding[],
  graph: OntologyGraph,
  validationTimeMs: number,
): GraphIntegrityReport {
  const sorted = [...findings].sort((a, b) =>
    `${a.code}|${a.objectId ?? ""}|${a.linkType ?? ""}|${a.message}`.localeCompare(
      `${b.code}|${b.objectId ?? ""}|${b.linkType ?? ""}|${b.message}`,
    ),
  );

  const errors = sorted.filter((f) => f.severity === "error");
  const warnings = sorted.filter((f) => f.severity === "warning");
  const orphanObjects = [
    ...new Set(sorted.filter((f) => f.code === "GRAPH_ORPHAN" && f.objectId).map((f) => f.objectId!)),
  ].sort();
  const duplicateEdges = [
    ...new Set(
      sorted
        .filter((f) => f.code === "GRAPH_DUPLICATE_EDGE")
        .map((f) => (f.path ? f.path.join("->") : `${f.linkType}:${f.objectId ?? ""}`)),
    ),
  ].sort();
  const invalidPaths = sorted.filter((f) => f.code === "GRAPH_INVALID_PATH");
  const cycles = sorted
    .filter((f) => f.code === "GRAPH_CYCLE" && f.path)
    .map((f) => f.path!);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    orphanObjects,
    duplicateEdges,
    invalidPaths,
    cycles,
    statistics: {
      objects: graph.objects.length,
      edges: graph.links.length,
      disconnectedSubgraphs: countDisconnectedSubgraphs(graph),
      orphanCount: orphanObjects.length,
      validationTimeMs,
    },
  };
}
