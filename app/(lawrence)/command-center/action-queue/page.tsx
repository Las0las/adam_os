import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ActionQueuePage() {
  const ctx = await appContext();
  const actions = db.actionExecutions.list(ctx.tenantId);

  return (
    <>
      <PageHeader title="Action Queue" sub="All action executions for this tenant." />
      <div className="grid grid-4">
        <Metric label="Action executions" value={actions.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Object type</th>
              <th>Status</th>
              <th>Blocked reason</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id}>
                <td>
                  <code>{a.actionId}</code>
                </td>
                <td>{a.objectType ?? "—"}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>{a.blockedReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
