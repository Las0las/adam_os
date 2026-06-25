// Phase 5 — Run trace status badge (Part K).

import { statusTone } from "../object-detail/object-detail-format";

export function TraceStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="badge neutral">unknown</span>;
  return <span className={`badge ${statusTone(status)}`}>{status}</span>;
}
