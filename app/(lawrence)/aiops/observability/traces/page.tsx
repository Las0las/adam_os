import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function TracesPage() {
  const ctx = await appContext();
  const all = await db.modelTraces.list(ctx.tenantId);
  const traces = all.slice(-50).reverse();

  return (
    <>
      <PageHeader title="Traces" />
      <div className="grid grid-3">
        <Metric label="Model traces" value={all.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent traces</h3>
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
                <td>{t.scope}</td>
                <td>
                  <code>{t.modelKey}</code>
                </td>
                <td>{t.latencyMs}</td>
                <td>{t.retrievalMethod ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
