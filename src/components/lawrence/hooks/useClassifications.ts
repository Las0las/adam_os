"use client";

// Phase 10 — on-demand classification lookup hook. Fetches the effective
// classification + records for an object only when load() is called, parsing the
// { ok, data, error } envelope and aborting any in-flight lookup.

import { useCallback, useRef, useState } from "react";
import type { ClassificationLookup } from "./securityTypes";

interface ClassificationsState {
  data: ClassificationLookup | null;
  loading: boolean;
  error: string | null;
  load: (objectType: string, objectId: string) => void;
  reset: () => void;
}

export function useClassifications(): ClassificationsState {
  const [data, setData] = useState<ClassificationLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  const load = useCallback((objectType: string, objectId: string) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(
      `/api/security/classifications/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: ClassificationLookup; error?: string }
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
  }, []);

  return { data, loading, error, load, reset };
}
