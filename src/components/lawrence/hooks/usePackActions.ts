"use client";

// Phase 8 — domain pack install/uninstall mutation actions. POSTs to the
// install/uninstall endpoints, parses the envelope, refetches via onSettled.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface UsePackActions {
  pending: boolean;
  error: string | null;
  install: (packKey: string) => Promise<Envelope>;
  uninstall: (packKey: string, removeDemoData?: boolean) => Promise<Envelope>;
}

export function usePackActions(onSettled: () => void): UsePackActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const install = useCallback(
    (packKey: string) =>
      run(() => postJson(`/api/domain-packs/${encodeURIComponent(packKey)}/install`)),
    [run],
  );

  const uninstall = useCallback(
    (packKey: string, removeDemoData?: boolean) =>
      run(() =>
        postJson(`/api/domain-packs/${encodeURIComponent(packKey)}/uninstall`, {
          removeDemoData,
        }),
      ),
    [run],
  );

  return { pending, error, install, uninstall };
}
