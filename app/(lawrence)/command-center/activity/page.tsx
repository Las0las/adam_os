import { appContext } from "@/lib/app/demo-context";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const ctx = await appContext();
  const events = (await listAudit(ctx.tenantId)).slice(0, 100);

  return (
    <>
      <PageHeader title="Activity" sub="Recent audit events across the tenant." />
      <div className="grid grid-4">
        <Metric label="Events shown" value={events.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
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
                <td>{e.subjectId ?? "—"}</td>
                <td>{e.createdAt.slice(11, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
