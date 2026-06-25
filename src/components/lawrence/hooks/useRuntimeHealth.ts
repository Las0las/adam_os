"use client";

// Phase 5 — runtime health hook (Part I). Fetches the Mission Control runtime
// health snapshot (failure rates 0..1, open incidents, review backlog).

import { useCallback, useEffect, useState } from "react";

export interface RuntimeHealth {
  pipelineFailureRate: number;
  functionFailureRate: number;
  actionFailureRate: number;
  notificationFailureRate: number;
  openIncidents: number;
  reviewBacklog: number;
}

export interface UseRuntimeHealth {
  data: RuntimeHealth | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRuntimeHealth(): UseRuntimeHealth {
  const [data, setData] = useState<RuntimeHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/mission-control/runtime/health", { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as RuntimeHealth;
      })
      .then((health) => {
        setData(health);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [nonce]);

  return { data, loading, error, refresh };
}
