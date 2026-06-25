import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";
import { runtimeHealth } from "@/lib/mission-control/runtime/deployment-service";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const ctx = await appContext();
  const health = runtimeHealth(ctx);
  const reviews = listReviewCases(ctx);
  const objects = listObjects(ctx);
  const audit = listAudit(ctx.tenantId).slice(0, 8);
  const blockedActions = db.actionExecutions.list(ctx.tenantId, (a) => a.status === "blocked");

  return (
    <>
      <PageHeader
        title="Command Center"
        sub="Operator home — live operating metrics, queues, and recent activity across all three fabrics."
      />

      <div className="grid grid-4">
        <Metric label="Ontology objects" value={objects.length} />
        <Metric label="Open reviews" value={health.reviewBacklog} />
        <Metric label="Blocked actions" value={blockedActions.length} />
        <Metric label="Open incidents" value={health.openIncidents} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Review Queue</h3>
          {reviews.length === 0 ? (
            <p className="muted">No review cases.</p>
          ) : (
            reviews.slice(0, 6).map((r) => (
              <div className="row" key={r.id}>
                <span>{r.summary ?? r.caseType}</span>
                <StatusBadge status={r.status} />
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3>Runtime Health</h3>
          <div className="row">
            <span>Pipeline failure rate</span>
            <span>{(health.pipelineFailureRate * 100).toFixed(0)}%</span>
          </div>
          <div className="row">
            <span>Function failure rate</span>
            <span>{(health.functionFailureRate * 100).toFixed(0)}%</span>
          </div>
          <div className="row">
            <span>Action failure rate</span>
            <span>{(health.actionFailureRate * 100).toFixed(0)}%</span>
          </div>
          <div className="row">
            <span>Notification failure rate</span>
            <span>{(health.notificationFailureRate * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recent Activity (audit)</h3>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Subject</th>
              <th>At</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((e) => (
              <tr key={e.id}>
                <td>
                  <code>{e.action}</code>
                </td>
                <td className="muted">
                  {e.subjectType ?? "—"} {e.subjectId ? `· ${e.subjectId}` : ""}
                </td>
                <td className="muted">{e.createdAt.slice(11, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
