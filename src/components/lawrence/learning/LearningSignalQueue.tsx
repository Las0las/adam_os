"use client";

// Phase 7 — learning signal queue. Lists signals (severity badge, type,
// component, summary, status) for a status filter and lets the caller select
// one. Self-fetching via useLearningSignals; refresh exposed to parent so
// actions can refetch after a decision.

import { useEffect, useRef } from "react";
import { useLearningSignals } from "@/components/lawrence/hooks/useLearningSignals";
import type {
  LearningSignal,
  LearningSignalStatus,
} from "@/lib/aiops/learning/learning-types";

// Re-run `refresh` whenever `token` changes (skips the initial undefined token
// so we don't double-fetch on mount).
function useRefetchOnChange(refresh: () => void, token: number | undefined) {
  const prev = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (token === undefined) return;
    if (prev.current === undefined) {
      prev.current = token;
      return;
    }
    if (prev.current !== token) {
      prev.current = token;
      refresh();
    }
  }, [refresh, token]);
}

const STATUSES: Array<LearningSignalStatus | "all"> = [
  "open",
  "reviewed",
  "accepted",
  "rejected",
  "implemented",
  "all",
];

export function LearningSignalQueue({
  status,
  onStatusChange,
  selectedId,
  onSelect,
  refreshSignal,
}: {
  status: LearningSignalStatus | "all";
  onStatusChange: (status: LearningSignalStatus | "all") => void;
  selectedId: string | null;
  onSelect: (signal: LearningSignal) => void;
  /** Bumped by the parent to force a refetch after a mutation. */
  refreshSignal?: number;
}) {
  const { data, loading, error, refresh } = useLearningSignals(status);

  // Refetch when the parent bumps refreshSignal.
  useRefetchOnChange(refresh, refreshSignal);

  return (
    <div className="card">
      <div className="row">
        <h3>Learning signals</h3>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as LearningSignalStatus | "all")}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div>
          <p className="badge bad">Failed to load signals: {error}</p>
          <button type="button" className="btn" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="skeleton" style={{ height: 72 }} />
      ) : null}

      {data ? (
        data.length === 0 ? (
          <p className="muted">No signals for this status.</p>
        ) : (
          data.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`row${s.id === selectedId ? " selected" : ""}`}
              style={{
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                background: s.id === selectedId ? "var(--surface-2, #eef2ff)" : undefined,
              }}
              onClick={() => onSelect(s)}
            >
              <span>
                <span
                  className={`badge ${s.severity === "critical" || s.severity === "high" ? "bad" : "warn"}`}
                >
                  {s.severity}
                </span>{" "}
                <span className="badge neutral">{s.signalType}</span>{" "}
                {s.componentKey ? <code>{s.componentKey}</code> : null}
                <br />
                {s.summary}
              </span>
              <span className="badge neutral">{s.status}</span>
            </button>
          ))
        )
      ) : null}
    </div>
  );
}
