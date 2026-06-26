"use client";

// Phase 7 — inline feedback buttons. Captures explicit, auditable feedback on a
// subject (e.g. an answer or extraction). Useful/Not useful map to answer_rating
// with rating 5/1; Bad citation → citation_issue; Correct extraction opens the
// CorrectionDialog; the rest are answer_rating rows carrying a label.

import { useState } from "react";
import type { FeedbackType } from "@/lib/aiops/learning/learning-types";
import { useFeedback, type FeedbackInput } from "@/components/lawrence/hooks/useFeedback";
import { CorrectionDialog } from "./CorrectionDialog";

type QuickButton = {
  text: string;
  feedbackType: FeedbackType;
  rating?: number;
  label?: string;
};

const QUICK: QuickButton[] = [
  { text: "Useful", feedbackType: "answer_rating", rating: 5, label: "useful" },
  { text: "Not useful", feedbackType: "answer_rating", rating: 1, label: "not_useful" },
  { text: "Incorrect", feedbackType: "answer_rating", label: "incorrect" },
  { text: "Missing evidence", feedbackType: "answer_rating", label: "missing_evidence" },
  { text: "Bad citation", feedbackType: "citation_issue", label: "bad_citation" },
];

export function FeedbackButtons({
  subjectType,
  subjectId,
  objectType,
  objectId,
}: {
  subjectType: string;
  subjectId: string;
  objectType?: string;
  objectId?: string;
}) {
  const { pending, error, submitFeedback } = useFeedback();
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);

  async function send(btn: QuickButton) {
    const input: FeedbackInput = {
      feedbackType: btn.feedbackType,
      subjectType,
      subjectId,
      objectType,
      objectId,
      rating: btn.rating,
      label: btn.label,
    };
    const result = await submitFeedback(input);
    if (result.ok) setConfirmed(btn.text);
  }

  return (
    <div className="card">
      <h3>Feedback</h3>
      <div className="btn-row">
        {QUICK.map((btn) => (
          <button
            key={btn.text}
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => void send(btn)}
          >
            {btn.text}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => setShowCorrection(true)}
        >
          Correct extraction
        </button>
      </div>

      {confirmed ? (
        <p className="badge good">Recorded: {confirmed}</p>
      ) : null}
      {error ? <p className="badge bad">{error}</p> : null}

      {showCorrection ? (
        <div style={{ marginTop: 12 }}>
          <CorrectionDialog
            subjectType={subjectType}
            subjectId={subjectId}
            objectType={objectType}
            objectId={objectId}
            onClose={() => setShowCorrection(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
