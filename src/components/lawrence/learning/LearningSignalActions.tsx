"use client";

// Phase 7 — learning signal review actions. Review / Accept / Reject / Mark
// implemented, wired to useLearningSignalActions. Accepting offers a "create
// review case" checkbox and NEVER auto-applies a change to production — it only
// records the human decision. onSettled refetches the queue.

import { useState } from "react";
import type { LearningSignal } from "@/lib/aiops/learning/learning-types";
import { useLearningSignalActions } from "@/components/lawrence/hooks/useLearningSignalActions";

export function LearningSignalActions({
  signal,
  onSettled,
}: {
  signal: LearningSignal;
  onSettled: () => void;
}) {
  const { pending, error, review, accept, reject, markImplemented } =
    useLearningSignalActions(onSettled);
  const [createReviewCase, setCreateReviewCase] = useState(false);
  const [note, setNote] = useState("");
  const [releaseBundleId, setReleaseBundleId] = useState("");

  const noteValue = note.trim() === "" ? undefined : note.trim();
  const bundleValue = releaseBundleId.trim() === "" ? undefined : releaseBundleId.trim();

  return (
    <div className="card">
      <h3>Actions</h3>
      <p className="muted">
        Accepting records a human decision only — it never auto-applies a change to
        production.
      </p>

      <label className="row">
        <span>Note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reviewer note"
        />
      </label>

      <label className="row">
        <span>
          <input
            type="checkbox"
            checked={createReviewCase}
            onChange={(e) => setCreateReviewCase(e.target.checked)}
          />{" "}
          Create review case on accept
        </span>
      </label>

      <label className="row">
        <span>Release bundle id (optional)</span>
        <input
          type="text"
          value={releaseBundleId}
          onChange={(e) => setReleaseBundleId(e.target.value)}
          placeholder="For mark implemented"
        />
      </label>

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => void review(signal.id)}
        >
          Review
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => void accept(signal.id, { createReviewCase, note: noteValue })}
        >
          Accept
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => void reject(signal.id, noteValue)}
        >
          Reject
        </button>
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => void markImplemented(signal.id, bundleValue)}
        >
          Mark implemented
        </button>
      </div>

      {error ? <p className="badge bad">{error}</p> : null}
    </div>
  );
}
