import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function DeploymentsPage() {
  const ctx = await appContext();
  const releases = db.releaseBundles.list(ctx.tenantId);

  return (
    <>
      <PageHeader title="Deployments" sub="Release bundles and their promotion state." />
      <div className="grid grid-4">
        <Metric label="Total" value={releases.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Environment</th>
              <th>Status</th>
              <th>Promoted from</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  <span className="badge neutral">{r.environment}</span>
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{r.promotedFrom ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
