"use client";

// Phase 6 — Release bundle mutation actions. Each method POSTs to a release
// endpoint, parses the { ok, data, error } envelope, calls onSettled to refetch
// the overview, and tracks shared { pending, error } state. No optimistic final
// state — the source of truth is the refetched overview.

import { useCallback } from "react";
import type { CreateReleaseInput } from "@/lib/mission-control/deployments/release-bundle-service";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UseReleaseActions {
  pending: boolean;
  error: string | null;
  createRelease: (input: CreateReleaseInput) => Promise<Envelope>;
  submit: (releaseId: string) => Promise<Envelope>;
  promote: (releaseId: string) => Promise<Envelope>;
  requestRollback: (
    releaseId: string,
    reason: string,
    emergency?: boolean,
  ) => Promise<Envelope>;
}

export function useReleaseActions(onSettled: () => void): UseReleaseActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const createRelease = useCallback(
    (input: CreateReleaseInput) =>
      run(() => postJson("/api/mission-control/releases", input)),
    [run],
  );

  const submit = useCallback(
    (releaseId: string) =>
      run(() =>
        postJson(
          `/api/mission-control/releases/${encodeURIComponent(releaseId)}/submit`,
        ),
      ),
    [run],
  );

  const promote = useCallback(
    (releaseId: string) =>
      run(() =>
        postJson(
          `/api/mission-control/releases/${encodeURIComponent(releaseId)}/promote`,
        ),
      ),
    [run],
  );

  const requestRollback = useCallback(
    (releaseId: string, reason: string, emergency?: boolean) =>
      run(() =>
        postJson(
          `/api/mission-control/releases/${encodeURIComponent(releaseId)}/rollback`,
          { reason, emergency },
        ),
      ),
    [run],
  );

  return { pending, error, createRelease, submit, promote, requestRollback };
}
