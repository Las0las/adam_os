"use client";

// Phase 6 — Runtime health action. POSTs to the health/run endpoint to trigger
// a fresh sweep of component health checks, then refetches via onSettled.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UseRuntimeHealthActions {
  pending: boolean;
  error: string | null;
  runHealthChecks: () => Promise<Envelope>;
}

export function useRuntimeHealthActions(
  onSettled: () => void,
): UseRuntimeHealthActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const runHealthChecks = useCallback(
    () => run(() => postJson("/api/mission-control/runtime/health/run")),
    [run],
  );

  return { pending, error, runHealthChecks };
}
