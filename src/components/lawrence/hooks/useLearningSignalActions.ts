"use client";

// Phase 7 — learning signal review actions. Each method POSTs to a signal
// endpoint (review/accept/reject/implemented), parses the { ok, data, error }
// envelope, and calls onSettled to refetch. Accepting NEVER auto-applies a
// change to production — it only records the human decision.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UseLearningSignalActions {
  pending: boolean;
  error: string | null;
  review: (signalId: string) => Promise<Envelope>;
  accept: (
    signalId: string,
    opts?: { createReviewCase?: boolean; note?: string },
  ) => Promise<Envelope>;
  reject: (signalId: string, note?: string) => Promise<Envelope>;
  markImplemented: (
    signalId: string,
    releaseBundleId?: string,
  ) => Promise<Envelope>;
}

function path(signalId: string, verb: string): string {
  return `/api/learning/signals/${encodeURIComponent(signalId)}/${verb}`;
}

export function useLearningSignalActions(
  onSettled: () => void,
): UseLearningSignalActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const review = useCallback(
    (signalId: string) => run(() => postJson(path(signalId, "review"))),
    [run],
  );

  const accept = useCallback(
    (signalId: string, opts?: { createReviewCase?: boolean; note?: string }) =>
      run(() => postJson(path(signalId, "accept"), opts ?? {})),
    [run],
  );

  const reject = useCallback(
    (signalId: string, note?: string) =>
      run(() => postJson(path(signalId, "reject"), { note })),
    [run],
  );

  const markImplemented = useCallback(
    (signalId: string, releaseBundleId?: string) =>
      run(() => postJson(path(signalId, "implemented"), { releaseBundleId })),
    [run],
  );

  return { pending, error, review, accept, reject, markImplemented };
}
