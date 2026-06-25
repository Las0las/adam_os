import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { summarize } from "@/lib/aiops/observability/trace-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ObservabilityPage() {
  const ctx = await appContext();
  const obs = summarize(ctx);
  const traces = db.modelTraces.list(ctx.tenantId).slice(-20).reverse();

  return (
    <>
      <PageHeader
        title="Observability"
        sub="Cost, latency, tokens, and retrieval method for every model interaction."
      />
      <div className="grid grid-4">
        <Metric label="Model traces" value={obs.traceCount} />
        <Metric label="Total cost (USD)" value={obs.totalCostUsd.toFixed(2)} />
        <Metric label="Prompt tokens" value={obs.totalPromptTokens} />
        <Metric label="Avg latency (ms)" value={obs.avgLatencyMs.toFixed(0)} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent traces</h3>
        {traces.length === 0 ? (
          <p className="muted">No model traces.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Scope</th>
                <th>Model</th>
                <th>Latency (ms)</th>
                <th>Retrieval</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="badge neutral">{t.scope}</span>
                  </td>
                  <td>
                    <code>{t.modelKey}</code>
                  </td>
                  <td>{t.latencyMs}</td>
                  <td className="muted">{t.retrievalMethod ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
