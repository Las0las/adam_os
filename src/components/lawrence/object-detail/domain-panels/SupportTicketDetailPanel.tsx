// Phase 5 — Support ticket domain panel (Part F). Shows the issue summary, a
// drafted reply if present, and the citations grounding that draft.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { propString } from "../object-detail-format";
import { EvidenceList } from "../../evidence/EvidenceList";

export function SupportTicketDetailPanel({ detail }: { detail: ObjectDetail }) {
  const props = detail.object.properties;
  const draft = propString(props, "draft") ?? propString(props, "draftReply") ?? propString(props, "reply");
  const issue = propString(props, "issue") ?? propString(props, "description") ?? propString(props, "summary");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <h3>Support Ticket</h3>
        <div className="kv"><span className="muted">Subject</span><span>{detail.object.title ?? detail.object.objectId}</span></div>
        {propString(props, "priority") ? (
          <div className="kv"><span className="muted">Priority</span><span>{propString(props, "priority")}</span></div>
        ) : null}
        {propString(props, "requester") ? (
          <div className="kv"><span className="muted">Requester</span><span>{propString(props, "requester")}</span></div>
        ) : null}
      </div>

      {issue ? (
        <div className="card">
          <h3>Issue</h3>
          <div style={{ fontSize: 12 }}>{issue}</div>
        </div>
      ) : null}

      {draft ? (
        <div className="card">
          <h3>Drafted reply</h3>
          <div className="qexcerpt">{draft}</div>
        </div>
      ) : null}

      {detail.evidence.length > 0 ? (
        <div className="card">
          <h3>Grounding citations</h3>
          <EvidenceList evidence={detail.evidence} />
        </div>
      ) : null}
    </div>
  );
}
