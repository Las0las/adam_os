// Phase 5 — Evidence citation card (Part J). Renders a single retrieved
// citation: the excerpt, a link to its source object, and retrieval metadata.
// An excerpt is always shown when present — never "citation unavailable".

import Link from "next/link";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { RetrievalMethodBadge } from "./RetrievalMethodBadge";
import { CitationScoreBadge } from "./CitationScoreBadge";

type Evidence = ObjectDetail["evidence"][number];

export function EvidenceCitationCard({ evidence }: { evidence: Evidence }) {
  const hasExcerpt = typeof evidence.excerpt === "string" && evidence.excerpt.trim().length > 0;
  const sourceHref = `/objects/${encodeURIComponent(evidence.objectType)}/${encodeURIComponent(evidence.objectId)}`;

  return (
    <div className="card qcard">
      <div className="row" style={{ borderBottom: "none", padding: 0 }}>
        <Link href={sourceHref} className="muted" style={{ fontSize: 12 }}>
          {evidence.objectType} · {evidence.objectId}
        </Link>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <RetrievalMethodBadge method={evidence.method} />
          <CitationScoreBadge score={evidence.score} />
        </div>
      </div>
      {hasExcerpt ? (
        <div className="qexcerpt">{evidence.excerpt}</div>
      ) : (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          No excerpt available for this citation.
        </div>
      )}
    </div>
  );
}
