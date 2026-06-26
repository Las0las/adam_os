"use client";

// Phase 7 — one-click citation issue. POSTs a citation_issue feedback row for the
// given subject/object and confirms inline.

import { useState } from "react";
import { useFeedback } from "@/components/lawrence/hooks/useFeedback";

export function CitationIssueButton({
  subjectType,
  subjectId,
  objectType,
  objectId,
  label = "Bad citation",
}: {
  subjectType: string;
  subjectId: string;
  objectType?: string;
  objectId?: string;
  label?: string;
}) {
  const { pending, error, submitFeedback } = useFeedback();
  const [done, setDone] = useState(false);

  async function submit() {
    const result = await submitFeedback({
      feedbackType: "citation_issue",
      subjectType,
      subjectId,
      objectType,
      objectId,
      label: "bad_citation",
    });
    if (result.ok) setDone(true);
  }

  return (
    <span>
      <button
        type="button"
        className="btn"
        disabled={pending || done}
        onClick={() => void submit()}
      >
        {done ? "Reported" : pending ? "Reporting…" : label}
      </button>
      {error ? <span className="badge bad" style={{ marginLeft: 8 }}>{error}</span> : null}
    </span>
  );
}
