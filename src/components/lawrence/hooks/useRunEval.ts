"use client";

// Phase 7 — run an eval suite. POST /api/aiops/evals/run { evalSuiteId } →
// { run, summary }. Tracks { pending, error } and calls onSettled after the run
// resolves so callers can refetch the suite/run list.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UseRunEval {
  pending: boolean;
  error: string | null;
  runEval: (evalSuiteId: string) => Promise<Envelope>;
}

export function useRunEval(onSettled: () => void): UseRunEval {
  const { pending, error, run } = useMutationRunner(onSettled);

  const runEval = useCallback(
    (evalSuiteId: string) =>
      run(() => postJson("/api/aiops/evals/run", { evalSuiteId })),
    [run],
  );

  return { pending, error, runEval };
}
