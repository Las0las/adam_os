// Phase 5 — Evidence retrieval method badge (Part J). Shows how a citation was
// retrieved (e.g. vector, keyword, hybrid).

export function RetrievalMethodBadge({ method }: { method?: string | null }) {
  if (!method) return null;
  return <span className="badge neutral">{method}</span>;
}
