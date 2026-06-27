"use client";

// VS-006 — Graph Integrity Review Surface (client). Read-only: a user explicitly
// runs validateGraph() via the API and reviews findings. It never auto-fixes and
// never changes write behavior. Consumes the typed GraphIntegritySurface produced
// by the pure presenter (traceable to VS-005 GRAPH_* codes).

import { useState } from "react";
import { Metric } from "@/components/lawrence/shared/widgets";
import type {
  GraphIntegritySurface,
  GovernanceState,
  GraphFindingGroup,
} from "@/lib/dataops/ontology/graph/graph-surface";

const STATE_TONE: Record<GovernanceState, string> = {
  pass: "good",
  warning: "warn",
  failed: "bad",
};
const STATE_LABEL: Record<GovernanceState, string> = {
  pass: "Pass",
  warning: "Warning",
  failed: "Failed",
};

type GroupDim = "bySeverity" | "byCode" | "byObject" | "byRelationship" | "byRule";
const DIMENSIONS: Array<{ key: GroupDim; label: string }> = [
  { key: "byCode", label: "By Rule Code" },
  { key: "bySeverity", label: "By Severity" },
  { key: "byObject", label: "By Object" },
  { key: "byRelationship", label: "By Relationship" },
  { key: "byRule", label: "By Rule" },
];

export function GraphIntegrityView() {
  const [surface, setSurface] = useState<GraphIntegritySurface | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState("");
  const [dim, setDim] = useState<GroupDim>("byCode");

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      const objectTypes = scope.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/ontology/graph-integrity/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objectTypes: objectTypes.length ? objectTypes : undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "validation failed");
      setSurface(json.data as GraphIntegritySurface);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="graph-integrity">
      <div className="card">
        <div className="row" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="text"
            value={scope}
            placeholder="Scope (optional): Candidate, Submission, Job…"
            onChange={(e) => setScope(e.target.value)}
            aria-label="Object type scope"
            style={{ flex: 1 }}
          />
          <button onClick={run} disabled={pending} className="primary">
            {pending ? "Validating…" : "Run Graph Validation"}
          </button>
        </div>
        <p className="muted">
          Read-only review. Validation is always run in warn mode and never changes data
          or write behavior.
        </p>
      </div>

      {error ? <div className="card bad"><strong>Error:</strong> {error}</div> : null}

      {surface ? <GraphIntegrityResult surface={surface} dim={dim} setDim={setDim} /> : null}
    </div>
  );
}

function GraphIntegrityResult({
  surface,
  dim,
  setDim,
}: {
  surface: GraphIntegritySurface;
  dim: GroupDim;
  setDim: (d: GroupDim) => void;
}) {
  const s = surface.summary;
  const groups = surface.groups[dim];
  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Governance State</h3>
          <span className={`badge ${STATE_TONE[s.governanceState]}`}>{STATE_LABEL[s.governanceState]}</span>
        </div>
        <p className="muted">
          Configured mode: <strong>{s.resolvedMode}</strong>
          {s.wouldRejectInEnforce ? " — would REJECT under enforce" : " — would pass under enforce"}
        </p>
      </div>

      <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.5rem" }}>
        <Metric label="Total findings" value={s.totalFindings} />
        <Metric label="Blocking" value={s.blockingFindings} />
        <Metric label="Warnings" value={s.warningFindings} />
        <Metric label="Affected nodes" value={s.affectedNodes} />
        <Metric label="Affected edges" value={s.affectedEdges} />
        <Metric label="Orphans" value={s.orphanCount} />
        <Metric label="Cycles" value={s.cycleCount} />
        <Metric label="Duplicate edges" value={s.duplicateEdgeCount} />
        <Metric label="Missing critical rels" value={s.missingCriticalRelationships} />
        <Metric label="Objects" value={s.objects} />
        <Metric label="Edges" value={s.edges} />
        <Metric label="Subgraphs" value={s.disconnectedSubgraphs} />
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          {DIMENSIONS.map((d) => (
            <button key={d.key} onClick={() => setDim(d.key)} className={dim === d.key ? "primary" : "ghost"}>
              {d.label}
            </button>
          ))}
        </div>
        {groups.length === 0 ? (
          <p className="muted">No findings — the graph passes integrity validation.</p>
        ) : (
          <ul className="finding-groups" style={{ listStyle: "none", padding: 0 }}>
            {groups.map((g) => (
              <GraphFindingGroupRow key={g.key} group={g} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function GraphFindingGroupRow({ group }: { group: GraphFindingGroup }) {
  return (
    <li className="card" style={{ marginBottom: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{group.label}</strong>
        <span>
          {group.errors > 0 ? <span className="badge bad">{group.errors} blocking</span> : null}{" "}
          {group.warnings > 0 ? <span className="badge warn">{group.warnings} warning</span> : null}
        </span>
      </div>
      <ul style={{ marginTop: "0.25rem" }}>
        {group.findings.map((f, i) => (
          <li key={`${f.code}-${f.objectId ?? f.linkType ?? i}`} className="muted">
            <span className={`badge ${f.severity === "error" ? "bad" : "warn"}`}>{f.code}</span> {f.message}
          </li>
        ))}
      </ul>
    </li>
  );
}
