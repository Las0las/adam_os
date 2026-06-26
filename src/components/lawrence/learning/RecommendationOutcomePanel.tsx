"use client";

// Phase 7 — recommendation outcome panel. GETs /api/learning/recommendation-
// outcomes, lists recent decisions, and computes the acceptance rate client-side
// (accepted / total decided).

import { useEffect, useRef, useState } from "react";
import type { RecommendationOutcome } from "@/lib/aiops/learning/learning-types";

export function RecommendationOutcomePanel() {
  const [data, setData] = useState<RecommendationOutcome[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    fetch("/api/learning/recommendation-outcomes", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: RecommendationOutcome[]; error?: string }
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

  const total = data?.length ?? 0;
  const accepted = (data ?? []).filter((o) => o.decision === "accepted").length;
  const acceptanceRate = total > 0 ? (accepted / total) * 100 : null;

  return (
    <div className="card">
      <div className="row">
        <h3>Recommendation outcomes</h3>
        <span className="badge neutral">
          Acceptance: {acceptanceRate === null ? "—" : `${acceptanceRate.toFixed(0)}%`}
        </span>
      </div>

      {loading && !data ? (
        <div className="skeleton" style={{ height: 72 }} />
      ) : error ? (
        <p className="badge bad">Failed to load outcomes: {error}</p>
      ) : total === 0 ? (
        <p className="muted">No recommendation outcomes recorded.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Decision</th>
              <th>Outcome</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((o) => (
              <tr key={o.id}>
                <td>
                  <code>{o.recommendedActionKey ?? o.objectId ?? "—"}</code>
                </td>
                <td>
                  <span
                    className={`badge ${o.decision === "accepted" ? "good" : o.decision === "rejected" ? "bad" : "neutral"}`}
                  >
                    {o.decision}
                  </span>
                </td>
                <td className="muted">{o.outcomeStatus ?? "—"}</td>
                <td className="muted">
                  {(o.decidedAt ?? o.createdAt).slice(0, 19).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
