import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { runtimeHealth } from "@/lib/mission-control/runtime/deployment-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function MissionControlPage() {
  const ctx = await appContext();
  const health = runtimeHealth(ctx);
  const releases = db.releaseBundles.list(ctx.tenantId);
  const actions = db.actionExecutions.list(ctx.tenantId);
  const notifications = db.notifications.list(ctx.tenantId);

  return (
    <>
      <PageHeader
        title="Mission Control"
        sub="Deployment, action execution, approvals, notifications, audit, and rollback."
      />
      <div className="grid grid-4">
        <Metric label="Releases" value={releases.length} />
        <Metric label="Action executions" value={actions.length} />
        <Metric label="Notifications" value={notifications.length} />
        <Metric label="Review backlog" value={health.reviewBacklog} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Release pipeline</h3>
          <table>
            <thead>
              <tr>
                <th>Release</th>
                <th>Env</th>
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

        <div className="card">
          <h3>Action executions</h3>
          {actions.length === 0 ? (
            <p className="muted">No actions executed.</p>
          ) : (
            actions.slice(-8).reverse().map((a) => (
              <div className="row" key={a.id}>
                <span>
                  <code>{a.actionId}</code>
                  {a.blockedReason ? <span className="muted"> · {a.blockedReason}</span> : null}
                </span>
                <StatusBadge status={a.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
