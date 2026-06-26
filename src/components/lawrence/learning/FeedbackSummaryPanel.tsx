"use client";

// Phase 7 — feedback summary panel. GETs /api/learning/feedback and shows counts
// by feedback type. Read-only roll-up over the auditable feedback log.

import { useEffect, useRef, useState } from "react";
import type { HumanFeedback } from "@/lib/aiops/learning/learning-types";

export function FeedbackSummaryPanel() {
  const [data, setData] = useState<HumanFeedback[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    fetch("/api/learning/feedback", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: HumanFeedback[]; error?: string }
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

  const counts = new Map<string, number>();
  for (const f of data ?? []) {
    counts.set(f.feedbackType, (counts.get(f.feedbackType) ?? 0) + 1);
  }

  return (
    <div className="card">
      <h3>Feedback summary</h3>
      {loading && !data ? (
        <div className="skeleton" style={{ height: 48 }} />
      ) : error ? (
        <p className="badge bad">Failed to load feedback: {error}</p>
      ) : counts.size === 0 ? (
        <p className="muted">No feedback recorded.</p>
      ) : (
        <>
          <div className="row">
            <span>Total</span>
            <span>{data?.length ?? 0}</span>
          </div>
          {[...counts.entries()].map(([type, count]) => (
            <div className="row" key={type}>
              <span className="badge neutral">{type}</span>
              <span>{count}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
