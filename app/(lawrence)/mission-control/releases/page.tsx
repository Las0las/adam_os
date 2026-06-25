import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const ctx = await appContext();
  const releases = await db.releaseBundles.list(ctx.tenantId);

  const draft = releases.filter((r) => r.environment === "draft").length;
  const staging = releases.filter((r) => r.environment === "staging").length;
  const production = releases.filter((r) => r.environment === "production").length;

  return (
    <>
      <PageHeader title="Releases" sub="Release bundles grouped by environment." />
      <div className="grid grid-4">
        <Metric label="Draft" value={draft} />
        <Metric label="Staging" value={staging} />
        <Metric label="Production" value={production} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Environment</th>
              <th>Status</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
