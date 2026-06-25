// Phase 5 — Evidence list (Part J). Renders the retrieved evidence for an
// object as a stack of citation cards.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { EvidenceCitationCard } from "./EvidenceCitationCard";

export function EvidenceList({ evidence }: { evidence: ObjectDetail["evidence"] }) {
  if (!evidence || evidence.length === 0) {
    return <div className="muted">No evidence linked to this object.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {evidence.map((e, i) => (
        <EvidenceCitationCard key={`${e.objectType}:${e.objectId}:${e.chunkId ?? i}`} evidence={e} />
      ))}
    </div>
  );
}
