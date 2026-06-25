// Phase 5 — Object detail header (Part C-UI). Object type, title, status badge,
// inferred domain, and severity if present in properties.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { domainForObjectType, propString, statusTone } from "./object-detail-format";

export function ObjectHeaderPanel({ object }: { object: ObjectDetail["object"] }) {
  const severity = propString(object.properties, "severity");
  const domain = domainForObjectType(object.objectType);

  return (
    <div style={{ marginBottom: 4 }}>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
        {domain} · {object.objectType}
      </div>
      <h2 style={{ margin: "4px 0 8px", fontSize: 18 }}>{object.title ?? object.objectId}</h2>
      <div className="btn-row" style={{ marginTop: 0 }}>
        {object.status ? (
          <span className={`badge ${statusTone(object.status)}`}>{object.status}</span>
        ) : null}
        {severity ? (
          <span className={`badge sev-${severity.toLowerCase()}`}>{severity}</span>
        ) : null}
      </div>
    </div>
  );
}
