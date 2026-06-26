"use client";

// Phase 6 — Rollback record execution action. POSTs to the rollback execute
// endpoint, parses the envelope, refetches via onSettled.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UseRollbackActions {
  pending: boolean;
  error: string | null;
  execute: (rollbackId: string) => Promise<Envelope>;
}

export function useRollbackActions(onSettled: () => void): UseRollbackActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const execute = useCallback(
    (rollbackId: string) =>
      run(() =>
        postJson(
          `/api/mission-control/rollback/${encodeURIComponent(rollbackId)}/execute`,
        ),
      ),
    [run],
  );

  return { pending, error, execute };
}
