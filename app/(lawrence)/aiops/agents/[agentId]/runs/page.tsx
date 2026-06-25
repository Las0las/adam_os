import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function AgentRunsPage({
  params,
}: {
  params: { agentId: string };
}) {
  const ctx = await appContext();
  const runs = db.agentRuns.list(ctx.tenantId, (r) => r.agentId === params.agentId);

  return (
    <>
      <PageHeader title={`Runs · ${params.agentId}`} />
      <div className="grid grid-3">
        <Metric label="Agent runs" value={runs.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Agent runs</h3>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Steps</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{r.steps.length}</td>
                <td>{r.createdAt.slice(11, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
