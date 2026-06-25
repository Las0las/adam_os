// Phase 5 — Job domain panel (Part F). Recruiting-flavored summary: department/
// location/seniority from properties, linked candidates from relationships.

import Link from "next/link";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { propString } from "../object-detail-format";

export function JobDetailPanel({ detail }: { detail: ObjectDetail }) {
  const props = detail.object.properties;
  const candidates = detail.relationships.filter(
    (r) => r.objectType === "Candidate" || r.linkType.toLowerCase().includes("candidate"),
  );

  const fields: Array<[string, string | null]> = [
    ["Department", propString(props, "department")],
    ["Location", propString(props, "location")],
    ["Seniority", propString(props, "seniority") ?? propString(props, "level")],
    ["Employment", propString(props, "employmentType")],
  ];
  const present = fields.filter(([, v]) => v !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <h3>Job</h3>
        <div className="kv"><span className="muted">Title</span><span>{detail.object.title ?? detail.object.objectId}</span></div>
        {present.map(([label, value]) => (
          <div className="kv" key={label}><span className="muted">{label}</span><span>{value}</span></div>
        ))}
      </div>

      {propString(props, "description") ? (
        <div className="card">
          <h3>Description</h3>
          <div style={{ fontSize: 12 }}>{propString(props, "description")}</div>
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div className="card">
          <h3>Candidates ({candidates.length})</h3>
          {candidates.map((c, i) => (
            <div className="row" key={`${c.objectId}:${i}`}>
              <span className="muted" style={{ fontSize: 12 }}>{c.linkType}</span>
              <Link href={`/objects/${encodeURIComponent(c.objectType)}/${encodeURIComponent(c.objectId)}`} style={{ fontSize: 12 }}>
                {c.title ?? c.objectId}
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
