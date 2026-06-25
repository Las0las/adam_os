import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { runtimeHealth } from "@/lib/mission-control/runtime/deployment-service";
import { Metric, PageHeader, Placeholder, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const ctx = await appContext();
  const incidents = await db.runtimeIncidents.list(ctx.tenantId);
  const health = await runtimeHealth(ctx);

  return (
    <>
      <PageHeader title="Incidents" sub="Runtime incidents raised across the platform." />
      <div className="grid grid-4">
        <Metric label="Open incidents" value={health.openIncidents} />
      </div>

      <div style={{ marginTop: 16 }}>
        {incidents.length === 0 ? (
          <Placeholder title="Incidents" note="No runtime incidents." />
        ) : (
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td>{i.title}</td>
                    <td>{i.severity}</td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                    <td>{i.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
