"use client";

// Phase 10 — security mutation actions. Each method POSTs to a security endpoint,
// parses the { ok, data, error } envelope, calls onSettled to refetch the
// relevant view, and tracks shared { pending, error } state. Mirrors
// useReleaseActions / useKillSwitchActions via the shared mutation runner.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UseSecurityActions {
  pending: boolean;
  error: string | null;
  run: (op: () => Promise<Envelope>) => Promise<Envelope>;
  post: <T = unknown>(url: string, body?: unknown) => Promise<Envelope<T>>;
}

export function useSecurityActions(onSettled: () => void): UseSecurityActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const post = useCallback(
    <T = unknown>(url: string, body?: unknown) =>
      run(() => postJson<T>(url, body)) as Promise<Envelope<T>>,
    [run],
  );

  return { pending, error, run, post };
}
