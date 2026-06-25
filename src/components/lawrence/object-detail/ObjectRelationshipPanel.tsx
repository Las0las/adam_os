// Phase 5 — Object relationship panel (Part C-UI). Lists linked objects with
// link type, direction, and a link to each related object's detail page.

import Link from "next/link";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";

export function ObjectRelationshipPanel({
  relationships,
}: {
  relationships: ObjectDetail["relationships"];
}) {
  if (!relationships || relationships.length === 0) {
    return <div className="muted">No relationships linked to this object.</div>;
  }
  return (
    <div className="card">
      {relationships.map((rel, i) => {
        const arrow = rel.direction === "outbound" ? "→" : "←";
        const href = `/objects/${encodeURIComponent(rel.objectType)}/${encodeURIComponent(rel.objectId)}`;
        return (
          <div className="row" key={`${rel.linkType}:${rel.objectType}:${rel.objectId}:${i}`}>
            <span className="muted" style={{ fontSize: 12 }}>
              {arrow} {rel.linkType}
            </span>
            <Link href={href} style={{ fontSize: 12 }}>
              {rel.objectType} · {rel.title ?? rel.objectId}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
