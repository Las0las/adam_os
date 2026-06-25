"use client";

// Phase 5 — Run trace panel (Part K). Renders a loaded trace (function/agent/
// action) with status, collapsible input/output JSON, and the citation list.
// Long raw text is hidden behind expand/collapse by default.

import { useState } from "react";
import { TraceStatusBadge } from "./TraceStatusBadge";
import { CitationTraceList } from "./CitationTraceList";
import { prettyJson, truncate } from "../object-detail/object-detail-format";

export interface TraceData {
  runType?: string;
  runId?: string;
  status?: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  citations?: unknown[];
  steps?: unknown[];
  blockedReason?: string | null;
  [key: string]: unknown;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (value === null || value === undefined) return null;
  const full = prettyJson(value);
  const long = full.length > 600;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ borderBottom: "none", padding: 0 }}>
        <span className="muted" style={{ fontSize: 12 }}>{label}</span>
        {long ? (
          <button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      <pre className="json">{long && !expanded ? truncate(full, 600) : full}</pre>
    </div>
  );
}

export function RunTracePanel({ trace }: { trace: TraceData }) {
  const citations: unknown[] = Array.isArray(trace.citations) ? trace.citations : [];
  const output = trace.output ?? trace.result;

  return (
    <div>
      <div className="row" style={{ padding: "4px 0" }}>
        <span className="muted" style={{ fontSize: 12 }}>
          {trace.runType ?? "run"} · {trace.runId ?? ""}
        </span>
        <TraceStatusBadge status={trace.status} />
      </div>

      {trace.blockedReason ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Blocked: {trace.blockedReason}
        </div>
      ) : null}

      <JsonBlock label="Input" value={trace.input} />
      <JsonBlock label="Output" value={output} />

      {Array.isArray(trace.steps) && trace.steps.length > 0 ? (
        <JsonBlock label="Steps" value={trace.steps} />
      ) : null}

      {citations.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Citations</div>
          <CitationTraceList citations={citations} />
        </div>
      ) : null}
    </div>
  );
}
