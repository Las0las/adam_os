"use client";

// Phase 5 — Citation trace list (Part K). Renders the citations array attached
// to a function/agent run. Long excerpts are truncated and expandable.

import { useState } from "react";
import { stringifyValue, truncate } from "../object-detail/object-detail-format";

interface RawCitation {
  objectType?: string;
  objectId?: string;
  chunkId?: string | null;
  excerpt?: string | null;
  score?: number | null;
  method?: string | null;
  [key: string]: unknown;
}

function asCitation(value: unknown): RawCitation {
  return value && typeof value === "object" ? (value as RawCitation) : {};
}

function CitationRow({ citation, index }: { citation: RawCitation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const excerpt = typeof citation.excerpt === "string" ? citation.excerpt : "";
  const label =
    citation.objectType && citation.objectId
      ? `${citation.objectType} · ${citation.objectId}`
      : `Citation ${index + 1}`;
  const long = excerpt.length > 280;

  return (
    <div className="card qcard">
      <div className="row" style={{ borderBottom: "none", padding: 0 }}>
        <span className="muted" style={{ fontSize: 12 }}>{label}</span>
        {citation.score !== null && citation.score !== undefined ? (
          <span className="badge neutral">{stringifyValue(citation.score)}</span>
        ) : null}
      </div>
      {excerpt ? (
        <div className="qexcerpt">{expanded ? excerpt : truncate(excerpt)}</div>
      ) : null}
      {long ? (
        <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

export function CitationTraceList({ citations }: { citations: unknown[] }) {
  if (!citations || citations.length === 0) {
    return <div className="muted">No citations recorded for this run.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {citations.map((c, i) => (
        <CitationRow key={i} citation={asCitation(c)} index={i} />
      ))}
    </div>
  );
}
