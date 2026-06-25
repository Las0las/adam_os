"use client";

// Phase 5 — Review Queue data hook (Part E). Fetches open review cases from
// Mission Control. The endpoint returns a raw array (not wrapped).

import { useCallback, useEffect, useState } from "react";
import type { ReviewCase } from "@/types/mission-control";

export interface UseReviewQueue {
  data: ReviewCase[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useReviewQueue(status = "open"): UseReviewQueue {
  const [data, setData] = useState<ReviewCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/mission-control/review-cases?status=${encodeURIComponent(status)}`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = (await res.json()) as unknown;
        return Array.isArray(raw) ? (raw as ReviewCase[]) : [];
      })
      .then((cases) => {
        setData(cases);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [status, nonce]);

  return { data, loading, error, refresh };
}
