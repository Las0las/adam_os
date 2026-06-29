import { appContext } from "@/lib/app/demo-context";
import { globalRuntimeSnapshot, type RuntimeMetric } from "@/lib/mission-control/runtime/global-runtime-service";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

const TONE_CLASS: Record<RuntimeMetric["tone"], string> = {
  good: "good",
  warn: "warn",
  bad: "bad",
  neutral: "neutral",
};

function formatValue(m: RuntimeMetric): string {
  if (m.label === "Estimated cost") return `$${m.value.toFixed(2)}`;
  if (m.label === "Execution latency") return m.value > 0 ? `${m.value}ms` : "—";
  return m.value.toLocaleString();
}

export default async function GlobalRuntimePage() {
  const ctx = await appContext();
  const snap = await globalRuntimeSnapshot(ctx);

  return (
    <>
      <PageHeader
        title="Global Runtime"
        sub="Everything happening across the workspace, right now — a read-only projection of the live runtime. Individual objects expose their local runtime; Mission Control exposes the global runtime."
      />

      {/* The nine grounded headline metrics. */}
      <div className="grid grid-3">
        {snap.metrics.map((m) => (
          <div className="card" key={m.label}>
            <div className="row" style={{ alignItems: "baseline" }}>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{formatValue(m)}</span>
              <span className={`badge ${TONE_CLASS[m.tone]}`}>{m.tone}</span>
            </div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{m.label}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{m.detail}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              <code>{m.source}</code>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        {/* Governed-execution lifecycle conformance (RFC-C0-X). */}
        <div className="card">
          <h3>Live kernel — governed execution</h3>
          <div className="row">
            <span>Constitutional laws satisfied</span>
            <span className={`badge ${snap.governed.conformant ? "good" : "bad"}`}>
              {snap.governed.lawsSatisfied}/{snap.governed.lawsTotal}
            </span>
          </div>
          <div className="row">
            <span>Governed executions recorded</span>
            <span>{snap.governed.totalRecorded.toLocaleString()}</span>
          </div>
          <div className="row">
            <span>Event throughput</span>
            <span>
              {snap.throughput.perMinute !== null
                ? `${snap.throughput.perMinute}/min · ${snap.throughput.events} events`
                : `${snap.throughput.events} events`}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Every state change is a governed mutation producing a hash-chained event; this is a
            projection of that history, audited even on denial.
          </p>
        </div>

        {/* Alerts and failures, grounded in real incidents and findings. */}
        <div className="card">
          <h3>Alerts &amp; failures</h3>
          {snap.alerts.length === 0 ? (
            <p className="muted">No open incidents or security findings.</p>
          ) : (
            snap.alerts.map((a) => (
              <div className="row" key={a.id}>
                <span>{a.title}</span>
                <span
                  className={`badge ${
                    a.severity === "critical" || a.severity === "high"
                      ? "bad"
                      : a.severity === "medium"
                        ? "warn"
                        : "neutral"
                  }`}
                >
                  {a.severity}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Honesty footer: exactly which real sources back this projection. */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Data sources</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Every metric on this page is grounded in a real tenant-scoped collection — no number is
          fabricated. A metric with no underlying activity reports a zero or an explicit
          &quot;none recorded&quot;, never an invented value.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {snap.sources.map((s) => (
            <span className="badge neutral" key={s}>
              <code>{s}</code>
            </span>
          ))}
        </div>
        <p style={{ marginTop: 12 }}>
          <a href="/mission-control/runtime/health">Runtime health</a> ·{" "}
          <a href="/mission-control/runtime/audit">Runtime audit</a>
        </p>
      </div>
    </>
  );
}
