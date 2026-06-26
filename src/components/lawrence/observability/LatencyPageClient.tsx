"use client";

// Phase 7 — latency page client. GETs /api/aiops/observability/latency and shows
// the average/p95 summary plus the slow-trace table (click opens detail).

import { useEffect, useRef, useState } from "react";
import type { RuntimeTrace } from "@/lib/aiops/observability/observability-types";
import { PageHeader, Metric } from "@/components/lawrence/shared/widgets";
import { LatencyTable } from "./LatencyTable";
import { TraceDetailDrawer } from "./TraceDetailDrawer";

interface LatencyResponse {
  summary: { averageMs: number; p95Ms: number };
  traces: RuntimeTrace[];
}

export function LatencyPageClient() {
  const [data, setData] = useState<LatencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    fetch("/api/aiops/observability/latency", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: LatencyResponse; error?: string }
          | null;
        if (!res.ok || !body?.ok || !body.data) {
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        return body.data;
      })
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <>
      <PageHeader title="Latency" sub="Average and p95 latency with the slowest runtime traces." />

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load latency: {error}</p>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-3">
            <Metric label="Average (ms)" value={data.summary.averageMs.toFixed(0)} />
            <Metric label="p95 (ms)" value={data.summary.p95Ms.toFixed(0)} />
            <Metric label="Traces" value={data.traces.length} />
          </div>

          <div style={{ marginTop: 16 }}>
            <LatencyTable traces={data.traces} onSelect={setTraceId} />
          </div>

          {traceId ? (
            <div style={{ marginTop: 16 }}>
              <TraceDetailDrawer traceId={traceId} onClose={() => setTraceId(null)} />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
