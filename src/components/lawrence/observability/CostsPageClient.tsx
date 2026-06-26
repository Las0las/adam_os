"use client";

// Phase 7 — costs page client. GETs /api/aiops/observability/costs and renders a
// model-cost bar list plus the underlying AI usage events table.

import { useEffect, useRef, useState } from "react";
import type { AiUsageEvent } from "@/lib/aiops/observability/observability-types";
import { PageHeader, Metric } from "@/components/lawrence/shared/widgets";

interface CostsResponse {
  summary: {
    estimatedCost: number;
    byModel: Array<{ modelKey: string; cost: number; tokens: number }>;
  };
  events: AiUsageEvent[];
}

export function CostsPageClient() {
  const [data, setData] = useState<CostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    fetch("/api/aiops/observability/costs", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: CostsResponse; error?: string }
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

  const byModel = data?.summary.byModel ?? [];
  const maxCost = byModel.reduce((m, r) => Math.max(m, r.cost), 0);

  return (
    <>
      <PageHeader title="Costs" sub="Estimated AI spend by model, with the underlying usage events." />

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load costs: {error}</p>
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
            <Metric label="Estimated cost" value={`$${data.summary.estimatedCost.toFixed(2)}`} />
            <Metric label="Models" value={byModel.length} />
            <Metric label="Usage events" value={data.events.length} />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Cost by model</h3>
            {byModel.length === 0 ? (
              <p className="muted">No model cost recorded.</p>
            ) : (
              byModel.map((m) => {
                const width = maxCost > 0 ? Math.round((m.cost / maxCost) * 100) : 0;
                return (
                  <div key={m.modelKey} style={{ marginBottom: 8 }}>
                    <div className="row" style={{ marginBottom: 4 }}>
                      <code>{m.modelKey}</code>
                      <span>
                        ${m.cost.toFixed(2)} · {m.tokens} tok
                      </span>
                    </div>
                    <div
                      style={{
                        background: "var(--surface-2, #e5e7eb)",
                        borderRadius: 4,
                        height: 8,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          background: "var(--accent, #2563eb)",
                          height: "100%",
                          width: `${width}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Usage events</h3>
            {data.events.length === 0 ? (
              <p className="muted">No usage events.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Purpose</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Latency (ms)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <code>{e.modelKey ?? "—"}</code>
                      </td>
                      <td className="muted">{e.purpose ?? "—"}</td>
                      <td>{e.totalTokens ?? "—"}</td>
                      <td>{e.estimatedCost === null || e.estimatedCost === undefined ? "—" : `$${e.estimatedCost.toFixed(4)}`}</td>
                      <td>{e.latencyMs ?? "—"}</td>
                      <td>
                        <span className="badge neutral">{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
