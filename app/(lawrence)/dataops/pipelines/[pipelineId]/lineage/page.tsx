import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function PipelineLineagePage({
  params,
}: {
  params: { pipelineId: string };
}) {
  const ctx = await appContext();
  const events = db.lineageEvents
    .list(ctx.tenantId, (e) => (e.pipelineRunId ? true : false))
    .slice(0, 100);

  return (
    <>
      <PageHeader
        title="Lineage"
        sub={`${params.pipelineId} · recent run-scoped lineage events`}
      />

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent lineage</h3>
        <p className="muted">Lineage is run-scoped; showing the most recent run-linked events.</p>
        {events.length === 0 ? (
          <p className="muted">No lineage events.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>From type</th>
                <th>To type</th>
                <th>To ID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <code>{e.kind}</code>
                  </td>
                  <td>{e.fromType ?? "—"}</td>
                  <td>{e.toType}</td>
                  <td className="muted">
                    <code>{e.toId}</code>
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
