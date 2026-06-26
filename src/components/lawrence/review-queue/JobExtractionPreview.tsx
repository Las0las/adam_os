"use client";

// Inline preview of a job_extraction draft inside the review panel, so a reviewer
// sees the proposed Job before approving — approval projects exactly these fields.

import { useEffect, useState } from "react";

interface ProposedJob {
  title?: string | null;
  location?: string | null;
  compensation?: { min?: number | null; max?: number | null; currency?: string | null; period?: string | null } | null;
  metadata?: { company?: string | null; employmentType?: string | null; seniority?: string | null };
}

interface ExtractionProperties {
  proposed?: ProposedJob;
  confidence?: number;
  source?: string;
}

function comp(c: ProposedJob["compensation"]): string | null {
  if (!c) return null;
  const range = [c.min, c.max].filter((x) => x != null).join("–");
  return [range, c.currency, c.period].filter(Boolean).join(" ") || null;
}

export function JobExtractionPreview({ objectId }: { objectId: string }) {
  const [props, setProps] = useState<ExtractionProperties | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/objects/JobExtraction/${encodeURIComponent(objectId)}/detail`)
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
    ["Title", p.title],
    ["Company", p.metadata?.company],
    ["Location", p.location],
    ["Employment", p.metadata?.employmentType],
    ["Seniority", p.metadata?.seniority],
    ["Compensation", comp(p.compensation)],
  ];

  return (
    <>
      <h4 style={{ marginTop: 16, marginBottom: 0 }}>
        Proposed job{" "}
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
      <p className="muted">Approving creates this Job; rejecting discards the draft.</p>
    </>
  );
}
