"use client";

// Phase 8 — demo runner mutation actions. run (full demo), runStep (single
// step), reset, and getRun. Tracks { pending, error } via the shared mutation
// runner and calls onSettled after every settled mutation.

import { useCallback } from "react";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";
import type {
  DomainPackDemoRun,
  DemoRunStepResult,
} from "@/lib/domain-packs/domain-pack-types";

export interface UseDemoRunner {
  pending: boolean;
  error: string | null;
  run: (packKey: string, demoKey: string) => Promise<Envelope<DomainPackDemoRun>>;
  runStep: (
    packKey: string,
    demoKey: string,
    stepKey: string,
  ) => Promise<Envelope<DemoRunStepResult>>;
  reset: (
    packKey: string,
    demoKey: string,
    opts?: { removeTraces?: boolean },
  ) => Promise<Envelope>;
  getRun: (demoRunId: string) => Promise<Envelope<DomainPackDemoRun>>;
}

export function useDemoRunner(onSettled: () => void): UseDemoRunner {
  const { pending, error, run: runner } = useMutationRunner(onSettled);

  const run = useCallback(
    (packKey: string, demoKey: string) =>
      runner(() =>
        postJson<DomainPackDemoRun>(
          `/api/demos/${encodeURIComponent(packKey)}/${encodeURIComponent(demoKey)}/run`,
        ),
      ) as Promise<Envelope<DomainPackDemoRun>>,
    [runner],
  );

  const runStep = useCallback(
    (packKey: string, demoKey: string, stepKey: string) =>
      runner(() =>
        postJson<DemoRunStepResult>(
          `/api/demos/${encodeURIComponent(packKey)}/${encodeURIComponent(demoKey)}/run-step`,
          { stepKey },
        ),
      ) as Promise<Envelope<DemoRunStepResult>>,
    [runner],
  );

  const reset = useCallback(
    (packKey: string, demoKey: string, opts?: { removeTraces?: boolean }) =>
      runner(() =>
        postJson(
          `/api/demos/${encodeURIComponent(packKey)}/${encodeURIComponent(demoKey)}/reset`,
          { removeTraces: opts?.removeTraces },
        ),
      ),
    [runner],
  );

  const getRun = useCallback(
    (demoRunId: string) =>
      runner(async () => {
        const res = await fetch(
          `/api/demos/runs/${encodeURIComponent(demoRunId)}`,
          { headers: { accept: "application/json" } },
        );
        const parsed = (await res.json().catch(() => null)) as
          | Envelope<DomainPackDemoRun>
          | null;
        if (parsed && typeof parsed.ok === "boolean") return parsed;
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      }) as Promise<Envelope<DomainPackDemoRun>>,
    [runner],
  );

  return { pending, error, run, runStep, reset, getRun };
}
