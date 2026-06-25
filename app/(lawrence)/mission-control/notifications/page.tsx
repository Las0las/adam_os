import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await appContext();
  const rules = db.notificationRules.list(ctx.tenantId);
  const delivered = db.notifications.list(ctx.tenantId).slice(-20).reverse();

  return (
    <>
      <PageHeader title="Notifications" sub="Routing rules and delivered notifications." />
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Rules</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Event</th>
                <th>Channel</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <code>{r.eventKey}</code>
                  </td>
                  <td>{r.channel}</td>
                  <td>
                    <StatusBadge status={r.enabled ? "sent" : "failed"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Delivered</h3>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Channel</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {delivered.map((n) => (
                <tr key={n.id}>
                  <td>{n.title}</td>
                  <td>{n.channel}</td>
                  <td>
                    <StatusBadge status={n.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
