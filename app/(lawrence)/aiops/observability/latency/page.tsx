import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { summarize } from "@/lib/aiops/observability/trace-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function LatencyPage() {
  const ctx = await appContext();
  const obs = await summarize(ctx);
  const traces = (await db.modelTraces.list(ctx.tenantId)).slice(-20).reverse();

  return (
    <>
      <PageHeader title="Latency" />
      <div className="grid grid-3">
        <Metric label="Avg latency (ms)" value={obs.avgLatencyMs.toFixed(0)} />
        <Metric label="Model traces" value={obs.traceCount} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent traces</h3>
        <table>
          <thead>
            <tr>
              <th>Scope</th>
              <th>Latency (ms)</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.id}>
                <td>{t.scope}</td>
                <td>{t.latencyMs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
