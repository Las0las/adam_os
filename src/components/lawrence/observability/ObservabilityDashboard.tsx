"use client";

// Phase 7 — observability dashboard root. Loads the live ObservabilityOverview
// and lays out headline metrics, component health, cost, slow runs, the failure
// feed, and surfaced learning signals. Clicking a trace opens the detail drawer.

import { useState } from "react";
import { useObservabilityOverview } from "@/components/lawrence/hooks/useObservabilityOverview";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { ObservabilityMetricsRow } from "./ObservabilityMetricsRow";
import { ComponentHealthTable } from "./ComponentHealthTable";
import { CostByComponentChart } from "./CostByComponentChart";
import { LatencyTable } from "./LatencyTable";
import { FailureFeed } from "./FailureFeed";
import { TraceDetailDrawer } from "./TraceDetailDrawer";

export function ObservabilityDashboard() {
  const { data, loading, error, refresh } = useObservabilityOverview();
  const [traceId, setTraceId] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Observability"
        sub="Live cost, latency, failures, and quality across every runtime component."
      />

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className="btn" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        {data ? (
          <span className="muted">
            Generated {data.generatedAt.slice(0, 19).replace("T", " ")}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load observability: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 18, width: "40%", marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 72, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        <>
          <ObservabilityMetricsRow metrics={data.metrics} />

          <div style={{ marginTop: 16 }}>
            <ComponentHealthTable rows={data.byComponent} />
          </div>

          <div style={{ marginTop: 16 }}>
            <CostByComponentChart rows={data.byComponent} />
          </div>

          <div style={{ marginTop: 16 }}>
            <LatencyTable traces={data.slowRuns} onSelect={setTraceId} />
          </div>

          <div style={{ marginTop: 16 }}>
            <FailureFeed traces={data.recentFailures} onSelect={setTraceId} />
          </div>

          {traceId ? (
            <div style={{ marginTop: 16 }}>
              <TraceDetailDrawer traceId={traceId} onClose={() => setTraceId(null)} />
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Learning signals</h3>
            {data.learningSignals.length === 0 ? (
              <p className="muted">No open learning signals.</p>
            ) : (
              data.learningSignals.map((s) => (
                <div className="row" key={s.id}>
                  <span>
                    <span className="badge neutral">{s.signalType}</span>{" "}
                    {s.summary}
                  </span>
                  <span className={`badge ${s.severity === "critical" || s.severity === "high" ? "bad" : "warn"}`}>
                    {s.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
