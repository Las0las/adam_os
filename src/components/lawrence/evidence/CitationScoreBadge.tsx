// Phase 5 — Evidence relevance score badge (Part J). Renders a normalized
// citation score; tone scales with the score.

export function CitationScoreBadge({ score }: { score?: number | null }) {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  const tone = score >= 0.75 ? "good" : score >= 0.45 ? "warn" : "neutral";
  return <span className={`badge ${tone}`}>{score.toFixed(2)}</span>;
}
