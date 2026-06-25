import { appContext } from "@/lib/app/demo-context";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await appContext();
  const events = (await listAudit(ctx.tenantId)).slice(0, 100);

  return (
    <>
      <PageHeader
        title="Audit Log"
        sub="Every state-changing service call recorded for governance and traceability."
      />
      <div className="grid grid-3">
        <Metric label="Events (last 100)" value={events.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Events</h3>
        {events.length === 0 ? (
          <p className="muted">No audit events.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Subject type</th>
                <th>Subject ID</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <code>{e.action}</code>
                  </td>
                  <td>{e.subjectType ?? "—"}</td>
                  <td className="muted">{e.subjectId ?? "—"}</td>
                  <td>{e.createdAt.slice(11, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
