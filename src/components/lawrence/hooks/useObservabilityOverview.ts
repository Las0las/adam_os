"use client";

// Phase 7 — observability overview hook. Fetches the live ObservabilityOverview
// snapshot, aborting in-flight requests on unmount/refresh, and parses the
// { ok, data, error } envelope. Mirrors useCommandCenterOverview.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObservabilityOverview } from "@/lib/aiops/observability/observability-types";

interface OverviewState {
  data: ObservabilityOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useObservabilityOverview(): OverviewState {
  const [data, setData] = useState<ObservabilityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch("/api/aiops/observability/overview", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: ObservabilityOverview; error?: string }
          | null;
        if (!res.ok || !body?.ok || !body.data) {
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        return body.data;
      })
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [nonce]);

  return { data, loading, error, refresh };
}
