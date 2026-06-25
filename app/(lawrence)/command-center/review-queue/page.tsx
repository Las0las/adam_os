import { appContext } from "@/lib/app/demo-context";
import { listReviewCases } from "@/lib/mission-control/review-queue/review-service";
import { Metric, PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const ctx = await appContext();
  const cases = await listReviewCases(ctx);

  return (
    <>
      <PageHeader
        title="Review Queue"
        sub="Human-in-the-loop cases for low-confidence output, exceptions, and gated actions."
      />
      <div className="grid grid-3">
        <Metric label="Review cases" value={cases.length} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Cases</h3>
        {cases.length === 0 ? (
          <p className="muted">No review cases.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Case type</th>
                <th>Summary</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>{c.caseType}</code>
                  </td>
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
