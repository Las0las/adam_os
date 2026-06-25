import { appContext } from "@/lib/app/demo-context";
import { db } from "@/lib/lawrence-core/db";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { Metric, PageHeader } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const ctx = await appContext();

  const ontologyObjects = db.ontologyObjects.list(ctx.tenantId);
  const openReviews = listReviewCases(ctx, "open");
  const blockedActions = db.actionExecutions.list(ctx.tenantId, (a) => a.status === "blocked");
  const notifications = db.notifications.list(ctx.tenantId);

  return (
    <>
      <PageHeader
        title="Command Center"
        sub="Operational overview of ontology, reviews, blocked actions, and notifications."
      />
      <div className="grid grid-4">
        <Metric label="Ontology objects" value={ontologyObjects.length} />
        <Metric label="Open reviews" value={openReviews.length} />
        <Metric label="Blocked actions" value={blockedActions.length} />
        <Metric label="Notifications" value={notifications.length} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Action queue</h3>
          <p className="muted">Inspect queued, running, and blocked action executions.</p>
          <a href="/command-center/action-queue">Open action queue</a>
        </div>
        <div className="card">
          <h3>Review queue</h3>
          <p className="muted">Human-in-the-loop cases awaiting a reviewer decision.</p>
          <a href="/command-center/review-queue">Open review queue</a>
        </div>
        <div className="card">
          <h3>Activity</h3>
          <p className="muted">Recent audit events across the tenant.</p>
          <a href="/command-center/activity">Open activity</a>
        </div>
      </div>
    </>
  );
}
