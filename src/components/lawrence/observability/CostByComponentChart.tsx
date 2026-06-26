"use client";

// Phase 7 — cost-by-component bar list. Pure CSS bars (no chart lib): each
// component is sized relative to the most expensive one.

import type { ComponentMetrics } from "@/lib/aiops/observability/observability-types";

export function CostByComponentChart({ rows }: { rows: ComponentMetrics[] }) {
  const sorted = [...rows].sort((a, b) => b.estimatedCost - a.estimatedCost);
  const max = sorted.reduce((m, r) => Math.max(m, r.estimatedCost), 0);

  return (
    <div className="card">
      <h3>Cost by component</h3>
      {sorted.length === 0 ? (
        <p className="muted">No cost recorded in window.</p>
      ) : (
        <div>
          {sorted.map((r) => {
            const width = max > 0 ? Math.round((r.estimatedCost / max) * 100) : 0;
            return (
              <div
                key={`${r.componentType}:${r.componentKey}`}
                style={{ marginBottom: 8 }}
              >
                <div className="row" style={{ marginBottom: 4 }}>
                  <code>{r.componentKey}</code>
                  <span>${r.estimatedCost.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    background: "var(--surface-2, #e5e7eb)",
                    borderRadius: 4,
                    height: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "var(--accent, #2563eb)",
                      height: "100%",
                      width: `${width}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
