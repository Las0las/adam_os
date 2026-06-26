"use client";

// Phase 7 — eval suite detail client root. Fetches /api/aiops/evals/[id] →
// { suite, runs }, shows suite metadata + baseline + a RunEvalButton (refetches
// on settle) + the run history table.

import { useCallback, useEffect, useRef, useState } from "react";
import type { EvalSuite } from "@/lib/aiops/evals/eval-production-types";
import type { EvalRun } from "@/types/aiops";
import { PageHeader, StatusBadge } from "@/components/lawrence/shared/widgets";
import { RunEvalButton } from "./RunEvalButton";
import { EvalRunTable } from "./EvalRunTable";

interface SuiteDetailResponse {
  suite: EvalSuite;
  runs: EvalRun[];
}

export function EvalSuiteDetailClient({ evalSuiteId }: { evalSuiteId: string }) {
  const [data, setData] = useState<SuiteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/api/aiops/evals/${encodeURIComponent(evalSuiteId)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: SuiteDetailResponse; error?: string }
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
  }, [evalSuiteId, nonce]);

  const baselineEntries = data ? Object.entries(data.suite.baselineConfig) : [];

  return (
    <>
      <PageHeader
        title={data?.suite.name ?? "Eval suite"}
        sub="Suite metadata, baseline, and run history."
      />

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load suite: {error}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="card">
          <div className="skeleton" style={{ height: 72 }} />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="card">
            <div className="row">
              <span>Type</span>
              <span className="badge neutral">{data.suite.suiteType}</span>
            </div>
            <div className="row">
              <span>Status</span>
              <StatusBadge status={data.suite.status} />
            </div>
            <div className="row">
              <span>Target</span>
              <code>
                {data.suite.targetComponentType ?? "—"}
                {data.suite.targetComponentKey ? `:${data.suite.targetComponentKey}` : ""}
              </code>
            </div>
            <div className="row">
              <span>Key</span>
              <code>{data.suite.key}</code>
            </div>

            <h4 style={{ marginTop: 12 }}>Baseline</h4>
            {baselineEntries.length === 0 ? (
              <p className="muted">No baseline configured.</p>
            ) : (
              baselineEntries.map(([k, v]) => (
                <div className="row" key={k}>
                  <span>{k}</span>
                  <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))
            )}

            <div className="btn-row" style={{ marginTop: 12 }}>
              <RunEvalButton evalSuiteId={data.suite.id} onSettled={refresh} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <EvalRunTable evalSuiteId={data.suite.id} runs={data.runs} />
          </div>
        </>
      ) : null}
    </>
  );
}
