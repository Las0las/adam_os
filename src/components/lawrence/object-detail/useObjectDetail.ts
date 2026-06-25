"use client";

// Phase 5 — Object Detail data hook (Part L). Fetches the unified ObjectDetail
// contract for a single object, aborting in-flight requests on unmount and on
// identity change. Returns the detail plus loading/error/refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";

interface ObjectDetailState {
  data: ObjectDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useObjectDetail(objectType: string, objectId: string): ObjectDetailState {
  const [data, setData] = useState<ObjectDetail | null>(null);
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

    const url = `/api/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/detail`;
    fetch(url, { signal: controller.signal, headers: { accept: "application/json" } })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: ObjectDetail; error?: string }
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
  }, [objectType, objectId, nonce]);

  return { data, loading, error, refresh };
}
