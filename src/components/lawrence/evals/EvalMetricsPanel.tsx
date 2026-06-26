"use client";

// Phase 7 — eval run metrics panel. Renders the run.metrics bag as a key/value
// grid (values stringified defensively since metrics is Record<string, unknown>).

export function EvalMetricsPanel({
  metrics,
}: {
  metrics?: Record<string, unknown>;
}) {
  const entries = metrics ? Object.entries(metrics) : [];

  return (
    <div className="card">
      <h3>Metrics</h3>
      {entries.length === 0 ? (
        <p className="muted">No metrics recorded.</p>
      ) : (
        entries.map(([k, v]) => (
          <div className="row" key={k}>
            <span>{k}</span>
            <span>
              {typeof v === "number"
                ? v.toFixed(3)
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : String(v)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
