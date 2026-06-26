"use client";

// Phase 7 — recent failures feed. Shows the component, trace type, first error
// message, and timestamp for each failed runtime trace.

import type { RuntimeTrace } from "@/lib/aiops/observability/observability-types";

export function FailureFeed({
  traces,
  onSelect,
}: {
  traces: RuntimeTrace[];
  onSelect?: (traceId: string) => void;
}) {
  return (
    <div className="card">
      <h3>Recent failures</h3>
      {traces.length === 0 ? (
        <p className="muted">No recent failures.</p>
      ) : (
        traces.map((t) => (
          <div
            className="row"
            key={t.id}
            onClick={onSelect ? () => onSelect(t.traceId) : undefined}
            style={onSelect ? { cursor: "pointer" } : undefined}
          >
            <span>
              <code>{t.componentKey ?? "—"}</code>{" "}
              <span className="badge neutral">{t.traceType}</span>
              <br />
              <span className="muted">{t.errors[0] ?? "Unknown error"}</span>
            </span>
            <span className="muted">{t.createdAt.slice(0, 19).replace("T", " ")}</span>
          </div>
        ))
      )}
    </div>
  );
}
