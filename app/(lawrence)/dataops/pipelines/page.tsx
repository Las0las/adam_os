import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function PipelinesPage() {
  const ctx = await appContext();
  const runs = db.pipelineRuns.list(ctx.tenantId);

  return (
    <>
      <PageHeader
        title="Pipeline Runs"
        sub="Ingestion and transformation pipeline executions over the data plane."
      />
      <div className="grid grid-3">
        <Metric label="Total runs" value={runs.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Runs</h3>
        {runs.length === 0 ? (
          <p className="muted">No pipeline runs.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pipeline</th>
                <th>Status</th>
                <th>Stats</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.pipelineId}</code>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="muted">
                    <code>{JSON.stringify(r.stats)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
