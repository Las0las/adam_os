"use client";

// Phase 6 — Kill switch mutation actions (enable / disable). POSTs to the
// kill-switches endpoints, parses the envelope, refetches via onSettled.

import { useCallback } from "react";
import type { RuntimeComponentType } from "@/lib/mission-control/runtime/mission-control-hardening-types";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface EnableKillSwitchInput {
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentKey?: string;
  reason: string;
}

export interface DisableKillSwitchInput {
  componentType: RuntimeComponentType;
  componentKey: string;
  environmentKey?: string;
  reason?: string;
}

export interface UseKillSwitchActions {
  pending: boolean;
  error: string | null;
  enable: (input: EnableKillSwitchInput) => Promise<Envelope>;
  disable: (input: DisableKillSwitchInput) => Promise<Envelope>;
}

export function useKillSwitchActions(onSettled: () => void): UseKillSwitchActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const enable = useCallback(
    (input: EnableKillSwitchInput) =>
      run(() => postJson("/api/mission-control/kill-switches/enable", input)),
    [run],
  );

  const disable = useCallback(
    (input: DisableKillSwitchInput) =>
      run(() => postJson("/api/mission-control/kill-switches/disable", input)),
    [run],
  );

  return { pending, error, enable, disable };
}
