import { appContext } from "@/lib/app/demo-context";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await appContext();
  const approvals = listReviewCases(ctx, "open").filter(
    (c) => c.gatedActionExecutionId,
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        sub="Open review cases gating a customer-affecting action until approved."
      />
      <div className="grid grid-3">
        <Metric label="Pending approvals" value={approvals.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Gated actions</h3>
        {approvals.length === 0 ? (
          <p className="muted">No pending approvals.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Summary</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((c) => (
                <tr key={c.id}>
                  <td className="muted">{c.summary ?? "—"}</td>
                  <td>
                    <span className="badge neutral">{c.severity ?? "—"}</span>
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
