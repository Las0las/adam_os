// Phase 5 — Object evidence panel (Part C-UI / J). Renders the object's
// retrieved evidence via EvidenceList.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { EvidenceList } from "../evidence/EvidenceList";

export function ObjectEvidencePanel({ evidence }: { evidence: ObjectDetail["evidence"] }) {
  return <EvidenceList evidence={evidence} />;
}
