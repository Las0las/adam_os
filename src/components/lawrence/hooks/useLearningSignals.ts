"use client";

// Phase 7 — learning signals queue hook. GET /api/learning/signals?status= →
// LearningSignal[]. Aborts in-flight requests, parses the { ok, data, error }
// envelope, supports a status filter and refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LearningSignal,
  LearningSignalStatus,
} from "@/lib/aiops/learning/learning-types";

interface LearningSignalsState {
  data: LearningSignal[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useLearningSignals(
  status: LearningSignalStatus | "all" = "open",
): LearningSignalsState {
  const [data, setData] = useState<LearningSignal[] | null>(null);
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

    const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;

    fetch(`/api/learning/signals${qs}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: LearningSignal[]; error?: string }
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
  }, [status, nonce]);

  return { data, loading, error, refresh };
}
