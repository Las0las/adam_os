// Phase 5 — Object review panel (Part C-UI). Lists review cases attached to the
// object with status, severity, summary, and age. Approve/reject of open
// reviews is handled in the Review Queue (those actions carry reviewCaseId).

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { formatRelativeAge } from "@/lib/domains/command-center/command-center-formatters";
import { statusTone } from "./object-detail-format";

export function ObjectReviewPanel({ reviews }: { reviews: ObjectDetail["reviews"] }) {
  if (!reviews || reviews.length === 0) {
    return <div className="muted">No review cases for this object.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {reviews.map((review) => (
        <div className="card" key={review.id}>
          <div className="row" style={{ borderBottom: "none", padding: 0 }}>
            <div className="btn-row" style={{ marginTop: 0 }}>
              <span className={`badge ${statusTone(review.status)}`}>{review.status}</span>
              {review.severity ? (
                <span className={`badge sev-${review.severity.toLowerCase()}`}>{review.severity}</span>
              ) : null}
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{formatRelativeAge(review.createdAt)}</span>
          </div>
          {review.summary ? (
            <div style={{ fontSize: 12, marginTop: 8 }}>{review.summary}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
