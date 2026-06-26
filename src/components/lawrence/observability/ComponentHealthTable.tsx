"use client";

// Phase 7 — per-component health table. Lists runs, failures, average latency,
// and estimated cost for each runtime component in overview.byComponent.

import type { ComponentMetrics } from "@/lib/aiops/observability/observability-types";

export function ComponentHealthTable({ rows }: { rows: ComponentMetrics[] }) {
  return (
    <div className="card">
      <h3>Component health</h3>
      {rows.length === 0 ? (
        <p className="muted">No component activity in window.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Key</th>
              <th>Runs</th>
              <th>Failures</th>
              <th>Avg latency (ms)</th>
              <th>Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.componentType}:${r.componentKey}`}>
                <td>
                  <span className="badge neutral">{r.componentType}</span>
                </td>
                <td>
                  <code>{r.componentKey}</code>
                </td>
                <td>{r.runs}</td>
                <td className={r.failures > 0 ? "badge bad" : undefined}>
                  {r.failures}
                </td>
                <td>{r.averageLatencyMs.toFixed(0)}</td>
                <td>${r.estimatedCost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
