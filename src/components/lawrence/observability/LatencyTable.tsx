"use client";

// Phase 7 — slow-runs latency table. Reads latency/duration from the trace
// metrics bag (Record<string, unknown>) defensively.

import type { RuntimeTrace } from "@/lib/aiops/observability/observability-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";

function num(bag: Record<string, unknown>, key: string): number | undefined {
  const v = bag[key];
  return typeof v === "number" ? v : undefined;
}

function latencyOf(trace: RuntimeTrace): string {
  const ms = num(trace.metrics, "latencyMs") ?? num(trace.metrics, "durationMs");
  return ms === undefined ? "—" : ms.toFixed(0);
}

export function LatencyTable({
  traces,
  onSelect,
}: {
  traces: RuntimeTrace[];
  onSelect?: (traceId: string) => void;
}) {
  return (
    <div className="card">
      <h3>Slow runs</h3>
      {traces.length === 0 ? (
        <p className="muted">No slow runs in window.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Trace type</th>
              <th>Latency (ms)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr
                key={t.id}
                onClick={onSelect ? () => onSelect(t.traceId) : undefined}
                style={onSelect ? { cursor: "pointer" } : undefined}
              >
                <td>
                  <code>{t.componentKey ?? "—"}</code>
                </td>
                <td>
                  <span className="badge neutral">{t.traceType}</span>
                </td>
                <td>{latencyOf(t)}</td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
