"use client";

// Phase 5 — runtime health mini panel (Part I). Compact failure-rate readout
// for the Mission Control side rail.

import { useRuntimeHealth } from "@/components/lawrence/hooks/useRuntimeHealth";

function pct(rate: number | undefined): string {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function rateBadge(rate: number | undefined): string {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return "badge neutral";
  if (rate >= 0.1) return "badge bad";
  if (rate > 0) return "badge warn";
  return "badge good";
}

export function RuntimeHealthMiniPanel() {
  const { data, loading, error } = useRuntimeHealth();

  return (
    <div className="card">
      <h3>Runtime health</h3>
      {error ? (
        <p className="muted">Unavailable: {error}</p>
      ) : loading || !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="kv">
            <span className="muted">Pipelines</span>
            <span className={rateBadge(data.pipelineFailureRate)}>{pct(data.pipelineFailureRate)}</span>
          </div>
          <div className="kv">
            <span className="muted">Functions</span>
            <span className={rateBadge(data.functionFailureRate)}>{pct(data.functionFailureRate)}</span>
          </div>
          <div className="kv">
            <span className="muted">Actions</span>
            <span className={rateBadge(data.actionFailureRate)}>{pct(data.actionFailureRate)}</span>
          </div>
          <div className="kv">
            <span className="muted">Notifications</span>
            <span className={rateBadge(data.notificationFailureRate)}>
              {pct(data.notificationFailureRate)}
            </span>
          </div>
          <div className="kv">
            <span className="muted">Open incidents</span>
            <span className={data.openIncidents > 0 ? "badge bad" : "badge good"}>
              {data.openIncidents}
            </span>
          </div>
          <div className="kv">
            <span className="muted">Review backlog</span>
            <span className={data.reviewBacklog > 0 ? "badge warn" : "badge good"}>
              {data.reviewBacklog}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
