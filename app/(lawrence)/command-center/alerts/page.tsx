import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, Placeholder, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const ctx = await appContext();
  const incidents = await db.runtimeIncidents.list(ctx.tenantId);

  return (
    <>
      <PageHeader title="Alerts" sub="Runtime incidents detected across the platform." />
      {incidents.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <Placeholder title="No alerts" note="No runtime incidents have been recorded." />
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td>{i.title}</td>
                  <td>
                    <span className="badge neutral">{i.severity}</span>
                  </td>
                  <td>
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
