"use client";

// Phase 7 — extraction correction dialog. Collects a JSON correction payload and
// POSTs it as an extraction_correction feedback row. Validates JSON client-side
// before submit and confirms on success.

import { useState } from "react";
import { useFeedback } from "@/components/lawrence/hooks/useFeedback";

export function CorrectionDialog({
  subjectType,
  subjectId,
  objectType,
  objectId,
  onClose,
}: {
  subjectType: string;
  subjectId: string;
  objectType?: string;
  objectId?: string;
  onClose: () => void;
}) {
  const { pending, error, submitFeedback } = useFeedback();
  const [raw, setRaw] = useState("{\n  \n}");
  const [comment, setComment] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setParseError(null);
    let correction: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Correction must be a JSON object.");
      }
      correction = parsed as Record<string, unknown>;
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON.");
      return;
    }

    const result = await submitFeedback({
      feedbackType: "extraction_correction",
      subjectType,
      subjectId,
      objectType,
      objectId,
      comment: comment.trim() === "" ? undefined : comment.trim(),
      correction,
    });
    if (result.ok) setDone(true);
  }

  return (
    <div className="card">
      <div className="row">
        <h3>Correct extraction</h3>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>

      {done ? (
        <p className="badge good">Correction recorded.</p>
      ) : (
        <>
          <label>
            <div className="muted">Correction payload (JSON)</div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </label>
          <label>
            <div className="muted">Comment (optional)</div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>

          {parseError ? <p className="badge bad">{parseError}</p> : null}
          {error ? <p className="badge bad">{error}</p> : null}

          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => void submit()}
            >
              {pending ? "Submitting…" : "Submit correction"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
