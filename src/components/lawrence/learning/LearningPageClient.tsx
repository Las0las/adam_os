"use client";

// Phase 7 — closed-loop learning page client root. Two-column layout: the signal
// queue on the left; the selected signal's detail + review actions on the right.
// Below, feedback and recommendation-outcome roll-ups. No auto-apply of signals —
// every promotion is a recorded human decision.

import { useCallback, useState } from "react";
import type {
  LearningSignal,
  LearningSignalStatus,
} from "@/lib/aiops/learning/learning-types";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import { LearningSignalQueue } from "./LearningSignalQueue";
import { LearningSignalDetail } from "./LearningSignalDetail";
import { LearningSignalActions } from "./LearningSignalActions";
import { FeedbackSummaryPanel } from "./FeedbackSummaryPanel";
import { RecommendationOutcomePanel } from "./RecommendationOutcomePanel";

export function LearningPageClient() {
  const [status, setStatus] = useState<LearningSignalStatus | "all">("open");
  const [selected, setSelected] = useState<LearningSignal | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Bump the token to force the queue to refetch after a mutation; clear the
  // selection so we don't show a stale (now-moved) signal.
  const handleSettled = useCallback(() => {
    setRefreshToken((n) => n + 1);
    setSelected(null);
  }, []);

  return (
    <>
      <PageHeader
        title="Closed-loop learning"
        sub="Review learning signals, feedback, and recommendation outcomes. Accepting a signal records a decision — it never auto-applies a change to production."
      />

      <div className="cc-grid">
        <div className="cc-col">
          <LearningSignalQueue
            status={status}
            onStatusChange={(next) => {
              setStatus(next);
              setSelected(null);
            }}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            refreshSignal={refreshToken}
          />
        </div>

        <div className="cc-col">
          <LearningSignalDetail signal={selected} />
          {selected ? (
            <div style={{ marginTop: 16 }}>
              <LearningSignalActions signal={selected} onSettled={handleSettled} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="cc-grid" style={{ marginTop: 16 }}>
        <div className="cc-col">
          <FeedbackSummaryPanel />
        </div>
        <div className="cc-col">
          <RecommendationOutcomePanel />
        </div>
      </div>
    </>
  );
}
