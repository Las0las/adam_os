"use client";

// Phase 10 — retention hook. Fetches both RetentionPolicy[] and RetentionJob[]
// in parallel, aborting in-flight requests on unmount/refresh, and parses the
// { ok, data, error } envelope on each. Mirrors useObservabilityOverview.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RetentionData, RetentionJob, RetentionPolicy } from "./securityTypes";

interface RetentionState {
  data: RetentionData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchEnvelope<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: string }
    | null;
  if (!res.ok || !body?.ok || body.data === undefined) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body.data;
}

export function useRetention(): RetentionState {
  const [data, setData] = useState<RetentionData | null>(null);
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

    Promise.all([
      fetchEnvelope<RetentionPolicy[]>(
        "/api/security/retention/policies",
        controller.signal,
      ),
      fetchEnvelope<RetentionJob[]>(
        "/api/security/retention/jobs",
        controller.signal,
      ),
    ])
      .then(([policies, jobs]) => {
        if (controller.signal.aborted) return;
        setData({ policies, jobs });
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
