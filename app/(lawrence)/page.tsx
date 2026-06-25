import { appContext } from "@/lib/app/demo-context";
import { getCommandCenterOverview } from "@/lib/domains/command-center/command-center-service";
import { domainLabel, formatRelativeAge } from "@/lib/domains/command-center/command-center-formatters";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";
import type { CommandCenterItem } from "@/lib/domains/command-center/command-center-types";

export const dynamic = "force-dynamic";

function QueueCard({
  title,
  items,
  generatedAt,
}: {
  title: string;
  items: CommandCenterItem[];
  generatedAt: string;
}) {
  return (
    <div className="card">
      <h3>
        {title} <span className="muted">· {items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="muted">No open work. Enjoy the silence while it lasts.</p>
      ) : (
        items.slice(0, 8).map((it) => (
          <div className="row" key={`${it.kind}-${it.id}`}>
            <span>
              <span className="badge neutral">{domainLabel(it.domain)}</span> {it.title}
              {it.objectRef ? (
                <a
                  className="muted"
                  href={`/objects/${it.objectRef.objectType}/${it.objectRef.objectId}`}
                  style={{ marginLeft: 6 }}
                >
                  ↗
                </a>
              ) : null}
            </span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {it.severity ? <StatusBadge status={it.severity} /> : null}
              <StatusBadge status={it.status} />
              <span className="muted">{formatRelativeAge(it.createdAt, generatedAt)}</span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export default async function CommandCenterPage() {
  const ctx = await appContext();
  const o = await getCommandCenterOverview(ctx, { mode: "executive" });

  return (
    <>
      <PageHeader
        title="Command Center"
        sub="Governed operating surface for actions, reviews, risks, and recommendations."
      />

      <div className="grid grid-4">
        <Metric label="Open Actions" value={o.metrics.openActions} />
        <Metric label="Open Reviews" value={o.metrics.openReviews} />
        <Metric label="Critical Risks" value={o.metrics.criticalRisks} />
        <Metric label="Pending Approvals" value={o.metrics.pendingApprovals} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <QueueCard title="Action Queue" items={o.actionQueue} generatedAt={o.generatedAt} />
        <QueueCard title="Review Queue" items={o.reviewQueue} generatedAt={o.generatedAt} />
        <QueueCard title="Risk Queue" items={o.riskQueue} generatedAt={o.generatedAt} />
        <QueueCard title="Recommendation Queue" items={o.recommendationQueue} generatedAt={o.generatedAt} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent Activity</h3>
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Event</th>
              <th>Subject</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {o.recentActivity.slice(0, 12).map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="badge neutral">{domainLabel(e.domain)}</span>
                </td>
                <td>
                  <code>{e.title}</code>
                </td>
                <td className="muted">{e.summary ?? "—"}</td>
                <td className="muted">{formatRelativeAge(e.createdAt, o.generatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
