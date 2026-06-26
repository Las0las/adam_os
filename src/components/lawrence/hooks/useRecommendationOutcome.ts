"use client";

// Phase 7 — recommendation outcome capture. POST /api/learning/recommendation-
// outcomes. Records a human decision on a recommendation (accept/reject/modify/
// escalate/ignore) as an auditable row. Tracks { pending, error }.

import { useCallback } from "react";
import type {
  OutcomeDecision,
  OutcomeStatus,
} from "@/lib/aiops/learning/learning-types";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface RecommendationOutcomeInput {
  objectType?: string;
  objectId?: string;
  recommendedActionKey?: string;
  decision: OutcomeDecision;
  outcomeStatus?: OutcomeStatus;
  rationale?: string;
}

export interface UseRecommendationOutcome {
  pending: boolean;
  error: string | null;
  submitOutcome: (input: RecommendationOutcomeInput) => Promise<Envelope>;
}

export function useRecommendationOutcome(
  onSettled: () => void = () => {},
): UseRecommendationOutcome {
  const { pending, error, run } = useMutationRunner(onSettled);

  const submitOutcome = useCallback(
    (input: RecommendationOutcomeInput) =>
      run(() => postJson("/api/learning/recommendation-outcomes", input)),
    [run],
  );

  return { pending, error, submitOutcome };
}
