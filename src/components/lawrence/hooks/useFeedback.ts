"use client";

// Phase 7 — human feedback capture. POST /api/learning/feedback. Records an
// explicit, auditable feedback row (never a silent model write). Tracks
// { pending, error } and an optional success flag for confirmation UX.

import { useCallback } from "react";
import type { FeedbackType } from "@/lib/aiops/learning/learning-types";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface FeedbackInput {
  feedbackType: FeedbackType;
  subjectType: string;
  subjectId: string;
  objectType?: string;
  objectId?: string;
  rating?: number;
  label?: string;
  comment?: string;
  correction?: Record<string, unknown>;
}

export interface UseFeedback {
  pending: boolean;
  error: string | null;
  submitFeedback: (input: FeedbackInput) => Promise<Envelope>;
}

export function useFeedback(onSettled: () => void = () => {}): UseFeedback {
  const { pending, error, run } = useMutationRunner(onSettled);

  const submitFeedback = useCallback(
    (input: FeedbackInput) => run(() => postJson("/api/learning/feedback", input)),
    [run],
  );

  return { pending, error, submitFeedback };
}
