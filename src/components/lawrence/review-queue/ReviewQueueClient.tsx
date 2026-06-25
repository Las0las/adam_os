"use client";

// Phase 5 — Review Queue client (Part E). Master/detail: left a ranked list of
// open review cases, right the selected case + decision bar. Resolving a case
// refreshes the queue from the backend (no local mutation).

import { useEffect, useMemo, useState } from "react";
import type { ReviewCase } from "@/types/mission-control";
import { useReviewQueue } from "@/components/lawrence/hooks/useReviewQueue";
import { ReviewCaseCard } from "./ReviewCaseCard";
import { ReviewCaseDetailPanel } from "./ReviewCaseDetailPanel";

export function ReviewQueueClient() {
  const { data, loading, error, refresh } = useReviewQueue("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Keep a valid selection as the queue refreshes; default to the first case.
  useEffect(() => {
    if (data.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && data.some((c) => c.id === prev)) return prev;
      return data[0]?.id ?? null;
    });
  }, [data]);

  const selected: ReviewCase | null = useMemo(
    () => data.find((c) => c.id === selectedId) ?? null,
    [data, selectedId],
  );

  return (
    <>
      <h1 className="page-title">Review Queue</h1>
      <p className="muted">
        Human-in-the-loop cases for low-confidence output, exceptions, and gated actions.
      </p>

      {error ? (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="badge bad">Error</span>
          <p className="muted">Failed to load review cases: {error}</p>
        </div>
      ) : null}

      <div className="row" style={{ gap: 16, alignItems: "flex-start", marginTop: 16 }}>
        <div className="rail" style={{ flex: "1 1 360px", minWidth: 0 }}>
          {loading ? (
            <>
              <div className="qcard" aria-hidden />
              <div className="qcard" aria-hidden />
              <div className="qcard" aria-hidden />
            </>
          ) : data.length === 0 ? (
            <div className="card">
              <p className="muted">No open review cases. The queue is clear.</p>
            </div>
          ) : (
            data.map((c) => (
              <ReviewCaseCard
                key={c.id}
                reviewCase={c}
                selected={c.id === selectedId}
                onSelect={(rc) => setSelectedId(rc.id)}
              />
            ))
          )}
        </div>

        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          {selected ? (
            <ReviewCaseDetailPanel reviewCase={selected} onResolved={refresh} />
          ) : !loading ? (
            <div className="card">
              <p className="muted">Select a case to review it.</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
