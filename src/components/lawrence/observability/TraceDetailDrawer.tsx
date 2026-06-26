"use client";

// Phase 7 — trace detail drawer. Given a traceId, GETs the full RuntimeTrace and
// renders type/component/status/metrics/citations/errors. Self-contained fetch
// with AbortController; a close button clears the selection upstream.

import { useEffect, useRef, useState } from "react";
import type { RuntimeTrace } from "@/lib/aiops/observability/observability-types";
import { StatusBadge } from "@/components/lawrence/shared/widgets";

export function TraceDetailDrawer({
  traceId,
  onClose,
}: {
  traceId: string;
  onClose: () => void;
}) {
  const [trace, setTrace] = useState<RuntimeTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setTrace(null);
    setLoading(true);
    setError(null);

    fetch(`/api/aiops/observability/traces/${encodeURIComponent(traceId)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: RuntimeTrace; error?: string }
          | null;
        if (!res.ok || !body?.ok || !body.data) {
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        return body.data;
      })
      .then((next) => {
        if (controller.signal.aborted) return;
        setTrace(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [traceId]);

  return (
    <div className="card">
      <div className="row">
        <h3>Trace detail</h3>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : error ? (
        <p className="badge bad">Failed to load trace: {error}</p>
      ) : trace ? (
        <>
          <div className="row">
            <span>Type</span>
            <span className="badge neutral">{trace.traceType}</span>
          </div>
          <div className="row">
            <span>Component</span>
            <code>
              {trace.componentType ?? "—"}
              {trace.componentKey ? `:${trace.componentKey}` : ""}
            </code>
          </div>
          <div className="row">
            <span>Status</span>
            <StatusBadge status={trace.status} />
          </div>
          <div className="row">
            <span>Trace id</span>
            <code>{trace.traceId}</code>
          </div>

          <h4 style={{ marginTop: 12 }}>Metrics</h4>
          {Object.keys(trace.metrics).length === 0 ? (
            <p className="muted">No metrics.</p>
          ) : (
            Object.entries(trace.metrics).map(([k, v]) => (
              <div className="row" key={k}>
                <span>{k}</span>
                <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))
          )}

          <h4 style={{ marginTop: 12 }}>Citations</h4>
          {trace.citations.length === 0 ? (
            <p className="muted">No citations.</p>
          ) : (
            <ul>
              {trace.citations.map((c, i) => (
                <li key={i}>
                  <code>{JSON.stringify(c)}</code>
                </li>
              ))}
            </ul>
          )}

          <h4 style={{ marginTop: 12 }}>Errors</h4>
          {trace.errors.length === 0 ? (
            <p className="muted">No errors.</p>
          ) : (
            <ul>
              {trace.errors.map((e, i) => (
                <li key={i} className="badge bad">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
