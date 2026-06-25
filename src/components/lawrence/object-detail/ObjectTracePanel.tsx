"use client";

// Phase 5 — Object trace panel (Part C-UI / K). Lists the object's runs;
// selecting one loads its full trace from /api/traces/:runType/:runId and
// renders the matching trace view.

import { useEffect, useRef, useState } from "react";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { formatRelativeAge } from "@/lib/domains/command-center/command-center-formatters";
import { FunctionRunTrace } from "../traces/FunctionRunTrace";
import { AgentRunTrace } from "../traces/AgentRunTrace";
import { ActionExecutionTrace } from "../traces/ActionExecutionTrace";
import type { TraceData } from "../traces/RunTracePanel";
import { TraceStatusBadge } from "../traces/TraceStatusBadge";

type TraceRef = ObjectDetail["traces"][number];

function TraceView({ runType, trace }: { runType: TraceRef["runType"]; trace: TraceData }) {
  if (runType === "function") return <FunctionRunTrace trace={trace} />;
  if (runType === "agent") return <AgentRunTrace trace={trace} />;
  return <ActionExecutionTrace trace={trace} />;
}

export function ObjectTracePanel({ traces }: { traces: ObjectDetail["traces"] }) {
  const [selected, setSelected] = useState<TraceRef | null>(null);
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setTrace(null);

    const url = `/api/traces/${encodeURIComponent(selected.runType)}/${encodeURIComponent(selected.runId)}`;
    fetch(url, { signal: controller.signal, headers: { accept: "application/json" } })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: TraceData; error?: string }
          | null;
        if (!res.ok || !body?.ok || !body.data) throw new Error(body?.error ?? `HTTP ${res.status}`);
        return body.data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setTrace(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [selected]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!traces || traces.length === 0) {
    return <div className="muted">No runs recorded for this object.</div>;
  }

  return (
    <div>
      <div className="card">
        {traces.map((t) => {
          const active = selected?.runType === t.runType && selected?.runId === t.runId;
          return (
            <div
              className="row"
              key={`${t.runType}:${t.runId}`}
              style={{ cursor: "pointer", opacity: active ? 1 : undefined }}
              onClick={() => setSelected(t)}
            >
              <span style={{ fontSize: 12 }}>
                {t.runType} · {t.summary ?? t.runId}
              </span>
              <div className="btn-row" style={{ marginTop: 0 }}>
                <TraceStatusBadge status={t.status} />
                <span className="muted" style={{ fontSize: 12 }}>{formatRelativeAge(t.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {selected ? (
        <div style={{ marginTop: 14 }}>
          {loading ? <div className="muted">Loading trace…</div> : null}
          {error ? <div className="muted">Failed to load trace: {error}</div> : null}
          {trace ? <TraceView runType={selected.runType} trace={trace} /> : null}
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Select a run to view its trace.
        </div>
      )}
    </div>
  );
}
