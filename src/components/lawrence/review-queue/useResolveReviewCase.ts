"use client";

// Phase 5 — review case resolve hook (Part E). POSTs a decision to the Mission
// Control resolve endpoint. The decision bar normally routes through
// ActionButton/useExecuteAction; this hook is the direct primitive for any
// caller that needs to resolve programmatically.

import { useCallback, useState } from "react";

export type ResolveState = "idle" | "resolving" | "resolved" | "failed";

export interface ResolveResult {
  state: ResolveState;
  raw?: unknown;
  message?: string;
}

export function useResolveReviewCase() {
  const [state, setState] = useState<ResolveResult>({ state: "idle" });

  const resolve = useCallback(
    async (caseId: string, decision: string, note?: string): Promise<ResolveResult> => {
      setState({ state: "resolving" });
      try {
        const res = await fetch(
          `/api/mission-control/review-cases/${encodeURIComponent(caseId)}/resolve`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decision, note }),
          },
        );
        const raw = (await res.json().catch(() => ({}))) as unknown;
        const next: ResolveResult = res.ok
          ? { state: "resolved", raw }
          : {
              state: "failed",
              raw,
              message: (raw as { error?: string })?.error ?? `HTTP ${res.status}`,
            };
        setState(next);
        return next;
      } catch (err) {
        const next: ResolveResult = {
          state: "failed",
          message: err instanceof Error ? err.message : String(err),
        };
        setState(next);
        return next;
      }
    },
    [],
  );

  return { resolve, state };
}
