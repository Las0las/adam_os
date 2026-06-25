// Phase 5 — Candidate domain panel (Part F). Recruiting-flavored summary:
// skills/notes from properties, submissions/applications from relationships.

import Link from "next/link";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { propString, stringifyValue } from "../object-detail-format";

export function CandidateDetailPanel({ detail }: { detail: ObjectDetail }) {
  const props = detail.object.properties;
  const skills = props.skills;
  const skillList = Array.isArray(skills) ? skills.map((s) => stringifyValue(s)) : [];
  const notes = propString(props, "notes") ?? propString(props, "summary");
  const submissions = detail.relationships.filter(
    (r) => r.objectType === "Submission" || r.objectType === "Application" || r.linkType.toLowerCase().includes("submission"),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <h3>Candidate</h3>
        <div className="kv"><span className="muted">Name</span><span>{detail.object.title ?? detail.object.objectId}</span></div>
        {propString(props, "email") ? (
          <div className="kv"><span className="muted">Email</span><span>{propString(props, "email")}</span></div>
        ) : null}
        {propString(props, "location") ? (
          <div className="kv"><span className="muted">Location</span><span>{propString(props, "location")}</span></div>
        ) : null}
      </div>

      {skillList.length > 0 ? (
        <div className="card">
          <h3>Skills</h3>
          <div className="btn-row" style={{ marginTop: 0 }}>
            {skillList.map((s, i) => (
              <span className="badge neutral" key={`${s}:${i}`}>{s}</span>
            ))}
          </div>
        </div>
      ) : null}

      {notes ? (
        <div className="card">
          <h3>Notes</h3>
          <div style={{ fontSize: 12 }}>{notes}</div>
        </div>
      ) : null}

      {submissions.length > 0 ? (
        <div className="card">
          <h3>Submissions</h3>
          {submissions.map((s, i) => (
            <div className="row" key={`${s.objectId}:${i}`}>
              <span className="muted" style={{ fontSize: 12 }}>{s.linkType}</span>
              <Link href={`/objects/${encodeURIComponent(s.objectType)}/${encodeURIComponent(s.objectId)}`} style={{ fontSize: 12 }}>
                {s.title ?? s.objectId}
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
