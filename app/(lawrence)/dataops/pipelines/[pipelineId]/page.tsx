import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function PipelineDetailPage({
  params,
}: {
  params: { pipelineId: string };
}) {
  const ctx = await appContext();
  const runs = await db.pipelineRuns.list(ctx.tenantId, (r) => r.pipelineId === params.pipelineId);

  return (
    <>
      <PageHeader title="Pipeline" sub={params.pipelineId} />

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Links</h3>
        <div className="row">
          <Link href={`/dataops/pipelines/${params.pipelineId}/runs`}>Runs</Link>
        </div>
        <div className="row">
          <Link href={`/dataops/pipelines/${params.pipelineId}/lineage`}>Lineage</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Runs</h3>
        {runs.length === 0 ? (
          <p className="muted">No runs for this pipeline.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Started</th>
                <th>Stats</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="muted">{r.startedAt.slice(11, 19)}</td>
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
