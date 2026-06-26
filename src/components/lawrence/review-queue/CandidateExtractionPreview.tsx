"use client";

// Inline preview of a candidate_extraction draft inside the review panel, so a
// reviewer sees the proposed Candidate (and the model's confidence) before
// approving — approval projects exactly these fields into a real Candidate.

import { useEffect, useState } from "react";

interface Proposed {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  headline?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  profileUrl?: string | null;
}

interface ExtractionProperties {
  proposed?: Proposed;
  confidence?: number;
  source?: string;
}

export function CandidateExtractionPreview({ objectId }: { objectId: string }) {
  const [props, setProps] = useState<ExtractionProperties | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/objects/CandidateExtraction/${encodeURIComponent(objectId)}/detail`)
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: { object?: { properties?: ExtractionProperties } }; error?: string }) => {
        if (!active) return;
        if (j.ok && j.data?.object?.properties) setProps(j.data.object.properties);
        else setError(j.error ?? "draft not found");
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [objectId]);

  if (error) return <p className="muted">Could not load proposal: {error}</p>;
  if (!props) return <p className="muted">Loading proposal…</p>;

  const p = props.proposed ?? {};
  const rows: Array<[string, string | null | undefined]> = [
    ["Name", p.fullName],
    ["Email", p.email],
    ["Phone", p.phone],
    ["Location", p.location],
    ["Headline", p.headline],
    ["Current title", p.currentTitle],
    ["Current company", p.currentCompany],
    ["Profile", p.profileUrl],
  ];

  return (
    <>
      <h4 style={{ marginTop: 16, marginBottom: 0 }}>
        Proposed candidate{" "}
        {typeof props.confidence === "number" ? (
          <span className="badge">confidence {props.confidence}</span>
        ) : null}
        {props.source ? <span className="badge neutral">{props.source}</span> : null}
      </h4>
      {rows
        .filter(([, v]) => Boolean(v))
        .map(([k, v]) => (
          <div className="kv" key={k}>
            <span className="muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      <p className="muted">Approving creates this Candidate; rejecting discards the draft.</p>
    </>
  );
}
