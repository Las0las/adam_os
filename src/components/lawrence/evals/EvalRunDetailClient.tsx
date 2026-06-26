"use client";

// Phase 7 — eval run detail client root. Fetches /api/aiops/evals/runs/[id] →
// { run, caseResults } and shows the score, pass/regression badge, metrics
// panel, and per-case result table.

import { useEffect, useRef, useState } from "react";
import type { EvalCaseResultRecord } from "@/lib/aiops/evals/eval-production-types";
import type { EvalRun } from "@/types/aiops";
import { PageHeader, Metric } from "@/components/lawrence/shared/widgets";
import { RegressionBadge } from "./RegressionBadge";
import { EvalMetricsPanel } from "./EvalMetricsPanel";
import { EvalCaseResultTable } from "./EvalCaseResultTable";

interface RunDetailResponse {
  run: EvalRun;
  caseResults: EvalCaseResultRecord[];
}

export function EvalRunDetailClient({ evalRunId }: { evalRunId: string }) {
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    fetch(`/api/aiops/evals/runs/${encodeURIComponent(evalRunId)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: RunDetailResponse; error?: string }
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
  }, [evalRunId]);

  return (
    <>
      <PageHeader title="Eval run" sub="Score, regression status, and per-case results." />

      {error ? (
        <div className="card">
          <p className="badge bad">Failed to load run: {error}</p>
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
            <Metric label="Score" value={data.run.score.toFixed(3)} />
            <Metric label="Suite type" value={data.run.suiteType} />
            <Metric label="Cases" value={data.caseResults.length} />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="row">
              <span>Result</span>
              <RegressionBadge
                regressionDetected={data.run.regressionDetected}
                passed={data.run.passed}
              />
            </div>
            <div className="row">
              <span>Created</span>
              <span className="muted">
                {data.run.createdAt.slice(0, 19).replace("T", " ")}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <EvalMetricsPanel metrics={data.run.metrics} />
          </div>

          <div style={{ marginTop: 16 }}>
            <EvalCaseResultTable caseResults={data.caseResults} />
          </div>
        </>
      ) : null}
    </>
  );
}
