// Phase 5 — Object audit timeline (Part C-UI). Chronological list of audit
// events with actor, age, and a compact truncated payload preview.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { formatRelativeAge } from "@/lib/domains/command-center/command-center-formatters";
import { prettyJson, truncate } from "./object-detail-format";

export function ObjectAuditTimeline({ audit }: { audit: ObjectDetail["audit"] }) {
  if (!audit || audit.length === 0) {
    return <div className="muted">No audit events for this object.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {audit.map((event) => {
        const hasPayload = event.payload && Object.keys(event.payload).length > 0;
        return (
          <div className="card" key={event.id}>
            <div className="row" style={{ borderBottom: "none", padding: 0 }}>
              <span style={{ fontSize: 12 }}>
                {event.eventType}
                {event.actor ? <span className="muted"> · {event.actor}</span> : null}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>{formatRelativeAge(event.createdAt)}</span>
            </div>
            {hasPayload ? (
              <pre className="json">{truncate(prettyJson(event.payload), 400)}</pre>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
