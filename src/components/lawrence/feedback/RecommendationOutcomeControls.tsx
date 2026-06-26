"use client";

// Phase 7 — recommendation outcome controls. Accept / Reject / Modify / Escalate
// / Ignore each POST a RecommendationOutcome decision. Records a human decision
// as an auditable row; it does not itself execute any action.

import { useState } from "react";
import type { OutcomeDecision } from "@/lib/aiops/learning/learning-types";
import { useRecommendationOutcome } from "@/components/lawrence/hooks/useRecommendationOutcome";

const DECISIONS: Array<{ text: string; decision: OutcomeDecision }> = [
  { text: "Accept", decision: "accepted" },
  { text: "Reject", decision: "rejected" },
  { text: "Modify", decision: "modified" },
  { text: "Escalate", decision: "escalated" },
  { text: "Ignore", decision: "ignored" },
];

export function RecommendationOutcomeControls({
  objectType,
  objectId,
  recommendedActionKey,
}: {
  objectType: string;
  objectId: string;
  recommendedActionKey?: string;
}) {
  const { pending, error, submitOutcome } = useRecommendationOutcome();
  const [rationale, setRationale] = useState("");
  const [confirmed, setConfirmed] = useState<string | null>(null);

  async function decide(decision: OutcomeDecision, text: string) {
    const result = await submitOutcome({
      objectType,
      objectId,
      recommendedActionKey,
      decision,
      rationale: rationale.trim() === "" ? undefined : rationale.trim(),
    });
    if (result.ok) setConfirmed(text);
  }

  return (
    <div className="card">
      <h3>Recommendation decision</h3>
      <label>
        <div className="muted">Rationale (optional)</div>
        <input
          type="text"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          style={{ width: "100%" }}
        />
      </label>
      <div className="btn-row">
        {DECISIONS.map((d) => (
          <button
            key={d.decision}
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => void decide(d.decision, d.text)}
          >
            {d.text}
          </button>
        ))}
      </div>
      {confirmed ? <p className="badge good">Recorded: {confirmed}</p> : null}
      {error ? <p className="badge bad">{error}</p> : null}
    </div>
  );
}
